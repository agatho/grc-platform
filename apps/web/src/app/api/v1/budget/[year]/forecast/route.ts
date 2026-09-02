import { db, grcBudget, grcBudgetLine, grcCostEntry } from "@grc/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/budget/:year/forecast — Year-end forecast based on actuals + trend
export const GET = withErrorHandler(async function GET(
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

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Current month (1-12)
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;
  const monthsElapsed = Math.max(1, currentMonth);
  const monthsRemaining = 12 - monthsElapsed;

  // Planned per category
  const planned = await db
    .select({
      grcArea: grcBudgetLine.grcArea,
      costCategory: grcBudgetLine.costCategory,
      planned: sql<string>`SUM(${grcBudgetLine.plannedAmount})`,
    })
    .from(grcBudgetLine)
    .where(eq(grcBudgetLine.budgetId, budget.id))
    .groupBy(grcBudgetLine.grcArea, grcBudgetLine.costCategory);

  // Actual to-date
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

  // Forecasted costs already logged
  const forecasts = await db
    .select({
      costCategory: grcCostEntry.costCategory,
      forecast: sql<string>`SUM(${grcCostEntry.amount})`,
    })
    .from(grcCostEntry)
    .where(
      and(
        eq(grcCostEntry.orgId, ctx.orgId),
        eq(grcCostEntry.costType, "forecast"),
        gte(grcCostEntry.periodStart, yearStart),
        lte(grcCostEntry.periodEnd, yearEnd),
      ),
    )
    .groupBy(grcCostEntry.costCategory);

  const actualMap = new Map(
    actuals.map((a) => [a.costCategory, Number(a.actual)]),
  );
  const forecastMap = new Map(
    forecasts.map((f) => [f.costCategory, Number(f.forecast)]),
  );

  const breakdown = planned.map((p) => {
    const plannedVal = Number(p.planned);
    const actualToDate = actualMap.get(p.costCategory) ?? 0;
    const existingForecast = forecastMap.get(p.costCategory) ?? 0;

    // Linear projection: actual/month * remaining months + actuals + known forecast
    const monthlyRate = actualToDate / monthsElapsed;
    const projected =
      existingForecast > 0
        ? actualToDate + existingForecast
        : actualToDate + monthlyRate * monthsRemaining;

    const forecast = Math.round(projected * 100) / 100;
    const overUnder = Math.round((plannedVal - forecast) * 100) / 100;

    return {
      grcArea: p.grcArea,
      costCategory: p.costCategory,
      planned: plannedVal,
      actualToDate,
      forecast,
      overUnder,
    };
  });

  const totalPlanned = breakdown.reduce((s, b) => s + b.planned, 0);
  const totalForecast = breakdown.reduce((s, b) => s + b.forecast, 0);

  return Response.json({
    data: {
      year,
      budgetId: budget.id,
      monthsElapsed,
      monthsRemaining,
      totalPlanned,
      totalForecast,
      totalOverUnder: Math.round((totalPlanned - totalForecast) * 100) / 100,
      breakdown,
    },
  });
});
