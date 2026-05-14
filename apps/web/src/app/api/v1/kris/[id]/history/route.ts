// GET /api/v1/kris/[id]/history?from=ISO&to=ISO&limit=N
//
// #WAVE15-P3-KRI-HISTORY: Wave-14 QA hit a 404 here. /measurements
// already serves the raw measurement rows in reverse-chronological,
// paginated order — useful for editing or auditing a single value but
// not for charting. /history reshapes the same data for time-series
// consumption: a flat ascending array of { timestamp, value }, capped
// to a sensible default so a year-old KRI with hourly samples doesn't
// hand the chart 8.7k points to plot.

import { db, kri, kriMeasurement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { withAuth, paginate } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = { params: Promise<{ id: string }> };

const DEFAULT_HISTORY_POINTS = 200;

export const GET = withErrorHandler<RouteParams>(async function GET(
  req: Request,
  { params },
) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  // Verify KRI exists in this org (avoids leaking measurements via a
  // cross-org id guess — RLS would catch it too but a clean 404 is the
  // friendlier signal).
  const [kriRow] = await db
    .select({
      id: kri.id,
      name: kri.name,
      unit: kri.unit,
      direction: kri.direction,
      thresholdGreen: kri.thresholdGreen,
      thresholdYellow: kri.thresholdYellow,
      thresholdRed: kri.thresholdRed,
    })
    .from(kri)
    .where(and(eq(kri.id, id), eq(kri.orgId, ctx.orgId)));

  if (!kriRow) {
    return Response.json({ error: "KRI not found" }, { status: 404 });
  }

  // paginate() supplies the cap-100 limit + searchParams; we just
  // borrow the from/to + a default-200 cap on points (uses the helper
  // for the sortDir/searchParams plumbing).
  const { searchParams } = paginate(req);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const limitParam = searchParams.get("points");

  const points = Math.min(
    1000,
    Math.max(1, Number(limitParam) || DEFAULT_HISTORY_POINTS),
  );

  const conds = [
    eq(kriMeasurement.kriId, id),
    eq(kriMeasurement.orgId, ctx.orgId),
  ];
  if (fromParam)
    conds.push(gte(kriMeasurement.measuredAt, new Date(fromParam)));
  if (toParam) conds.push(lte(kriMeasurement.measuredAt, new Date(toParam)));

  const rows = await db
    .select({
      timestamp: kriMeasurement.measuredAt,
      value: kriMeasurement.value,
      source: kriMeasurement.source,
    })
    .from(kriMeasurement)
    .where(and(...conds))
    .orderBy(asc(kriMeasurement.measuredAt))
    .limit(points);

  return Response.json({
    data: {
      kri: kriRow,
      window: {
        from: fromParam ?? rows[0]?.timestamp?.toISOString() ?? null,
        to: toParam ?? rows[rows.length - 1]?.timestamp?.toISOString() ?? null,
        cap: points,
      },
      series: rows.map((r) => ({
        timestamp: r.timestamp.toISOString(),
        value: Number(r.value),
        source: r.source,
      })),
    },
  });
});
