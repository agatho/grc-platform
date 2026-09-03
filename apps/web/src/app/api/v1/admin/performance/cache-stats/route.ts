import { withAuth } from "@/lib/api";
import type { CacheStatsResponse } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/admin/performance/cache-stats — Redis cache hit/miss stats
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  // Return cache statistics
  // In production, this would read from a shared DashboardCache instance
  // For now, we return the structure with data from Redis info
  const stats: CacheStatsResponse = {
    totalKeys: 0,
    totalHits: 0,
    totalMisses: 0,
    overallHitRate: 0,
    memoryUsedMb: 0,
    entries: [],
  };

  try {
    // Try to get stats from Redis if available
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      // We'd normally use the shared cache instance here.
      // For the API, we report the structure.
      stats.totalKeys = 0;
      stats.overallHitRate = 0;
    }
  } catch {
    // Redis not available — return empty stats
  }

  return Response.json({ data: stats });
});
