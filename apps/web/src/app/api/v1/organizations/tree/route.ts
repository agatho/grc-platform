import { db, organization } from "@grc/db";
import { isNull, inArray } from "drizzle-orm";
import { getAccessibleOrgIds } from "@grc/auth";
import { withAuth } from "@/lib/api";

interface OrgNode {
  id: string;
  name: string;
  shortName: string | null;
  type: string;
  country: string;
  children: OrgNode[];
}

// GET /api/v1/organizations/tree — Corporate hierarchy (admin)
export async function GET() {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const orgIds = getAccessibleOrgIds(ctx.session);

  const orgs = await db
    .select()
    .from(organization)
    .where(isNull(organization.deletedAt));

  // Filter to accessible orgs + their ancestors/descendants
  const accessibleSet = new Set(orgIds);
  const allOrgs = orgs.filter(
    (o) => accessibleSet.has(o.id) || (o.parentOrgId && accessibleSet.has(o.parentOrgId)),
  );

  function buildTree(parentId: string | null): OrgNode[] {
    return allOrgs
      .filter((o) => o.parentOrgId === parentId)
      .map((o) => ({
        id: o.id,
        name: o.name,
        shortName: o.shortName,
        type: o.type,
        country: o.country,
        children: buildTree(o.id),
      }));
  }

  return Response.json({ data: buildTree(null) });
}
