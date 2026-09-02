import { db, process, processStep, processStepRisk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/processes/:id/steps/:stepId/risks/:riskId — Unlink risk from step
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; stepId: string; riskId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId, riskId } = await params;

  // Verify process exists and belongs to org
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

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Verify step exists
  const [step] = await db
    .select({ id: processStep.id })
    .from(processStep)
    .where(
      and(
        eq(processStep.id, stepId),
        eq(processStep.processId, id),
        isNull(processStep.deletedAt),
      ),
    );

  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  // Find the link
  const [link] = await db
    .select({ id: processStepRisk.id })
    .from(processStepRisk)
    .where(
      and(
        eq(processStepRisk.processStepId, stepId),
        eq(processStepRisk.riskId, riskId),
      ),
    );

  if (!link) {
    return Response.json({ error: "Risk link not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx.delete(processStepRisk).where(eq(processStepRisk.id, link.id));
  });

  return Response.json({
    data: { stepId, riskId, deleted: true },
  });
});
