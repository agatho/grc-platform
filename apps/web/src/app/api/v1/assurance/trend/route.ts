import { db, assuranceScoreSnapshot } from "@grc/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { AssuranceTrendData, TrendPoint } from "@grc/shared";

// GET /api/v1/assurance/trend — 12-month trend per module
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const months = Math.min(
    24,
    Math.max(1, Number(url.searchParams.get("months")) || 12),
  );

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffDate = cutoff.toISOString().split("T")[0];

  const snapshots = await db
    .select({
      module: assuranceScoreSnapshot.module,
      score: assuranceScoreSnapshot.score,
      snapshotDate: assuranceScoreSnapshot.snapshotDate,
    })
    .from(assuranceScoreSnapshot)
    .where(
      and(
        eq(assuranceScoreSnapshot.orgId, ctx.orgId),
        gte(assuranceScoreSnapshot.snapshotDate, cutoffDate),
      ),
    )
    .orderBy(
      assuranceScoreSnapshot.module,
      assuranceScoreSnapshot.snapshotDate,
    );

  // Group by module
  const moduleMap = new Map<string, TrendPoint[]>();
  for (const snap of snapshots) {
    if (!moduleMap.has(snap.module)) {
      moduleMap.set(snap.module, []);
    }
    moduleMap.get(snap.module)!.push({
      date: snap.snapshotDate,
      value: snap.score,
    });
  }

  const trend: AssuranceTrendData[] = Array.from(moduleMap.entries()).map(
    ([module, points]) => ({
      module,
      trend: points,
    }),
  );

  const hasEnoughData = trend.some((t) => t.trend.length >= 4);

  return Response.json({
    data: trend,
    hasEnoughData,
    months,
  });
}
