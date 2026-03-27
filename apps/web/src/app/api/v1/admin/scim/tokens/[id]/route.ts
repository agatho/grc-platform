import { db, scimToken } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/admin/scim/tokens/:id — Revoke a SCIM token
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [existing] = await db
    .select({ id: scimToken.id })
    .from(scimToken)
    .where(
      and(
        eq(scimToken.id, id),
        eq(scimToken.orgId, ctx.orgId),
      ),
    );

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
}
