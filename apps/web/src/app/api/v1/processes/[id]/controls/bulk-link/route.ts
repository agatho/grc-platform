// BPM Overhaul Phase 2: Bulk-link controls to a process.

import { db, process, control, processControl } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const bulkSchema = z.object({
  controlIds: z.array(z.string().uuid()).min(1).max(100),
  controlContext: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "control_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)));
  if (!existing) return Response.json({ error: "Process not found" }, { status: 404 });

  const parsed = bulkSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const validControls = await db
    .select({ id: control.id })
    .from(control)
    .where(
      and(
        inArray(control.id, parsed.data.controlIds),
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );
  const validIds = new Set(validControls.map((c) => c.id));
  const invalid = parsed.data.controlIds.filter((cid) => !validIds.has(cid));
  if (invalid.length) {
    return Response.json({ error: "Some controls not found", details: { invalid } }, { status: 422 });
  }

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const existingLinks = await tx
        .select({ controlId: processControl.controlId })
        .from(processControl)
        .where(
          and(
            eq(processControl.processId, id),
            inArray(processControl.controlId, parsed.data.controlIds),
          ),
        );
      const skip = new Set(existingLinks.map((l: any) => l.controlId));
      const toInsert = parsed.data.controlIds.filter((cid) => !skip.has(cid));
      if (toInsert.length === 0) {
        return { created: 0, skippedDuplicates: parsed.data.controlIds.length };
      }
      await tx.insert(processControl).values(
        toInsert.map((cid) => ({
          orgId: ctx.orgId,
          processId: id,
          controlId: cid,
          controlContext: parsed.data.controlContext ?? null,
          createdBy: ctx.userId,
        })),
      );
      return { created: toInsert.length, skippedDuplicates: skip.size };
    },
    { actionDetail: `Bulk-linked ${parsed.data.controlIds.length} controls to process` },
  );

  return Response.json({ data: result }, { status: 201 });
}
