import { db, process } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import {
  groupProcessesForMap,
  resolveInheritedCategory,
} from "@/lib/process-map";
import type { ProcessMapCategory } from "@grc/shared";

const mapQuerySchema = z.object({
  parentId: z.string().uuid().optional(),
});

interface AncestorRow {
  id: string;
  name: string;
  map_category: ProcessMapCategory | null;
  depth: number;
}

// GET /api/v1/processes/map?parentId=… — Prozesslandkarte: one hierarchy
// level grouped into value-chain bands (management / core / support /
// unassigned) with child counts and diagram flags. Single aggregated
// query per level — no N+1.
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = mapQuerySchema.safeParse({
    parentId: url.searchParams.get("parentId") ?? undefined,
  });
  if (!query.success) {
    return Response.json(
      { error: "Validation failed", details: query.error.flatten() },
      { status: 422 },
    );
  }
  const parentId = query.data.parentId ?? null;

  // Drill-in: resolve the parent + its ancestor chain in one recursive
  // query (breadcrumb name + effective band for inheritance). Depth is
  // capped at the max hierarchy depth (level 1–10).
  let parent: {
    id: string;
    name: string;
    mapCategory: ProcessMapCategory | null;
    effectiveCategory: ProcessMapCategory | null;
  } | null = null;
  let parentCategory: ProcessMapCategory | null = null;

  if (parentId) {
    const chainResult = await db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, name, map_category, parent_process_id, 0 AS depth
        FROM process
        WHERE id = ${parentId}
          AND org_id = ${ctx.orgId}
          AND deleted_at IS NULL
        UNION ALL
        SELECT p.id, p.name, p.map_category, p.parent_process_id,
               a.depth + 1
        FROM process p
        JOIN ancestors a ON p.id = a.parent_process_id
        WHERE p.org_id = ${ctx.orgId}
          AND p.deleted_at IS NULL
          AND a.depth < 10
      )
      SELECT id, name, map_category, depth
      FROM ancestors
      ORDER BY depth ASC
    `);
    const chain = Array.from(
      chainResult as Iterable<Record<string, unknown>>,
    ) as unknown as AncestorRow[];

    if (chain.length === 0) {
      return Response.json({ error: "Process not found" }, { status: 404 });
    }

    parentCategory = resolveInheritedCategory(
      chain.map((row) => ({ mapCategory: row.map_category })),
    );
    parent = {
      id: chain[0].id,
      name: chain[0].name,
      mapCategory: chain[0].map_category,
      effectiveCategory: parentCategory,
    };
  }

  const parentCondition = parentId
    ? eq(process.parentProcessId, parentId)
    : isNull(process.parentProcessId);

  const nodes = await db
    .select({
      id: process.id,
      name: process.name,
      status: process.status,
      level: process.level,
      mapCategory: process.mapCategory,
      childCount: sql<number>`(
        SELECT count(*)::int FROM process c
        WHERE c.parent_process_id = ${process.id}
          AND c.deleted_at IS NULL
      )`,
      hasDiagram: sql<boolean>`EXISTS (
        SELECT 1 FROM process_version v
        WHERE v.process_id = ${process.id}
          AND v.bpmn_xml IS NOT NULL
          AND length(v.bpmn_xml) > 0
      )`,
    })
    .from(process)
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
        parentCondition,
      ),
    )
    // Manual order first (0374, set via /processes/map/reorder), then
    // alphabetical for everything without a sequence.
    .orderBy(sql`${process.mapSequence} ASC NULLS LAST`, process.name);

  const groups = groupProcessesForMap(nodes, parentCategory);

  return Response.json({ data: { parent, groups } });
}
