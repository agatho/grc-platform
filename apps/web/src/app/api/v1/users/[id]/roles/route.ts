import { db, userOrganizationRole, organization } from "@grc/db";
import { assignRoleSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull } from "drizzle-orm";

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
export async function GET(
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
      ),
    );

  return Response.json({
    data: rows.sort((a, b) => {
      const byOrg = (a.orgName ?? "").localeCompare(b.orgName ?? "");
      return byOrg !== 0 ? byOrg : a.role.localeCompare(b.role);
    }),
  });
}

// POST /api/v1/users/:id/roles — Assign role (admin)
export async function POST(
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
}
