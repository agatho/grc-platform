import { db, user, userOrganizationRole } from "@grc/db";
import { eq, and, isNull, count, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/users — List users of current org (admin)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  // Users in the current org with their roles
  const items = await db.execute(sql`
    SELECT DISTINCT u.id, u.email, u.name, u.avatar_url, u.language,
           u.is_active, u.last_login_at, u.created_at
    FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE uor.org_id = ${ctx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
    ORDER BY u.name
    LIMIT ${limit} OFFSET ${offset}
  `);

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
