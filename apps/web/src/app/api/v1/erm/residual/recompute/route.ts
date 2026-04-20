import { db, risk, riskControl, controlEffectivenessScore } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { computeResidualScore } from "@grc/shared";

// POST /api/v1/erm/residual/recompute — Force recompute all auto-residual scores
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  // Fetch all active risks for org
  const risks = await db
    .select({
      id: risk.id,
      riskScoreInherent: risk.riskScoreInherent,
    })
    .from(risk)
    .where(and(eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)));

  let updated = 0;

  for (const r of risks) {
    // Fetch linked control CES scores
    const linkedCes = await db
      .select({ cesScore: controlEffectivenessScore.score })
      .from(riskControl)
      .innerJoin(
        controlEffectivenessScore,
        and(
          eq(controlEffectivenessScore.controlId, riskControl.controlId),
          eq(controlEffectivenessScore.orgId, ctx.orgId),
        ),
      )
      .where(
        and(eq(riskControl.riskId, r.id), eq(riskControl.orgId, ctx.orgId)),
      );

    const cesScores = linkedCes.map((lc) => lc.cesScore);
    if (cesScores.length === 0) continue;

    const inherentScore = r.riskScoreInherent ?? 0;
    const autoResidual = computeResidualScore(inherentScore, cesScores);

    // Update risk_score_residual on the risk
    await db
      .update(risk)
      .set({
        riskScoreResidual: autoResidual,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(risk.id, r.id));

    updated++;
  }

  return Response.json({
    success: true,
    updated,
    total: risks.length,
  });
}
