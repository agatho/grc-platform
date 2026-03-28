import { db, organization } from "@grc/db";
import { eq, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { setParentOrgSchema } from "@grc/shared";

// GET /api/v1/admin/org-hierarchy — Get org tree
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const orgs = await db.select({
    id: organization.id,
    name: organization.name,
    parentOrgId: organization.parentOrgId,
    hierarchyLevel: organization.hierarchyLevel,
    hierarchyPath: organization.hierarchyPath,
  }).from(organization).orderBy(organization.hierarchyLevel);

  // Build tree structure
  const orgMap = new Map(orgs.map((o) => [o.id, { ...o, children: [] as typeof orgs }]));
  const roots: Array<typeof orgs[0] & { children: typeof orgs }> = [];
  for (const org of orgMap.values()) {
    if (org.parentOrgId && orgMap.has(org.parentOrgId)) {
      orgMap.get(org.parentOrgId)!.children.push(org);
    } else {
      roots.push(org);
    }
  }

  return Response.json({ data: roots });
}

// PUT /api/v1/admin/org-hierarchy — Set parent org for current org
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = setParentOrgSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const { parentOrgId } = body.data;

  // Validate max depth of 4
  if (parentOrgId) {
    const [parent] = await db.select({ hierarchyLevel: organization.hierarchyLevel })
      .from(organization).where(eq(organization.id, parentOrgId));
    if (!parent) {
      return Response.json({ error: "Parent organization not found" }, { status: 404 });
    }
    if ((parent.hierarchyLevel ?? 0) >= 3) {
      return Response.json({ error: "Maximum hierarchy depth of 4 exceeded" }, { status: 422 });
    }
    // Prevent cycles
    if (parentOrgId === ctx.orgId) {
      return Response.json({ error: "Cannot set self as parent" }, { status: 422 });
    }
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const level = parentOrgId ? ((await tx.select({ l: organization.hierarchyLevel }).from(organization).where(eq(organization.id, parentOrgId)))[0]?.l ?? 0) + 1 : 0;
    const [org] = await tx.update(organization)
      .set({ parentOrgId, hierarchyLevel: level })
      .where(eq(organization.id, ctx.orgId))
      .returning();
    return org;
  });

  return Response.json({ data: updated });
}
