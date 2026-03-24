import { db, userOrganizationRole } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/users/:id/roles/:roleId — Revoke role (admin)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; roleId: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: userId, roleId } = await params;

  // Prevent removing the last admin of the org
  const [{ adminCount }] = await db.execute<{ adminCount: number }>(sql`
    SELECT count(*)::int AS "adminCount"
    FROM user_organization_role
    WHERE org_id = ${ctx.orgId}
      AND role = 'admin'
      AND deleted_at IS NULL
      AND id != ${roleId}
  `);

  // Check if this role IS an admin role
  const [target] = await db
    .select()
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.id, roleId),
        eq(userOrganizationRole.userId, userId),
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  if (!target) return Response.json({ error: "Not found" }, { status: 404 });

  if (target.role === "admin" && adminCount === 0) {
    return Response.json(
      { error: "Cannot remove the last admin of an organization" },
      { status: 409 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx.execute(sql`
      UPDATE user_organization_role
      SET deleted_at = now(), deleted_by = ${ctx.userId}, updated_by = ${ctx.userId}
      WHERE id = ${roleId}
    `);
  });

  return Response.json({ data: { roleId, revoked: true } });
}
