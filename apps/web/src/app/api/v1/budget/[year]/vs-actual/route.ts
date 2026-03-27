import { db, grcBudget, grcBudgetLine, grcCostEntry } from "@grc/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/budget/:year/vs-actual — Budget vs. actual comparison
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

  const [budget] = await db
    .select()
    .from(grcBudget)
    .where(and(eq(grcBudget.orgId, ctx.orgId), eq(grcBudget.year, year)));

  if (!budget) {
    return Response.json({ error: "Budget not found" }, { status: 404 });
  }

  // Get planned amounts by area + category
  const planned = await db
    .select({
      grcArea: grcBudgetLine.grcArea,
      costCategory: grcBudgetLine.costCategory,
      planned: sql<string>`SUM(${grcBudgetLine.plannedAmount})`,
    })
    .from(grcBudgetLine)
    .where(eq(grcBudgetLine.budgetId, budget.id))
    .groupBy(grcBudgetLine.grcArea, grcBudgetLine.costCategory);

  // Get actual costs for the year
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const actuals = await db
    .select({
      costCategory: grcCostEntry.costCategory,
      actual: sql<string>`SUM(${grcCostEntry.amount})`,
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

  const actualMap = new Map(
    actuals.map((a) => [a.costCategory, Number(a.actual)]),
  );

  const comparison = planned.map((p) => {
    const plannedVal = Number(p.planned);
    const actualVal = actualMap.get(p.costCategory) ?? 0;
    const variance = plannedVal - actualVal;
    const variancePercent = plannedVal > 0 ? (variance / plannedVal) * 100 : 0;

    return {
      grcArea: p.grcArea,
      costCategory: p.costCategory,
      planned: plannedVal,
      actual: actualVal,
      variance,
      variancePercent: Math.round(variancePercent * 100) / 100,
    };
  });

  const totalPlanned = comparison.reduce((s, c) => s + c.planned, 0);
  const totalActual = comparison.reduce((s, c) => s + c.actual, 0);

  return Response.json({
    data: {
      year,
      budgetId: budget.id,
      status: budget.status,
      totalPlanned,
      totalActual,
      totalVariance: totalPlanned - totalActual,
      breakdown: comparison,
    },
  });
}
