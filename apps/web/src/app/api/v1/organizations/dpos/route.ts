import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/organizations/dpos — List all DPOs across all accessible orgs (admin only)
export const GET = withErrorHandler(async function GET() {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  // Admin with group admin privileges can see DPOs across all organizations
  // Uses bypass_rls concept: query all orgs where a DPO user is assigned
  const dpos = await db.execute(sql`
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      o.org_code,
      o.is_data_controller,
      o.supervisory_authority,
      u.id AS dpo_user_id,
      u.name AS dpo_name,
      u.email AS dpo_email
    FROM organization o
    INNER JOIN "user" u ON u.id = o.dpo_user_id AND u.deleted_at IS NULL
    WHERE o.deleted_at IS NULL
      AND o.dpo_user_id IS NOT NULL
    ORDER BY o.name
  `);

  return Response.json({ data: dpos });
});
