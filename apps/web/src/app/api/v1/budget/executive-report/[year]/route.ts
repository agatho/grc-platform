import {
  db,
  grcBudget,
  grcBudgetLine,
  grcCostEntry,
  grcRoiCalculation,
} from "@grc/db";
import { eq, and, sql, gte, lte, isNotNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/budget/executive-report/:year — Executive budget report (JSON for rendering)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { year: yearStr } = await params;
  const year = Number(yearStr);
  if (!Number.isInteger(year) || year < 2020 || year > 2099) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  // 1. Budget overview
  const [budget] = await db
    .select()
    .from(grcBudget)
    .where(and(eq(grcBudget.orgId, ctx.orgId), eq(grcBudget.year, year)));

  if (!budget) {
    return Response.json({ error: "Budget not found" }, { status: 404 });
  }

  // 2. Budget lines
  const lines = await db
    .select()
    .from(grcBudgetLine)
    .where(eq(grcBudgetLine.budgetId, budget.id));

  const totalPlanned = lines.reduce(
    (sum, l) => sum + Number(l.plannedAmount),
    0,
  );

  // 3. Actual costs for the year
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [actualTotals] = await db
    .select({
      totalActual: sql<string>`COALESCE(SUM(${grcCostEntry.amount}), 0)`,
    })
    .from(grcCostEntry)
    .where(
      and(
        eq(grcCostEntry.orgId, ctx.orgId),
        eq(grcCostEntry.costType, "actual"),
        gte(grcCostEntry.periodStart, yearStart),
        lte(grcCostEntry.periodEnd, yearEnd),
      ),
    );

  const totalActual = Number(actualTotals.totalActual);

  // 4. Costs by area
  const costsByArea = await db
    .select({
      costCategory: grcCostEntry.costCategory,
      totalAmount: sql<string>`SUM(${grcCostEntry.amount})`,
      entryCount: sql<number>`COUNT(*)`,
    })
    .from(grcCostEntry)
    .where(
      and(
        eq(grcCostEntry.orgId, ctx.orgId),
        eq(grcCostEntry.costType, "actual"),
        gte(grcCostEntry.periodStart, yearStart),
        lte(grcCostEntry.periodEnd, yearEnd),
      ),
    )
    .groupBy(grcCostEntry.costCategory);

  // 5. ROI summary
  const [roiSummary] = await db
    .select({
      totalInvestment: sql<string>`COALESCE(SUM(${grcRoiCalculation.investmentCost}), 0)`,
      totalReduction: sql<string>`COALESCE(SUM(${grcRoiCalculation.riskReductionValue}), 0)`,
      avgRoi: sql<string>`COALESCE(AVG(${grcRoiCalculation.roiPercent}), 0)`,
      entityCount: sql<number>`COUNT(*)`,
    })
    .from(grcRoiCalculation)
    .where(
      and(
        eq(grcRoiCalculation.orgId, ctx.orgId),
        isNotNull(grcRoiCalculation.roiPercent),
      ),
    );

  // 6. RONI summary
  const [roniSummary] = await db
    .select({
      totalRoniCfo: sql<string>`COALESCE(SUM(${grcRoiCalculation.roniCfo}), 0)`,
      totalRoniCiso: sql<string>`COALESCE(SUM(${grcRoiCalculation.roniCiso}), 0)`,
      totalInherentAle: sql<string>`COALESCE(SUM(${grcRoiCalculation.inherentAle}), 0)`,
      totalResidualAle: sql<string>`COALESCE(SUM(${grcRoiCalculation.residualAle}), 0)`,
    })
    .from(grcRoiCalculation)
    .where(
      and(
        eq(grcRoiCalculation.orgId, ctx.orgId),
        isNotNull(grcRoiCalculation.roniCfo),
      ),
    );

  // 7. Forecast
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;
  const monthsElapsed = Math.max(1, currentMonth);
  const monthlyRate = totalActual / monthsElapsed;
  const forecast = totalActual + monthlyRate * (12 - monthsElapsed);

  // 8. Top ROI investments
  const topRoi = await db
    .select({
      entityType: grcRoiCalculation.entityType,
      entityId: grcRoiCalculation.entityId,
      investmentCost: grcRoiCalculation.investmentCost,
      roiPercent: grcRoiCalculation.roiPercent,
      riskReductionValue: grcRoiCalculation.riskReductionValue,
    })
    .from(grcRoiCalculation)
    .where(
      and(
        eq(grcRoiCalculation.orgId, ctx.orgId),
        isNotNull(grcRoiCalculation.roiPercent),
      ),
    )
    .orderBy(sql`${grcRoiCalculation.roiPercent} DESC`)
    .limit(10);

  return Response.json({
    data: {
      year,
      generatedAt: new Date().toISOString(),
      budget: {
        id: budget.id,
        status: budget.status,
        totalAmount: Number(budget.totalAmount),
        currency: budget.currency,
        approvedBy: budget.approvedBy,
        approvedAt: budget.approvedAt,
      },
      financials: {
        totalPlanned,
        totalActual,
        variance: totalPlanned - totalActual,
        variancePercent:
          totalPlanned > 0
            ? Math.round(
                ((totalPlanned - totalActual) / totalPlanned) * 10000,
              ) / 100
            : 0,
        forecast: Math.round(forecast * 100) / 100,
        forecastVariance: Math.round((totalPlanned - forecast) * 100) / 100,
      },
      costBreakdown: costsByArea.map((c) => ({
        costCategory: c.costCategory,
        totalAmount: Number(c.totalAmount),
        entryCount: Number(c.entryCount),
      })),
      roi: {
        totalInvestment: Number(roiSummary.totalInvestment),
        totalRiskReduction: Number(roiSummary.totalReduction),
        averageRoiPercent: Math.round(Number(roiSummary.avgRoi) * 100) / 100,
        entityCount: Number(roiSummary.entityCount),
        topInvestments: topRoi.map((r) => ({
          entityType: r.entityType,
          entityId: r.entityId,
          investmentCost: Number(r.investmentCost),
          roiPercent: Number(r.roiPercent),
          riskReductionValue: Number(r.riskReductionValue),
        })),
      },
      roni: {
        totalRoniCfo: Number(roniSummary.totalRoniCfo),
        totalRoniCiso: Number(roniSummary.totalRoniCiso),
        totalInherentAle: Number(roniSummary.totalInherentAle),
        totalResidualAle: Number(roniSummary.totalResidualAle),
        aleReduction:
          Number(roniSummary.totalInherentAle) -
          Number(roniSummary.totalResidualAle),
        warning:
          Number(roniSummary.totalRoniCfo) < -100000
            ? `RONI warning: Total cost of non-investment is ${Math.abs(Number(roniSummary.totalRoniCfo)).toLocaleString()} EUR. Board-level attention required.`
            : null,
      },
      lineItems: lines.map((l) => ({
        grcArea: l.grcArea,
        costCategory: l.costCategory,
        plannedAmount: Number(l.plannedAmount),
        q1Amount: l.q1Amount ? Number(l.q1Amount) : null,
        q2Amount: l.q2Amount ? Number(l.q2Amount) : null,
        q3Amount: l.q3Amount ? Number(l.q3Amount) : null,
        q4Amount: l.q4Amount ? Number(l.q4Amount) : null,
      })),
    },
  });
}
