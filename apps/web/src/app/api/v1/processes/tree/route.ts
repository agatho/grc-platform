import { db, process, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/tree — Hierarchical tree (nested JSON)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const parentId = url.searchParams.get("parentId");

  // Query children of the given parent (or root nodes if parentId is null)
  const parentCondition = parentId
    ? eq(process.parentProcessId, parentId)
    : isNull(process.parentProcessId);

  const nodes = await db
    .select({
      id: process.id,
      name: process.name,
      level: process.level,
      status: process.status,
      parentProcessId: process.parentProcessId,
      isEssential: process.isEssential,
      processOwnerName: user.name,
      childCount: sql<number>`(
        SELECT count(*)::int FROM process c
        WHERE c.parent_process_id = ${process.id}
          AND c.deleted_at IS NULL
      )`,
    })
    .from(process)
    .leftJoin(user, eq(process.processOwnerId, user.id))
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
        parentCondition,
      ),
    )
    .orderBy(process.name);

  return Response.json({ data: nodes });
}
