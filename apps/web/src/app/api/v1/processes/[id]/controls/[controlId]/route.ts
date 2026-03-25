import { db, process, processControl } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/processes/:id/controls/:controlId — Unlink control from process
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; controlId: string }> },
) {
  const ctx = await withAuth("admin", "control_owner", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, controlId } = await params;

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

  // Find the link
  const [link] = await db
    .select({ id: processControl.id })
    .from(processControl)
    .where(
      and(
        eq(processControl.processId, id),
        eq(processControl.controlId, controlId),
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
      .delete(processControl)
      .where(eq(processControl.id, link.id));
  });

  return Response.json({ success: true });
}
