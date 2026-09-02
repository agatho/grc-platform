import { db, userOrganizationRole, organization } from "@grc/db";
import { assignRoleSchema, isUserRole, USER_ROLES } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/users/:id/roles — list the roles assigned to a user
// across organizations.
//
// #WAVE11-RBAC: discovery endpoint that complements the existing
// POST. Cowork QA needs this to verify role assignments end-to-end
// without querying the DB directly. Any authenticated user can read
// their OWN roles (id === ctx.userId); only admins (in this org) can
// read someone else's.
//
// Returns { orgId, orgName, role, lineOfDefense, department,
// createdAt }, sorted by orgName then role for a stable response.
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id: userId } = await params;

  // Self-read OR admin-in-this-org. Anything else is 403.
  if (userId !== ctx.userId) {
    const [adminRow] = await db
      .select({ id: userOrganizationRole.id })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, ctx.userId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          eq(userOrganizationRole.role, "admin"),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    if (!adminRow) {
      return Response.json(
        { error: "Forbidden — admin only" },
        { status: 403 },
      );
    }
  }

  // #WP3-S02-13 — the org filter was missing entirely. For the ADMIN path on a
  // FOREIGN user this returned that user's roles, line of defense, department
  // AND the plain name of every other organization they work in. Under a
  // correctly configured production runtime (`grc_app`) RLS caught it; on an
  // instance where `APP_DATABASE_URL` is unset — which `.env.example` and CI
  // explicitly allow and nothing asserts at startup — the app runs as the
  // superuser `grc` and RLS does not apply. A defence-in-depth gap that turns
  // into a tenant breach exactly when the last remaining control is
  // misconfigured, so it is closed in the query itself.
  //
  // Self-read keeps the cross-org view (the user's own memberships are their
  // own data, and the `uor_self_read` policy already allows it).
  const isSelfRead = userId === ctx.userId;
  const rows = await db
    .select({
      orgId: userOrganizationRole.orgId,
      orgName: organization.name,
      role: userOrganizationRole.role,
      lineOfDefense: userOrganizationRole.lineOfDefense,
      department: userOrganizationRole.department,
      createdAt: userOrganizationRole.createdAt,
    })
    .from(userOrganizationRole)
    .leftJoin(organization, eq(organization.id, userOrganizationRole.orgId))
    .where(
      and(
        eq(userOrganizationRole.userId, userId),
        isNull(userOrganizationRole.deletedAt),
        ...(isSelfRead ? [] : [eq(userOrganizationRole.orgId, ctx.orgId)]),
      ),
    );

  return Response.json({
    data: rows.sort((a, b) => {
      const byOrg = (a.orgName ?? "").localeCompare(b.orgName ?? "");
      return byOrg !== 0 ? byOrg : a.role.localeCompare(b.role);
    }),
  });
});
// POST /api/v1/users/:id/roles — Assign role (admin)
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: userId } = await params;
  const body = assignRoleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // #WP3-S02-02 — this is the endpoint the audit used to reproduce the
  // privilege escalation: `withAuth("admin")` was satisfied by ANY custom role
  // via the module- and action-blind fallback in `withAuth`, so a `viewer` with
  // a "read Academy" custom role could POST `{"role":"admin"}` for their own
  // user id. The fallback is fixed centrally (apps/web/src/lib/api.ts); the two
  // checks below are the local defence in depth.
  //
  // 1. Nobody grants themselves a role. Role assignment is an administrative
  //    act on someone else — an admin who needs a second role asks a second
  //    admin, exactly like every other four-eyes control in this product.
  if (userId === ctx.userId) {
    return Response.json(
      {
        error:
          "You cannot assign a role to yourself. A second administrator must do it.",
      },
      { status: 403 },
    );
  }

  // 2. Only an admin of THIS org may assign here, and the role must be a known
  //    platform role (the DB enum and the TS union are aligned by S02-14, so an
  //    unknown value is a schema drift, not a user error).
  if (!isUserRole(body.data.role)) {
    return Response.json(
      { error: `Unknown role '${body.data.role}'`, allowed: USER_ROLES },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(userOrganizationRole)
      .values({
        userId,
        orgId: ctx.orgId,
        role: body.data.role,
        lineOfDefense: body.data.lineOfDefense,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
