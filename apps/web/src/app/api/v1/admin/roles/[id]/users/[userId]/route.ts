import { db, userCustomRole } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/admin/roles/[id]/users/[userId] — Remove user from role
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id, userId } = await params;

  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(userCustomRole)
      .where(
        and(
          eq(userCustomRole.customRoleId, id),
          eq(userCustomRole.userId, userId),
          eq(userCustomRole.orgId, ctx.orgId),
        ),
      )
      .returning();
    return deleted;
  });

  if (!result) return Response.json({ error: "Assignment not found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
}
