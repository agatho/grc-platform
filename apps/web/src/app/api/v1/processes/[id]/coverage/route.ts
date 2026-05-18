// BPM Overhaul Phase 4: Compliance framework coverage per process.
// Returns all framework_mapping rows and their grouped framework codes.

import { db, process, processFrameworkMapping } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { resolveCatalogEntry } from "@/lib/catalog-resolver";
import { z } from "zod";

const linkSchema = z.object({
  // Either pass a resolved catalogEntryId, or pass frameworkCode + entryCode
  // and the server resolves to a real catalog_entry when possible.
  catalogEntryId: z.string().uuid().optional().nullable(),
  catalogId: z.string().uuid().optional().nullable(),
  frameworkCode: z.string().max(40).optional().nullable(),
  entryCode: z.string().max(50).optional().nullable(),
  entryTitle: z.string().optional().nullable(),
  mappingStrength: z.enum(["covers", "partial", "references"]).optional(),
  rationale: z.string().optional().nullable(),
  evidenceLink: z.string().optional().nullable(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;

  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const mappings = await db
    .select()
    .from(processFrameworkMapping)
    .where(eq(processFrameworkMapping.processId, id));

  const byFramework = new Map<string, number>();
  for (const m of mappings) {
    const k = m.frameworkCode ?? "unknown";
    byFramework.set(k, (byFramework.get(k) ?? 0) + 1);
  }

  return Response.json({
    data: {
      processId: id,
      mappings,
      summary: {
        totalMappings: mappings.length,
        frameworks: Array.from(byFramework.entries()).map(([code, count]) => ({
          code,
          count,
        })),
      },
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "compliance_officer", "process_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const parsed = linkSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Resolve catalog_entry when not provided directly
  let catalogEntryId = parsed.data.catalogEntryId ?? null;
  let catalogId = parsed.data.catalogId ?? null;
  if (!catalogEntryId && parsed.data.frameworkCode && parsed.data.entryCode) {
    const resolved = await resolveCatalogEntry(
      parsed.data.frameworkCode,
      parsed.data.entryCode,
    );
    if (resolved) {
      catalogEntryId = resolved.catalogEntryId;
      catalogId = resolved.catalogId;
    }
  }

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const values = {
        orgId: ctx.orgId,
        processId: id,
        catalogEntryId,
        catalogId,
        frameworkCode: parsed.data.frameworkCode ?? null,
        entryCode: parsed.data.entryCode ?? null,
        entryTitle: parsed.data.entryTitle ?? null,
        mappingStrength: parsed.data.mappingStrength ?? "covers",
        rationale: parsed.data.rationale ?? null,
        evidenceLink: parsed.data.evidenceLink ?? null,
        createdBy: ctx.userId,
      };
      const [row] = await tx
        .insert(processFrameworkMapping)
        .values(values)
        .returning();
      return row;
    },
    { actionDetail: "Framework mapping upserted" },
  );

  return Response.json({ data: result }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "compliance_officer", "process_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const url = new URL(req.url);
  const mappingId = url.searchParams.get("mappingId");
  if (!mappingId) {
    return Response.json({ error: "mappingId required" }, { status: 400 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(processFrameworkMapping)
      .where(
        and(
          eq(processFrameworkMapping.id, mappingId),
          eq(processFrameworkMapping.processId, id),
          eq(processFrameworkMapping.orgId, ctx.orgId),
        ),
      );
  });

  return new Response(null, { status: 204 });
}
