import { db, user, userOrganizationRole } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/users/:id — User details (admin or self)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const isSelf = id === ctx.userId;

  // Non-admins can only view themselves
  if (!isSelf) {
    const isAdmin = ctx.session.user.roles.some(
      (r: any) => r.orgId === ctx.orgId && r.role === "admin",
    );
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [found] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      language: user.language,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.id, id), isNull(user.deletedAt)));

  if (!found) return Response.json({ error: "Not found" }, { status: 404 });

  // Include roles in the current org
  const roles = await db
    .select({
      id: userOrganizationRole.id,
      role: userOrganizationRole.role,
      department: userOrganizationRole.department,
      lineOfDefense: userOrganizationRole.lineOfDefense,
    })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, id),
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  return Response.json({ data: { ...found, roles } });
}
