// Cron Job: Budget Forecast (Weekly)
// Extrapolates burn rate from actual costs and planned costs to produce a forecast.

import {
  db,
  grcBudget,
  grcBudgetLine,
  grcCostEntry,
  organization,
} from "@grc/db";
import { eq, and, isNull, sql, lte, gte } from "drizzle-orm";

interface BudgetForecastResult {
  processed: number;
  orgsProcessed: number;
  errors: number;
}

export async function processBudgetForecast(): Promise<BudgetForecastResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  console.log(`[cron:budget-forecast] Starting at ${now.toISOString()}`);

  let processed = 0;
  let errors = 0;

  // Fetch all active organizations
  const orgs = await db
    .select({ id: organization.id })
    .from(organization)
    .where(isNull(organization.deletedAt));

  for (const org of orgs) {
    try {
      // Find approved or submitted budget for current year
      const [budget] = await db
        .select({ id: grcBudget.id, totalAmount: grcBudget.totalAmount })
        .from(grcBudget)
        .where(
          and(eq(grcBudget.orgId, org.id), eq(grcBudget.year, currentYear)),
        )
        .limit(1);

      if (!budget) continue;

      // Get all budget lines for this budget
      const lines = await db
        .select({
          grcArea: grcBudgetLine.grcArea,
          costCategory: grcBudgetLine.costCategory,
          plannedAmount: grcBudgetLine.plannedAmount,
        })
        .from(grcBudgetLine)
        .where(eq(grcBudgetLine.budgetId, budget.id));

      // Get actual costs year-to-date grouped by category
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const actuals = await db
        .select({
          costCategory: grcCostEntry.costCategory,
          total: sql<string>`COALESCE(SUM(${grcCostEntry.amount}), '0')`,
        })
        .from(grcCostEntry)
        .where(
          and(
            eq(grcCostEntry.orgId, org.id),
            eq(grcCostEntry.costType, "actual"),
            gte(grcCostEntry.periodStart, yearStart),
            lte(grcCostEntry.periodEnd, yearEnd),
          ),
        )
        .groupBy(grcCostEntry.costCategory);

      // Compute forecasts: extrapolate based on monthly burn rate
      const monthsElapsed = Math.max(1, currentMonth);
      const monthsRemaining = 12 - monthsElapsed;

      for (const actual of actuals) {
        const actualTotal = Number(actual.total);
        const monthlyBurnRate = actualTotal / monthsElapsed;
        const forecastRemaining = monthlyBurnRate * monthsRemaining;
        const forecastTotal = actualTotal + forecastRemaining;

        // Upsert a forecast cost entry summarizing the projection
        await db.insert(grcCostEntry).values({
          orgId: org.id,
          entityType: "budget_forecast",
          entityId: budget.id,
          costCategory: actual.costCategory,
          costType: "forecast",
          amount: String(Math.round(forecastTotal * 100) / 100),
          currency: "EUR",
          periodStart: yearStart,
          periodEnd: yearEnd,
          budgetId: budget.id,
          description: `Auto-forecast: ${monthlyBurnRate.toFixed(2)}/month x ${monthsRemaining} remaining`,
        });

        processed++;
      }
    } catch (err) {
      errors++;
      console.error(
        `[cron:budget-forecast] Error for org ${org.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:budget-forecast] Done. Processed: ${processed}, Orgs: ${orgs.length}, Errors: ${errors}`,
  );

  return { processed, orgsProcessed: orgs.length, errors };
}
