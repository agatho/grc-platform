import { db, customRole, rolePermission } from "@grc/db";
import { createCustomRoleSchema } from "@grc/shared";
import { eq, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/admin/roles — List all roles (system + custom)
export const GET = withErrorHandler(async function GET(_req: Request) {
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
        .select({
          moduleKey: rolePermission.moduleKey,
          action: rolePermission.action,
        })
        .from(rolePermission)
        .where(eq(rolePermission.roleId, role.id));
      return { ...role, permissions };
    }),
  );

  return Response.json({ data: rolesWithPermissions });
});
// POST /api/v1/admin/roles — Create custom role
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const parsed = createCustomRoleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
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
      .select({
        moduleKey: rolePermission.moduleKey,
        action: rolePermission.action,
      })
      .from(rolePermission)
      .where(eq(rolePermission.roleId, created.id));

    return { ...created, permissions: perms };
  });

  return Response.json({ data: result }, { status: 201 });
});
