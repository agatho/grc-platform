import { db, apiUsageLog } from "@grc/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/api-keys/usage/stats — Aggregated usage statistics
export async function GET(req: Request) {
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
}
