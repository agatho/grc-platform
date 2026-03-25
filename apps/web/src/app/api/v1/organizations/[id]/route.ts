import { db, organization, user, userOrganizationRole } from "@grc/db";
import { updateOrganizationSchema, updateOrganizationGdprSchema } from "@grc/shared";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/organizations/:id — Organization details incl. GDPR fields (all roles)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Join user table to resolve DPO name/email when dpoUserId is set
  const rows = await db.execute(sql`
    SELECT o.*,
           du.name AS dpo_user_name,
           du.email AS dpo_user_email
    FROM organization o
    LEFT JOIN "user" du ON du.id = o.dpo_user_id AND du.deleted_at IS NULL
    WHERE o.id = ${id} AND o.deleted_at IS NULL
  `);

  if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: rows[0] });
}

// PUT /api/v1/organizations/:id — Update organization incl. GDPR fields (admin)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const rawBody = await req.json();

  // Validate base org fields
  const baseResult = updateOrganizationSchema.safeParse(rawBody);
  if (!baseResult.success) {
    return Response.json(
      { error: "Validation failed", details: baseResult.error.flatten() },
      { status: 422 },
    );
  }

  // Validate GDPR fields
  const gdprResult = updateOrganizationGdprSchema.safeParse(rawBody);
  if (!gdprResult.success) {
    return Response.json(
      { error: "Validation failed", details: gdprResult.error.flatten() },
      { status: 422 },
    );
  }

  const base = baseResult.data;
  const gdpr = gdprResult.data;

  // If dpoUserId is provided, validate the user has 'dpo' role in this org
  if (gdpr.dpoUserId) {
    const dpoRoles = await db.execute(sql`
      SELECT uor.id FROM user_organization_role uor
      WHERE uor.user_id = ${gdpr.dpoUserId}
        AND uor.org_id = ${id}
        AND uor.role = 'dpo'
        AND uor.deleted_at IS NULL
      LIMIT 1
    `);
    if (!dpoRoles[0]) {
      return Response.json(
        { error: "dpoUserId must reference a user with 'dpo' role in this organization" },
        { status: 422 },
      );
    }
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute(
      sql`UPDATE organization SET
        ${base.name ? sql`name = ${base.name},` : sql``}
        ${base.shortName !== undefined ? sql`short_name = ${base.shortName},` : sql``}
        ${base.type ? sql`type = ${base.type}::org_type,` : sql``}
        ${base.country ? sql`country = ${base.country},` : sql``}
        ${base.isEu !== undefined ? sql`is_eu = ${base.isEu},` : sql``}
        ${base.parentOrgId !== undefined ? sql`parent_org_id = ${base.parentOrgId},` : sql``}
        ${base.legalForm !== undefined ? sql`legal_form = ${base.legalForm},` : sql``}
        ${base.dpoName !== undefined ? sql`dpo_name = ${base.dpoName},` : sql``}
        ${base.dpoEmail !== undefined ? sql`dpo_email = ${base.dpoEmail},` : sql``}
        ${gdpr.orgCode !== undefined ? sql`org_code = ${gdpr.orgCode},` : sql``}
        ${gdpr.isDataController !== undefined ? sql`is_data_controller = ${gdpr.isDataController},` : sql``}
        ${gdpr.dpoUserId !== undefined ? sql`dpo_user_id = ${gdpr.dpoUserId},` : sql``}
        ${gdpr.supervisoryAuthority !== undefined ? sql`supervisory_authority = ${gdpr.supervisoryAuthority},` : sql``}
        ${gdpr.dataResidency !== undefined ? sql`data_residency = ${gdpr.dataResidency},` : sql``}
        ${gdpr.gdprSettings !== undefined ? sql`gdpr_settings = ${JSON.stringify(gdpr.gdprSettings)}::jsonb,` : sql``}
        updated_by = ${ctx.userId}
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *`,
    );
    return rows[0];
  });

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: updated });
}

// DELETE /api/v1/organizations/:id — Soft delete (admin)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute(
      sql`UPDATE organization
          SET deleted_at = now(), deleted_by = ${ctx.userId}, updated_by = ${ctx.userId}
          WHERE id = ${id} AND deleted_at IS NULL
          RETURNING id`,
    );
    return rows[0];
  });

  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id, deleted: true } });
}
