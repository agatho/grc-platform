import { randomUUID } from "node:crypto";
import {
  db,
  organization,
  userOrganizationRole,
  moduleDefinition,
  moduleConfig,
  toNumericInput,
} from "@grc/db";
import { createOrganizationSchema } from "@grc/shared";
import { eq, and, isNull, inArray, count, or, sql } from "drizzle-orm";
import { getAccessibleOrgIds } from "@grc/auth";
import {
  withAuth,
  withAuditContext,
  isPlatformAdmin,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/organizations — List organizations (admin)
export const GET = withErrorHandler(async function GET(req: Request) {
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
});

// POST /api/v1/organizations — Create organization
//
// [ARCTOS-FULL-2026-08-31 / Restdefekte · O-2]
// Who may create an organization is decided in migration 0438 and enforced by
// the RLS policy `organization_create`. This handler applies the SAME rule
// before touching the database, so the caller gets a 403 problem+json with a
// reason instead of an opaque 42501 out of PostgreSQL:
//
//   * platform administrator (table `platform_admin`, WP3/S02-03)
//         → may create any organization, including a new root tenant;
//   * organization administrator
//         → may create a SUBSIDIARY of the organization they are acting in,
//           i.e. `parentOrgId` must equal the active org.
//
// The database policy is the control; this check is the error message. Never
// the other way round — removing it would change the status code, not the
// authorization.
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createOrganizationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const platformAdmin = await isPlatformAdmin(ctx.userId);
  if (!platformAdmin && body.data.parentOrgId !== ctx.orgId) {
    return Response.json(
      {
        type: "https://arctos.charliehund.de/errors/organization-create-scope",
        title: "Organization creation out of scope",
        status: 403,
        detail:
          "Creating a new top-level tenant is a platform-wide action and " +
          "requires a platform administrator. As an organization " +
          "administrator you may only create a subsidiary of the " +
          "organization you are currently acting in — send parentOrgId " +
          "equal to your active organization.",
        activeOrgId: ctx.orgId,
      },
      { status: 403, headers: { "content-type": "application/problem+json" } },
    );
  }

  // The row id is generated here rather than by the column default so the
  // handler can (a) INSERT without RETURNING and (b) read the row back under
  // the new organization's own context. `INSERT … RETURNING` would have to
  // satisfy the SELECT policy `org_isolation_select` (`id = current_org`) for
  // the brand-new row as well, which by definition it cannot — the same
  // shape of defect as O-2 itself, one statement later.
  const newOrgId = randomUUID();

  const created = await withAuditContext(ctx, async (tx) => {
    // Deliberately still under the CALLER's org context: this is the INSERT
    // that `organization_create` has to authorize.
    await tx.insert(organization).values({
      ...body.data,
      id: newOrgId,
      revenueEur: toNumericInput(body.data.revenueEur),
      totalAssetsEur: toNumericInput(body.data.totalAssetsEur),
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // From here on every row belongs to the NEW organization, so the org
    // context has to be the new one — its RLS policies (`…_tenant_insert`,
    // `WITH CHECK org_id = current_org`) are what makes the writes below
    // legal, and they are the correct owner of these rows. Transaction-local
    // (`set_config(…, true)`), so it is gone at COMMIT.
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${newOrgId}, true)`,
    );

    // Grant the creating user admin on the new org so it appears in their
    // accessible-org list, the switcher, and subsequent list/tree queries.
    // Without this, newly-created orgs are invisible to their creator.
    await tx.insert(userOrganizationRole).values({
      userId: ctx.userId,
      orgId: newOrgId,
      role: "admin",
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // Auto-activate all "included" modules for the new org. Without this,
    // ModuleGate blocks every page with a "Modul aktivieren" screen, because
    // module_config is otherwise only populated via the demo seed.
    await tx.execute(sql`
      INSERT INTO module_config (org_id, module_key, ui_status, is_data_active, enabled_at, enabled_by, created_by, updated_by)
      SELECT ${newOrgId}::uuid, module_key, 'enabled', true, NOW(), ${ctx.userId}::uuid, ${ctx.userId}::uuid, ${ctx.userId}::uuid
      FROM module_definition
      WHERE license_tier = 'included' AND is_active_in_platform = true
      ON CONFLICT (org_id, module_key) DO NOTHING
    `);

    const [row] = await tx
      .select()
      .from(organization)
      .where(eq(organization.id, newOrgId));
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
