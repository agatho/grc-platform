import { db, organization } from "@grc/db";
import { updateOrganizationSchema } from "@grc/shared";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/organizations/:id — Organization details (all roles)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [org] = await db
    .select()
    .from(organization)
    .where(and(eq(organization.id, id), isNull(organization.deletedAt)));

  if (!org) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: org });
}

// PUT /api/v1/organizations/:id — Update organization (admin)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateOrganizationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute(
      sql`UPDATE organization SET
        ${body.data.name ? sql`name = ${body.data.name},` : sql``}
        ${body.data.shortName !== undefined ? sql`short_name = ${body.data.shortName},` : sql``}
        ${body.data.type ? sql`type = ${body.data.type}::org_type,` : sql``}
        ${body.data.country ? sql`country = ${body.data.country},` : sql``}
        ${body.data.isEu !== undefined ? sql`is_eu = ${body.data.isEu},` : sql``}
        ${body.data.parentOrgId !== undefined ? sql`parent_org_id = ${body.data.parentOrgId},` : sql``}
        ${body.data.legalForm !== undefined ? sql`legal_form = ${body.data.legalForm},` : sql``}
        ${body.data.dpoName !== undefined ? sql`dpo_name = ${body.data.dpoName},` : sql``}
        ${body.data.dpoEmail !== undefined ? sql`dpo_email = ${body.data.dpoEmail},` : sql``}
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
