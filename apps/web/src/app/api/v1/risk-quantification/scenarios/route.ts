// GET /api/v1/risk-quantification/scenarios — list FAIR-quantified risks.
//
// #WAVE14-CROSS-05: a risk-quantification scenario in our model is a
// (risk × FAIR parameters × latest simulation) triple. The other
// /risk-quantification routes (var-calculations, sensitivity) all need
// scenarios to exist first; this is the discovery endpoint that lists
// what's actually been quantified.
//
// Implementation: every risk that has a fair_parameters row counts as a
// scenario. We left-join the latest fair_simulation_result for the
// headline ALE numbers (P50 + mean) so a list view doesn't have to
// fan-out N requests for the percentiles.
//
// "Latest" = newest computed_at; we pick it via a correlated subquery
// so the join is one row per risk, not one row per simulation history.

import { db, risk, fairParameters, fairSimulationResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // FAIR scenarios live in the ERM domain (each row references a risk).
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  // Total — one row per risk that has parameters configured.
  const [{ total }] = await db
    .select({
      total: sql<number>`count(distinct ${fairParameters.riskId})::int`,
    })
    .from(fairParameters)
    .innerJoin(risk, eq(risk.id, fairParameters.riskId))
    .where(
      and(
        eq(fairParameters.orgId, ctx.orgId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  // Latest result per risk via correlated subquery. We grab P50 + mean
  // because that's what dashboard cards show; percentile detail is
  // available through /risk-quantification/var-calculations/[riskId].
  const latestResultId = sql<string>`(
    SELECT fsr.id
    FROM ${fairSimulationResult} fsr
    WHERE fsr.risk_id = ${risk.id}
      AND fsr.org_id = ${ctx.orgId}
    ORDER BY fsr.computed_at DESC NULLS LAST
    LIMIT 1
  )`;

  const rows = await db
    .select({
      riskId: risk.id,
      riskTitle: risk.title,
      riskCategory: risk.riskCategory,
      riskStatus: risk.status,
      parametersId: fairParameters.id,
      lefMostLikely: fairParameters.lefMostLikely,
      lmMostLikely: fairParameters.lmMostLikely,
      latestResultId: latestResultId,
      latestAleP50: fairSimulationResult.aleP50,
      latestAleMean: fairSimulationResult.aleMean,
      latestComputedAt: fairSimulationResult.computedAt,
      latestStatus: fairSimulationResult.status,
    })
    .from(fairParameters)
    .innerJoin(risk, eq(risk.id, fairParameters.riskId))
    .leftJoin(fairSimulationResult, eq(fairSimulationResult.id, latestResultId))
    .where(
      and(
        eq(fairParameters.orgId, ctx.orgId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    )
    .orderBy(desc(fairSimulationResult.aleP50))
    .limit(limit)
    .offset(offset);

  const data = rows.map((r) => ({
    riskId: r.riskId,
    riskTitle: r.riskTitle,
    riskCategory: r.riskCategory,
    riskStatus: r.riskStatus,
    parametersId: r.parametersId,
    inputs: {
      lefMostLikely: Number(r.lefMostLikely),
      lmMostLikely: Number(r.lmMostLikely),
    },
    latestSimulation: r.latestResultId
      ? {
          id: r.latestResultId,
          aleP50: r.latestAleP50 ? Number(r.latestAleP50) : null,
          aleMean: r.latestAleMean ? Number(r.latestAleMean) : null,
          computedAt: r.latestComputedAt?.toISOString() ?? null,
          status: r.latestStatus,
        }
      : null,
  }));

  return paginatedResponse(data, total, page, limit);
});
