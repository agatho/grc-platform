import { db } from "@grc/db";
import { assignDpoSchema } from "@grc/shared";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/organizations/:id/dpo — Assign DPO to organization (admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;
  const body = assignDpoSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { dpoUserId } = body.data;

  // Validate user has 'dpo' role in this organization
  const dpoRoles = await db.execute(sql`
    SELECT uor.id FROM user_organization_role uor
    WHERE uor.user_id = ${dpoUserId}
      AND uor.org_id = ${orgId}
      AND uor.role = 'dpo'
      AND uor.deleted_at IS NULL
    LIMIT 1
  `);

  if (!dpoRoles[0]) {
    return Response.json(
      { error: "User does not have 'dpo' role in this organization" },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Update organization.dpoUserId
    const orgRows = await tx.execute(sql`
      UPDATE organization
      SET dpo_user_id = ${dpoUserId}, updated_by = ${ctx.userId}
      WHERE id = ${orgId} AND deleted_at IS NULL
      RETURNING id, name, dpo_user_id
    `);

    if (!orgRows[0]) return null;

    // Get org name for notification
    const orgName = (orgRows[0] as Record<string, unknown>).name as string;

    // Create notification for the assigned DPO
    await tx.execute(sql`
      INSERT INTO notification (
        user_id, org_id, type, title, message,
        channel, template_key, template_data,
        entity_type, entity_id, created_by
      )
      VALUES (
        ${dpoUserId},
        ${orgId},
        'task_assigned',
        ${"DPO Assignment: " + orgName},
        ${"You have been assigned as Data Protection Officer for " + orgName},
        'both',
        'dpo_assigned',
        ${JSON.stringify({ orgId, orgName })}::jsonb,
        'organization',
        ${orgId},
        ${ctx.userId}
      )
    `);

    return orgRows[0];
  });

  if (!result) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}
