import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/users — List users of current org.
//
// Reachable by every role that needs to pick a user (owner-pickers in the
// risk/control/finding wizards, assignment dropdowns in workflows, etc.).
// Restricting this to `admin` previously broke the owner dropdown for
// risk_manager / control_owner / process_owner authors (QA-008, 2026-05-10).
//
// Sensitive admin-only fields (`is_active`, `last_login_at`) are only
// returned when the caller is an admin; everyone else gets the picker
// projection (id / name / email / language / avatar).
export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "dpo",
  );
  if (ctx instanceof Response) return ctx;

  const isAdmin = !!ctx.session.user.roles?.some(
    (r) => r.orgId === ctx.orgId && r.role === "admin",
  );

  const { page, limit, offset } = paginate(req);

  const items = await db.execute(
    isAdmin
      ? sql`
        SELECT DISTINCT u.id, u.email, u.name, u.avatar_url, u.language,
               u.is_active, u.last_login_at, u.created_at
        FROM "user" u
        JOIN user_organization_role uor ON uor.user_id = u.id
        WHERE uor.org_id = ${ctx.orgId}
          AND uor.deleted_at IS NULL
          AND u.deleted_at IS NULL
        ORDER BY u.name
        LIMIT ${limit} OFFSET ${offset}
      `
      : sql`
        SELECT DISTINCT u.id, u.email, u.name, u.avatar_url, u.language
        FROM "user" u
        JOIN user_organization_role uor ON uor.user_id = u.id
        WHERE uor.org_id = ${ctx.orgId}
          AND uor.deleted_at IS NULL
          AND u.deleted_at IS NULL
          AND u.is_active = true
        ORDER BY u.name
        LIMIT ${limit} OFFSET ${offset}
      `,
  );

  const [{ total }] = await db.execute<{ total: number }>(sql`
    SELECT count(DISTINCT u.id)::int AS total
    FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE uor.org_id = ${ctx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
  `);

  return paginatedResponse(items, total, page, limit);
}
