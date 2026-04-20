import { db, securityPostureSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { TrendPoint } from "@grc/shared";

// GET /api/v1/isms/posture/trend — 12-month trend
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

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
      overallScore: securityPostureSnapshot.overallScore,
      snapshotDate: securityPostureSnapshot.snapshotDate,
      factors: securityPostureSnapshot.factors,
      domainScores: securityPostureSnapshot.domainScores,
    })
    .from(securityPostureSnapshot)
    .where(
      and(
        eq(securityPostureSnapshot.orgId, ctx.orgId),
        gte(securityPostureSnapshot.snapshotDate, cutoffDate),
      ),
    )
    .orderBy(securityPostureSnapshot.snapshotDate);

  const trend: TrendPoint[] = snapshots.map((s) => ({
    date: s.snapshotDate,
    value: s.overallScore,
  }));

  const hasEnoughData = trend.length >= 4;

  // Quarterly comparison if enough data
  let quarterlyDelta: number | null = null;
  if (snapshots.length >= 2) {
    const latest = snapshots[snapshots.length - 1].overallScore;
    // Find snapshot closest to 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const qSnapshot = snapshots.reduce((prev, curr) => {
      const prevDiff = Math.abs(
        new Date(prev.snapshotDate).getTime() - threeMonthsAgo.getTime(),
      );
      const currDiff = Math.abs(
        new Date(curr.snapshotDate).getTime() - threeMonthsAgo.getTime(),
      );
      return currDiff < prevDiff ? curr : prev;
    });
    quarterlyDelta = latest - qSnapshot.overallScore;
  }

  return Response.json({
    data: trend,
    hasEnoughData,
    months,
    quarterlyDelta,
  });
}
