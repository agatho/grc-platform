import { db, process, processRisk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/processes/:id/risks/:riskId — Unlink risk from process
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; riskId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, riskId } = await params;

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

  // Find and delete the link
  const [link] = await db
    .select({ id: processRisk.id })
    .from(processRisk)
    .where(
      and(
        eq(processRisk.processId, id),
        eq(processRisk.riskId, riskId),
      ),
    );

  if (!link) {
    return Response.json(
      { error: "Risk link not found" },
      { status: 404 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(processRisk)
      .where(eq(processRisk.id, link.id));
  });

  return Response.json({ data: { processId: id, riskId, deleted: true } });
}
