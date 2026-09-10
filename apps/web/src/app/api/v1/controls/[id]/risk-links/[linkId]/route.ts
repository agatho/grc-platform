import { db, control, riskControl } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/controls/:id/risk-links/:linkId — Unlink risk from control
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, linkId } = await params;

  // Verify control exists
  const [existing] = await db
    .select({ id: control.id })
    .from(control)
    .where(
      and(
        eq(control.id, id),
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Control not found" }, { status: 404 });
  }

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(riskControl)
      .where(
        and(
          eq(riskControl.id, linkId),
          eq(riskControl.controlId, id),
          eq(riskControl.orgId, ctx.orgId),
        ),
      )
      .returning({ id: riskControl.id });

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Link not found" }, { status: 404 });
  }

  return Response.json({ data: { id: linkId, deleted: true } });
});
