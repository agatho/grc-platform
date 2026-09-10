import { db, securityPostureSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { TrendPoint } from "@grc/shared";
import { z } from "zod";
import { parseQueryParams, intQueryParam } from "@/lib/query-schema";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const postureTrendQuerySchema = z.object({
  // Was `Math.min(24, Math.max(1, Number(...) || 12))` — silently coerced
  // garbage to 12. Now an explicit 422 for an out-of-range value.
  months: intQueryParam(1, 24, 12),
});

// GET /api/v1/isms/posture/trend — 12-month trend
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const q = parseQueryParams(postureTrendQuerySchema, url.searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const months = q.data.months;

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
});
