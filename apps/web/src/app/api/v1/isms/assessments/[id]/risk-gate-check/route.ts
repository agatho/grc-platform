// GET /api/v1/isms/assessments/[id]/risk-gate-check
//
// Sprint 1.3 Gate-G3-Check. Live-Stats pro Run:
//   - Wie viele risk_scenario-Evals sind im Run?
//   - Wie viele haben eine Decision != 'pending'?
//   - Wie viele haben residual-Score?
//
// Liefert Gate-G3-Blocker-Array.

import { db, assessmentRun, assessmentRiskEval } from "@grc/db";
import { requireModule } from "@grc/auth";
import { validateGate3RiskAssessment, type RiskEvalStats } from "@grc/shared";
import { and, eq, ne, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [run] = await db
    .select()
    .from(assessmentRun)
    .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));
  if (!run) {
    return Response.json(
      { error: "Assessment run not found" },
      { status: 404 },
    );
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, id),
        eq(assessmentRiskEval.orgId, ctx.orgId),
      ),
    );

  const [{ decided }] = await db
    .select({ decided: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, id),
        eq(assessmentRiskEval.orgId, ctx.orgId),
        ne(assessmentRiskEval.decision, "pending"),
      ),
    );

  const [{ scored }] = await db
    .select({ scored: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, id),
        eq(assessmentRiskEval.orgId, ctx.orgId),
        sql`${assessmentRiskEval.residualLikelihood} IS NOT NULL`,
        sql`${assessmentRiskEval.residualImpact} IS NOT NULL`,
      ),
    );

  const stats: RiskEvalStats = {
    totalRiskEvals: total ?? 0,
    decided: decided ?? 0,
    scored: scored ?? 0,
  };

  const blockers = validateGate3RiskAssessment(stats);

  return Response.json({
    data: {
      assessmentRunId: run.id,
      stats,
      decisionCoverage:
        stats.totalRiskEvals > 0
          ? Math.round((stats.decided / stats.totalRiskEvals) * 100)
          : 0,
      scoreCoverage:
        stats.totalRiskEvals > 0
          ? Math.round((stats.scored / stats.totalRiskEvals) * 100)
          : 0,
      blockers,
      passed: blockers.filter((b) => b.severity === "error").length === 0,
    },
  });
}
