import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { getAccessibleOrgIds } from "@grc/auth";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

interface OrgNode {
  id: string;
  name: string;
  shortName: string | null;
  type: string;
  country: string;
  isDataController: boolean;
  dpoUserId: string | null;
  dpoName: string | null;
  dpoEmail: string | null;
  supervisoryAuthority: string | null;
  children: OrgNode[];
}

type OrgRow = Record<string, unknown> & {
  id: string;
  name: string;
  short_name: string | null;
  type: string;
  country: string;
  parent_org_id: string | null;
  is_data_controller: boolean;
  dpo_user_id: string | null;
  dpo_name: string | null;
  dpo_email: string | null;
  supervisory_authority: string | null;
};

// GET /api/v1/organizations/tree — Corporate hierarchy with GDPR fields (admin)
export const GET = withErrorHandler(async function GET() {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const orgIds = getAccessibleOrgIds(ctx.session);

  // Join user table to get DPO name/email for each org node
  const orgs = await db.execute<OrgRow>(sql`
    SELECT
      o.id,
      o.name,
      o.short_name,
      o.type,
      o.country,
      o.parent_org_id,
      o.is_data_controller,
      o.dpo_user_id,
      o.supervisory_authority,
      du.name AS dpo_name,
      du.email AS dpo_email
    FROM organization o
    LEFT JOIN "user" du ON du.id = o.dpo_user_id AND du.deleted_at IS NULL
    WHERE o.deleted_at IS NULL
  `);

  // Filter to accessible orgs + their ancestors/descendants
  const accessibleSet = new Set(orgIds);
  const allOrgs = orgs.filter(
    (o) =>
      accessibleSet.has(o.id) ||
      (o.parent_org_id && accessibleSet.has(o.parent_org_id)),
  );

  function buildTree(parentId: string | null): OrgNode[] {
    return allOrgs
      .filter((o) => o.parent_org_id === parentId)
      .map((o) => ({
        id: o.id,
        name: o.name,
        shortName: o.short_name,
        type: o.type,
        country: o.country,
        isDataController: o.is_data_controller,
        dpoUserId: o.dpo_user_id,
        dpoName: o.dpo_name,
        dpoEmail: o.dpo_email,
        supervisoryAuthority: o.supervisory_authority,
        children: buildTree(o.id),
      }));
  }

  return Response.json({ data: buildTree(null) });
});
