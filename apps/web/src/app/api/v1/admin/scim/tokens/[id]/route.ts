import { db, scimToken } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/admin/scim/tokens/:id — Revoke a SCIM token
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [existing] = await db
    .select({ id: scimToken.id })
    .from(scimToken)
    .where(and(eq(scimToken.id, id), eq(scimToken.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Token not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(scimToken)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedBy: ctx.userId,
      })
      .where(eq(scimToken.id, id));
  });

  return Response.json({ success: true });
});
