import {
  db,
  esgTarget,
  esgMeasurement,
  esrsMetric,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { computeTargetProgress } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/esg/targets/[id]/progress — Progress vs baseline
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [target] = await db
    .select({
      id: esgTarget.id,
      metricId: esgTarget.metricId,
      metricName: esrsMetric.name,
      name: esgTarget.name,
      baselineYear: esgTarget.baselineYear,
      baselineValue: esgTarget.baselineValue,
      targetYear: esgTarget.targetYear,
      targetValue: esgTarget.targetValue,
      targetType: esgTarget.targetType,
      sbtiAligned: esgTarget.sbtiAligned,
      status: esgTarget.status,
    })
    .from(esgTarget)
    .leftJoin(esrsMetric, eq(esgTarget.metricId, esrsMetric.id))
    .where(
      and(eq(esgTarget.id, id), eq(esgTarget.orgId, ctx.orgId)),
    );

  if (!target) {
    return Response.json({ error: "Target not found" }, { status: 404 });
  }

  // Get latest measurement for this metric
  const [latestMeasurement] = await db
    .select({
      value: esgMeasurement.value,
      periodEnd: esgMeasurement.periodEnd,
      dataQuality: esgMeasurement.dataQuality,
    })
    .from(esgMeasurement)
    .where(
      and(
        eq(esgMeasurement.metricId, target.metricId),
        eq(esgMeasurement.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(esgMeasurement.periodEnd))
    .limit(1);

  const baseline = parseFloat(String(target.baselineValue));
  const targetVal = parseFloat(String(target.targetValue));
  const current = latestMeasurement
    ? parseFloat(String(latestMeasurement.value))
    : baseline;

  const progress = computeTargetProgress(baseline, current, targetVal);

  // Get all measurements for trend
  const measurements = await db
    .select({
      value: esgMeasurement.value,
      periodStart: esgMeasurement.periodStart,
      periodEnd: esgMeasurement.periodEnd,
    })
    .from(esgMeasurement)
    .where(
      and(
        eq(esgMeasurement.metricId, target.metricId),
        eq(esgMeasurement.orgId, ctx.orgId),
      ),
    )
    .orderBy(esgMeasurement.periodStart);

  return Response.json({
    data: {
      target,
      progress,
      latestMeasurement: latestMeasurement ?? null,
      trend: measurements.map((m) => ({
        value: parseFloat(String(m.value)),
        periodStart: m.periodStart,
        periodEnd: m.periodEnd,
      })),
    },
  });
}
