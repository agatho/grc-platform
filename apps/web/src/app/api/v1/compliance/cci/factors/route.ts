import { db, complianceCultureSnapshot } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { CCI_FACTOR_KEYS, getPreviousPeriod } from "@grc/shared";
import type {
  CCIFactorsResponse,
  CCIFactorDetail,
  CCIFactorKey,
  CCIFactorScores,
  CCIFactorWeights,
  CCIRawMetrics,
  CCIRawMetricDetail,
  CCITrend,
} from "@grc/shared";

// GET /api/v1/compliance/cci/factors — Detailed factor breakdown
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  // Get latest org-wide snapshot
  const [latest] = await db
    .select()
    .from(complianceCultureSnapshot)
    .where(
      and(
        eq(complianceCultureSnapshot.orgId, ctx.orgId),
        isNull(complianceCultureSnapshot.orgEntityId),
      ),
    )
    .orderBy(desc(complianceCultureSnapshot.period))
    .limit(1);

  if (!latest) {
    return Response.json({
      data: {
        factors: [],
        overallScore: 0,
        period: "",
      } satisfies CCIFactorsResponse,
    });
  }

  // Get previous for trend per factor
  const previousPeriod = getPreviousPeriod(latest.period);
  const [previous] = await db
    .select()
    .from(complianceCultureSnapshot)
    .where(
      and(
        eq(complianceCultureSnapshot.orgId, ctx.orgId),
        isNull(complianceCultureSnapshot.orgEntityId),
        eq(complianceCultureSnapshot.period, previousPeriod),
      ),
    )
    .limit(1);

  const factorScores = latest.factorScores as CCIFactorScores;
  const factorWeights = latest.factorWeights as CCIFactorWeights;
  const rawMetrics = latest.rawMetrics as CCIRawMetrics;
  const prevFactorScores = previous
    ? (previous.factorScores as CCIFactorScores)
    : null;

  const factors: CCIFactorDetail[] = CCI_FACTOR_KEYS.map((key) => {
    const score = factorScores[key] ?? 0;
    const weight = factorWeights[key] ?? 0;
    const prevScore = prevFactorScores?.[key] ?? null;
    const delta = prevScore !== null ? score - prevScore : null;
    let trend: CCITrend | null = null;
    if (delta !== null) {
      trend = Math.abs(delta) < 1 ? "stable" : delta > 0 ? "up" : "down";
    }

    return {
      key,
      score,
      weight,
      weightedContribution: Math.round(score * weight * 100) / 100,
      rawMetric: rawMetrics[key] ?? { total: 0, successful: 0 },
      trend,
      previousScore: prevScore,
    };
  });

  const response: CCIFactorsResponse = {
    factors,
    overallScore: Number(latest.overallScore),
    period: latest.period,
  };

  return Response.json({ data: response });
}
