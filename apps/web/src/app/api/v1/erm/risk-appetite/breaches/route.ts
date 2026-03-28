import { db, riskAppetiteThreshold, risk, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, isNotNull, gt, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { RiskAppetiteBreach, RiskCategory } from "@grc/shared";

// GET /api/v1/erm/risk-appetite/breaches — All current breaches
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get active thresholds
  const thresholds = await db
    .select()
    .from(riskAppetiteThreshold)
    .where(
      and(
        eq(riskAppetiteThreshold.orgId, ctx.orgId),
        eq(riskAppetiteThreshold.isActive, true),
        isNull(riskAppetiteThreshold.deletedAt),
      ),
    );

  if (thresholds.length === 0) {
    return Response.json({ breaches: [], total: 0 });
  }

  // Build breach detection query
  const breaches: RiskAppetiteBreach[] = [];

  for (const threshold of thresholds) {
    const breachedRisks = await db
      .select({
        riskId: risk.id,
        riskTitle: risk.title,
        riskCategory: risk.riskCategory,
        residualScore: risk.riskScoreResidual,
        ownerId: risk.ownerId,
        ownerName: user.name,
      })
      .from(risk)
      .leftJoin(user, eq(user.id, risk.ownerId))
      .where(
        and(
          eq(risk.orgId, ctx.orgId),
          eq(risk.riskCategory, threshold.riskCategory as RiskCategory),
          isNull(risk.deletedAt),
          isNotNull(risk.riskScoreResidual),
          gt(risk.riskScoreResidual, threshold.maxResidualScore),
        ),
      );

    for (const r of breachedRisks) {
      breaches.push({
        riskId: r.riskId,
        riskTitle: r.riskTitle,
        riskCategory: r.riskCategory,
        residualScore: r.residualScore ?? 0,
        appetiteThreshold: threshold.maxResidualScore,
        delta: (r.residualScore ?? 0) - threshold.maxResidualScore,
        ownerId: r.ownerId,
        ownerName: r.ownerName,
      });
    }
  }

  // Sort by delta descending (most severe first)
  breaches.sort((a, b) => b.delta - a.delta);

  return Response.json({
    breaches,
    total: breaches.length,
  });
}
