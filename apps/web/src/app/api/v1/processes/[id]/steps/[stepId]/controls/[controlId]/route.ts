import { db, process, processStep, processStepControl } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/processes/:id/steps/:stepId/controls/:controlId — Unlink control from step
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string; controlId: string }> },
) {
  const ctx = await withAuth("admin", "control_owner", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId, controlId } = await params;

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
    .select({ id: processStepControl.id })
    .from(processStepControl)
    .where(
      and(
        eq(processStepControl.processStepId, stepId),
        eq(processStepControl.controlId, controlId),
      ),
    );

  if (!link) {
    return Response.json(
      { error: "Control link not found" },
      { status: 404 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(processStepControl)
      .where(eq(processStepControl.id, link.id));
  });

  return Response.json({ success: true });
}
