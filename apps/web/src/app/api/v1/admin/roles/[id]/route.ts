import { db, customRole, rolePermission } from "@grc/db";
import { updateCustomRoleSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/admin/roles/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [role] = await db
    .select()
    .from(customRole)
    .where(and(eq(customRole.id, id), eq(customRole.orgId, ctx.orgId)));
  if (!role) return Response.json({ error: "Not found" }, { status: 404 });

  const permissions = await db
    .select({
      moduleKey: rolePermission.moduleKey,
      action: rolePermission.action,
    })
    .from(rolePermission)
    .where(eq(rolePermission.roleId, id));

  return Response.json({ data: { ...role, permissions } });
}

// PUT /api/v1/admin/roles/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(customRole)
    .where(and(eq(customRole.id, id), eq(customRole.orgId, ctx.orgId)));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.isSystem)
    return Response.json(
      { error: "System roles cannot be modified" },
      { status: 403 },
    );

  const parsed = updateCustomRoleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { permissions, ...updates } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(customRole)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customRole.id, id))
      .returning();

    if (permissions) {
      // Replace all permissions
      await tx.delete(rolePermission).where(eq(rolePermission.roleId, id));
      if (permissions.length > 0) {
        await tx.insert(rolePermission).values(
          permissions.map((p) => ({
            roleId: id,
            moduleKey: p.moduleKey,
            action: p.action,
          })),
        );
      }
    }

    const perms = await tx
      .select({
        moduleKey: rolePermission.moduleKey,
        action: rolePermission.action,
      })
      .from(rolePermission)
      .where(eq(rolePermission.roleId, id));

    return { ...updated, permissions: perms };
  });

  return Response.json({ data: result });
}

// DELETE /api/v1/admin/roles/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(customRole)
    .where(and(eq(customRole.id, id), eq(customRole.orgId, ctx.orgId)));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.isSystem)
    return Response.json(
      { error: "System roles cannot be deleted" },
      { status: 403 },
    );

  await withAuditContext(ctx, async (tx) => {
    await tx.delete(customRole).where(eq(customRole.id, id));
  });

  return Response.json({ data: { deleted: true } });
}
