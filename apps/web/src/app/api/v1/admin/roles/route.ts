import { db, customRole, rolePermission } from "@grc/db";
import { createCustomRoleSchema } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/admin/roles — List all roles (system + custom)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const roles = await db
    .select()
    .from(customRole)
    .where(eq(customRole.orgId, ctx.orgId))
    .orderBy(customRole.isSystem, desc(customRole.isSystem), customRole.name);

  // Load permissions for each role
  const rolesWithPermissions = await Promise.all(
    roles.map(async (role) => {
      const permissions = await db
        .select({ moduleKey: rolePermission.moduleKey, action: rolePermission.action })
        .from(rolePermission)
        .where(eq(rolePermission.roleId, role.id));
      return { ...role, permissions };
    }),
  );

  return Response.json({ data: rolesWithPermissions });
}

// POST /api/v1/admin/roles — Create custom role
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const parsed = createCustomRoleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const { permissions, ...roleData } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(customRole)
      .values({
        ...roleData,
        orgId: ctx.orgId,
        isSystem: false,
        createdBy: ctx.userId,
      })
      .returning();

    // Insert permissions
    if (permissions.length > 0) {
      await tx.insert(rolePermission).values(
        permissions.map((p) => ({
          roleId: created.id,
          moduleKey: p.moduleKey,
          action: p.action,
        })),
      );
    }

    const perms = await tx
      .select({ moduleKey: rolePermission.moduleKey, action: rolePermission.action })
      .from(rolePermission)
      .where(eq(rolePermission.roleId, created.id));

    return { ...created, permissions: perms };
  });

  return Response.json({ data: result }, { status: 201 });
}
