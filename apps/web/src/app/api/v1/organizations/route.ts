import { db, organization, userOrganizationRole, moduleDefinition, moduleConfig } from "@grc/db";
import { createOrganizationSchema } from "@grc/shared";
import { eq, and, isNull, inArray, count, or, sql } from "drizzle-orm";
import { getAccessibleOrgIds } from "@grc/auth";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/organizations — List organizations (admin)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const orgIds = getAccessibleOrgIds(ctx.session);
  const { page, limit, offset } = paginate(req);

  // Match the tree endpoint's visibility rules: a user who has a role on an
  // org also sees its direct subsidiaries. Without this, the list view hides
  // subsidiaries that the tree view shows (and vice-versa).
  const visibility =
    orgIds.length > 0
      ? or(
          inArray(organization.id, orgIds),
          inArray(organization.parentOrgId, orgIds),
        )
      : inArray(organization.id, orgIds);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(organization)
      .where(and(isNull(organization.deletedAt), visibility))
      .orderBy(organization.name)
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(organization)
      .where(and(isNull(organization.deletedAt), visibility)),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/organizations — Create organization (admin)
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createOrganizationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(organization)
      .values({ ...body.data, createdBy: ctx.userId, updatedBy: ctx.userId })
      .returning();

    // Grant the creating user admin on the new org so it appears in their
    // accessible-org list, the switcher, and subsequent list/tree queries.
    // Without this, newly-created orgs are invisible to their creator.
    await tx.insert(userOrganizationRole).values({
      userId: ctx.userId,
      orgId: row.id,
      role: "admin",
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // Auto-activate all "included" modules for the new org. Without this,
    // ModuleGate blocks every page with a "Modul aktivieren" screen, because
    // module_config is otherwise only populated via the demo seed.
    await tx.execute(sql`
      INSERT INTO module_config (org_id, module_key, ui_status, is_data_active, enabled_at, enabled_by, created_by, updated_by)
      SELECT ${row.id}::uuid, module_key, 'enabled', true, NOW(), ${ctx.userId}::uuid, ${ctx.userId}::uuid, ${ctx.userId}::uuid
      FROM module_definition
      WHERE license_tier = 'included' AND is_active_in_platform = true
      ON CONFLICT (org_id, module_key) DO NOTHING
    `);

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
