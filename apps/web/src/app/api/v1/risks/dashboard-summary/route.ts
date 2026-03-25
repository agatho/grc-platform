import { db, risk, kri } from "@grc/db";
import { eq, and, isNull, count, desc, sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";

// GET /api/v1/risks/dashboard-summary — Risk dashboard summary
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const baseConditions = and(
    eq(risk.orgId, ctx.orgId),
    isNull(risk.deletedAt),
  );

  const [
    totalResult,
    byStatusResult,
    byCategoryResult,
    appetiteExceededResult,
    top10Result,
    kriSummaryResult,
    heatMapResult,
  ] = await Promise.all([
    // Total risks
    db
      .select({ value: count() })
      .from(risk)
      .where(baseConditions),

    // By status breakdown
    db
      .select({
        status: risk.status,
        count: count(),
      })
      .from(risk)
      .where(baseConditions)
      .groupBy(risk.status),

    // By category breakdown
    db
      .select({
        category: risk.riskCategory,
        count: count(),
      })
      .from(risk)
      .where(baseConditions)
      .groupBy(risk.riskCategory),

    // Appetite exceeded count
    db
      .select({ value: count() })
      .from(risk)
      .where(
        and(
          baseConditions,
          eq(risk.riskAppetiteExceeded, true),
        ),
      ),

    // Top 10 risks by residual score
    db
      .select({
        id: risk.id,
        title: risk.title,
        riskCategory: risk.riskCategory,
        status: risk.status,
        riskScoreResidual: risk.riskScoreResidual,
        riskScoreInherent: risk.riskScoreInherent,
        riskAppetiteExceeded: risk.riskAppetiteExceeded,
        ownerId: risk.ownerId,
      })
      .from(risk)
      .where(baseConditions)
      .orderBy(desc(risk.riskScoreResidual))
      .limit(10),

    // KRI summary: green/yellow/red counts
    db
      .select({
        alertStatus: kri.currentAlertStatus,
        count: count(),
      })
      .from(kri)
      .where(
        and(
          eq(kri.orgId, ctx.orgId),
          isNull(kri.deletedAt),
        ),
      )
      .groupBy(kri.currentAlertStatus),

    // Heat map cells: likelihood x impact grouped with counts
    db
      .select({
        likelihood: risk.residualLikelihood,
        impact: risk.residualImpact,
        count: count(),
      })
      .from(risk)
      .where(
        and(
          baseConditions,
          sql`${risk.residualLikelihood} IS NOT NULL`,
          sql`${risk.residualImpact} IS NOT NULL`,
        ),
      )
      .groupBy(risk.residualLikelihood, risk.residualImpact),
  ]);

  // Transform KRI summary into green/yellow/red counts
  const kriSummary = { green: 0, yellow: 0, red: 0 };
  for (const row of kriSummaryResult) {
    if (row.alertStatus === "green") kriSummary.green = row.count;
    else if (row.alertStatus === "yellow") kriSummary.yellow = row.count;
    else if (row.alertStatus === "red") kriSummary.red = row.count;
  }

  // Transform by-status into a record
  const byStatus: Record<string, number> = {};
  for (const row of byStatusResult) {
    byStatus[row.status] = row.count;
  }

  // Transform by-category into a record
  const byCategory: Record<string, number> = {};
  for (const row of byCategoryResult) {
    byCategory[row.category] = row.count;
  }

  // Transform heat map cells
  const heatMapCells = heatMapResult.map((row) => ({
    likelihood: row.likelihood,
    impact: row.impact,
    count: row.count,
  }));

  return Response.json({
    data: {
      totalRisks: totalResult[0].value,
      byStatus,
      byCategory,
      appetiteExceededCount: appetiteExceededResult[0].value,
      top10Risks: top10Result,
      kriSummary,
      heatMapCells,
    },
  });
}
