import { db, accessLog } from "@grc/db";
import { and, desc, eq, sql, count } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/access-log — Login events (org admin, org-scoped)
//
// F-03 (MEDIUM): previously returned EVERY tenant's login attempts / IPs /
// emails to any org admin, because access_log had no org_id and the query
// was unfiltered. It is now scoped to the caller's org: `org_id = ctx.orgId`.
//
// Org-less rows (org_id IS NULL — failed logins of unknown emails, multi-org
// users) are intentionally NOT returned here: the eq() filter excludes NULL.
// There is no cross-tenant platform-admin role in the standard RBAC model
// (`admin` is org-scoped), so those events are reviewed at the DB level only,
// consistent with the append-only-log design shared with audit_log.
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions = [eq(accessLog.orgId, ctx.orgId)];

  const eventType = searchParams.get("event_type");
  if (eventType) {
    conditions.push(
      sql`${accessLog.eventType} = ${eventType}::access_event_type`,
    );
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(accessLog)
      .where(where)
      .orderBy(desc(accessLog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(accessLog).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
