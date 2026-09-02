import { db, apiUsageLog } from "@grc/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/api-keys/usage/stats — Aggregated usage statistics
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [stats] = await db
    .select({
      totalRequests: sql<number>`count(*)`,
      avgResponseTime: sql<number>`avg(${apiUsageLog.responseTimeMs})`,
      errorCount: sql<number>`count(*) FILTER (WHERE ${apiUsageLog.statusCode} >= 400)`,
      successCount: sql<number>`count(*) FILTER (WHERE ${apiUsageLog.statusCode} < 400)`,
    })
    .from(apiUsageLog)
    .where(
      and(eq(apiUsageLog.orgId, ctx.orgId), gte(apiUsageLog.createdAt, since)),
    );

  const topPaths = await db
    .select({
      path: apiUsageLog.path,
      method: apiUsageLog.method,
      count: sql<number>`count(*)`,
      avgResponseTime: sql<number>`avg(${apiUsageLog.responseTimeMs})`,
    })
    .from(apiUsageLog)
    .where(
      and(eq(apiUsageLog.orgId, ctx.orgId), gte(apiUsageLog.createdAt, since)),
    )
    .groupBy(apiUsageLog.path, apiUsageLog.method)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  return Response.json({
    data: {
      ...stats,
      successRate:
        stats.totalRequests > 0
          ? (
              (Number(stats.successCount) / Number(stats.totalRequests)) *
              100
            ).toFixed(1)
          : "0",
      topPaths,
      period: { days, since: since.toISOString() },
    },
  });
});
