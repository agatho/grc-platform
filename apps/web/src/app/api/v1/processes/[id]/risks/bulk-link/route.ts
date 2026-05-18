// BPM Overhaul Phase 2: Bulk-link risks to a process.

import { db, process, risk, processRisk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const bulkSchema = z.object({
  riskIds: z.array(z.string().uuid()).min(1).max(100),
  riskContext: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
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

  const parsed = bulkSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Validate every risk belongs to org
  const validRisks = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        inArray(risk.id, parsed.data.riskIds),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );
  const validIds = new Set(validRisks.map((r) => r.id));
  const invalid = parsed.data.riskIds.filter((rid) => !validIds.has(rid));
  if (invalid.length) {
    return Response.json(
      { error: "Some risks not found", details: { invalid } },
      { status: 422 },
    );
  }

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      // Existing links to skip
      const existingLinks = await tx
        .select({ riskId: processRisk.riskId })
        .from(processRisk)
        .where(
          and(
            eq(processRisk.processId, id),
            inArray(processRisk.riskId, parsed.data.riskIds),
          ),
        );
      const skip = new Set(existingLinks.map((l: any) => l.riskId));
      const toInsert = parsed.data.riskIds.filter((rid) => !skip.has(rid));
      if (toInsert.length === 0) {
        return { created: 0, skippedDuplicates: parsed.data.riskIds.length };
      }
      await tx.insert(processRisk).values(
        toInsert.map((rid) => ({
          orgId: ctx.orgId,
          processId: id,
          riskId: rid,
          riskContext: parsed.data.riskContext ?? null,
          createdBy: ctx.userId,
        })),
      );
      return { created: toInsert.length, skippedDuplicates: skip.size };
    },
    {
      actionDetail: `Bulk-linked ${parsed.data.riskIds.length} risks to process`,
    },
  );

  return Response.json({ data: result }, { status: 201 });
}
