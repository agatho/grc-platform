import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/admin/scim/stats — SCIM dashboard statistics
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const [stats] = await db.execute<{
    last_sync: string | null;
    synced_users: number;
    error_count: number;
    active_tokens: number;
  }>(sql`
    SELECT
      (SELECT max(created_at) FROM scim_sync_log WHERE org_id = ${ctx.orgId}) AS last_sync,
      (SELECT count(DISTINCT user_id)::int FROM scim_sync_log WHERE org_id = ${ctx.orgId} AND status = 'success') AS synced_users,
      (SELECT count(*)::int FROM scim_sync_log WHERE org_id = ${ctx.orgId} AND status = 'error' AND created_at > now() - interval '24 hours') AS error_count,
      (SELECT count(*)::int FROM scim_token WHERE org_id = ${ctx.orgId} AND is_active = true) AS active_tokens
  `);

  return Response.json({
    data: {
      lastSync: (stats as any)?.last_sync ?? null,
      syncedUsers: (stats as any)?.synced_users ?? 0,
      errorCount: (stats as any)?.error_count ?? 0,
      activeTokens: (stats as any)?.active_tokens ?? 0,
    },
  });
});
