import { db, risk, riskControl, controlEffectivenessScore } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { computeResidualScore } from "@grc/shared";

// GET /api/v1/risks/:id/residual-auto — Auto-computed residual score from CES
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Verify risk belongs to org
  const [riskRow] = await db
    .select({
      id: risk.id,
      riskScoreInherent: risk.riskScoreInherent,
      riskScoreResidual: risk.riskScoreResidual,
      inherentLikelihood: risk.inherentLikelihood,
      inherentImpact: risk.inherentImpact,
    })
    .from(risk)
    .where(
      and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
    )
    .limit(1);

  if (!riskRow) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Fetch linked controls and their CES scores
  const linkedControls = await db
    .select({
      controlId: riskControl.controlId,
      effectiveness: riskControl.effectiveness,
      cesScore: controlEffectivenessScore.score,
      cesTrend: controlEffectivenessScore.trend,
    })
    .from(riskControl)
    .leftJoin(
      controlEffectivenessScore,
      and(
        eq(controlEffectivenessScore.controlId, riskControl.controlId),
        eq(controlEffectivenessScore.orgId, ctx.orgId),
      ),
    )
    .where(and(eq(riskControl.riskId, id), eq(riskControl.orgId, ctx.orgId)));

  const cesScores = linkedControls
    .filter((lc) => lc.cesScore !== null)
    .map((lc) => lc.cesScore!);

  const inherentScore = riskRow.riskScoreInherent ?? 0;
  const autoResidual = computeResidualScore(inherentScore, cesScores);
  const manualResidual = riskRow.riskScoreResidual;
  const delta =
    manualResidual !== null && manualResidual !== undefined
      ? autoResidual - manualResidual
      : null;

  return Response.json({
    data: {
      riskId: id,
      inherentScore,
      manualResidual,
      autoResidual,
      delta,
      linkedControlCount: linkedControls.length,
      controlsWithCes: cesScores.length,
      avgCes:
        cesScores.length > 0
          ? Math.round(cesScores.reduce((a, b) => a + b, 0) / cesScores.length)
          : null,
      controls: linkedControls.map((lc) => ({
        controlId: lc.controlId,
        cesScore: lc.cesScore,
        cesTrend: lc.cesTrend,
      })),
    },
  });
}
