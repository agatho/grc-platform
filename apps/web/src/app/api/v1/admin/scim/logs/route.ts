import { db, scimSyncLog } from "@grc/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/admin/scim/logs — SCIM sync log with filtering
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const action = searchParams.get("action");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Build dynamic conditions
  const conditions: ReturnType<typeof sql>[] = [sql`ssl.org_id = ${ctx.orgId}`];

  if (action) {
    conditions.push(sql`ssl.action = ${action}`);
  }
  if (status) {
    conditions.push(sql`ssl.status = ${status}`);
  }
  if (from) {
    conditions.push(sql`ssl.created_at >= ${from}::timestamptz`);
  }
  if (to) {
    conditions.push(sql`ssl.created_at <= ${to}::timestamptz`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const items = await db.execute(sql`
    SELECT ssl.id, ssl.action, ssl.status, ssl.scim_resource_id,
           ssl.user_id, ssl.user_email, ssl.error_message, ssl.created_at
    FROM scim_sync_log ssl
    WHERE ${whereClause}
    ORDER BY ssl.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const [{ total }] = await db.execute<{ total: number }>(sql`
    SELECT count(*)::int AS total
    FROM scim_sync_log ssl
    WHERE ${whereClause}
  `);

  return paginatedResponse(items as any[], total, page, limit);
});
