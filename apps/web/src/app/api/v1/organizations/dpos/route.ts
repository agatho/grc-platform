import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/organizations/dpos — List all DPOs across all accessible orgs (admin only)
export async function GET() {
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
}
