import { db, process, processStep, processStepAsset } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/processes/:id/steps/:stepId/assets/:assetId — Unlink asset from step
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; stepId: string; assetId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId, assetId } = await params;

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
    .select({ id: processStepAsset.id })
    .from(processStepAsset)
    .where(
      and(
        eq(processStepAsset.processStepId, stepId),
        eq(processStepAsset.assetId, assetId),
      ),
    );

  if (!link) {
    return Response.json({ error: "Asset link not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx.delete(processStepAsset).where(eq(processStepAsset.id, link.id));
  });

  return Response.json({ success: true });
});
