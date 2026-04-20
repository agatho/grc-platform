// Cron Job: Monthly Report Generator (1st of each month)
// Generates executive report data snapshot for the current budget year.

import {
  db,
  grcBudget,
  grcBudgetLine,
  grcCostEntry,
  grcRoiCalculation,
  risk,
  organization,
} from "@grc/db";
import { eq, and, isNull, sql, gte, lte, desc } from "drizzle-orm";

interface MonthlyReportResult {
  processed: number;
  orgsProcessed: number;
  errors: number;
}

export async function processMonthlyReportGenerator(): Promise<MonthlyReportResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  console.log(
    `[cron:monthly-report-generator] Starting at ${now.toISOString()}`,
  );

  let processed = 0;
  let errors = 0;

  // Fetch all active organizations
  const orgs = await db
    .select({ id: organization.id })
    .from(organization)
    .where(isNull(organization.deletedAt));

  for (const org of orgs) {
    try {
      // Find budget for current year
      const [budget] = await db
        .select({
          id: grcBudget.id,
          totalAmount: grcBudget.totalAmount,
          year: grcBudget.year,
        })
        .from(grcBudget)
        .where(
          and(eq(grcBudget.orgId, org.id), eq(grcBudget.year, currentYear)),
        )
        .limit(1);

      if (!budget) continue;

      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      // Total planned from budget lines
      const [plannedResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${grcBudgetLine.plannedAmount}), '0')`,
        })
        .from(grcBudgetLine)
        .where(eq(grcBudgetLine.budgetId, budget.id));

      const totalPlanned = Number(plannedResult?.total || 0);

      // Total actual costs
      const [actualResult] = await db
        .select({
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
        );

      const totalActual = Number(actualResult?.total || 0);

      // Total forecast costs
      const [forecastResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${grcCostEntry.amount}), '0')`,
        })
        .from(grcCostEntry)
        .where(
          and(
            eq(grcCostEntry.orgId, org.id),
            eq(grcCostEntry.costType, "forecast"),
            gte(grcCostEntry.periodStart, yearStart),
            lte(grcCostEntry.periodEnd, yearEnd),
          ),
        );

      const totalForecast = Number(forecastResult?.total || 0);

      // Top ROI items
      const topRoi = await db
        .select({
          entityType: grcRoiCalculation.entityType,
          entityId: grcRoiCalculation.entityId,
          investmentCost: grcRoiCalculation.investmentCost,
          roiPercent: grcRoiCalculation.roiPercent,
          calculationMethod: grcRoiCalculation.calculationMethod,
        })
        .from(grcRoiCalculation)
        .where(eq(grcRoiCalculation.orgId, org.id))
        .orderBy(desc(grcRoiCalculation.roiPercent))
        .limit(5);

      // Total RONI from accepted risks
      const acceptedRisks = await db
        .select({
          title: risk.title,
          financialImpactExpected: risk.financialImpactExpected,
          inherentLikelihood: risk.inherentLikelihood,
        })
        .from(risk)
        .where(
          and(
            eq(risk.orgId, org.id),
            eq(risk.treatmentStrategy, "accept"),
            isNull(risk.deletedAt),
          ),
        );

      const totalRoniAle = acceptedRisks.reduce((sum, r) => {
        const impact = Number(r.financialImpactExpected || 0);
        const likelihood = (r.inherentLikelihood ?? 1) / 5;
        return sum + impact * likelihood;
      }, 0);

      // Store report snapshot as a forecast cost entry for retrieval
      const reportData = {
        year: currentYear,
        generatedAt: now.toISOString(),
        totalPlanned,
        totalActual,
        totalForecast,
        delta: totalActual - totalPlanned,
        topRoiCount: topRoi.length,
        totalRoniAle: Math.round(totalRoniAle * 100) / 100,
        acceptedRisksCount: acceptedRisks.length,
      };

      await db.insert(grcCostEntry).values({
        orgId: org.id,
        entityType: "executive_report",
        entityId: budget.id,
        costCategory: "measures",
        costType: "forecast",
        amount: String(totalActual),
        currency: "EUR",
        periodStart: yearStart,
        periodEnd: yearEnd,
        budgetId: budget.id,
        description: JSON.stringify(reportData),
      });

      processed++;
      console.log(
        `[cron:monthly-report-generator] Org ${org.id}: planned=${totalPlanned}, actual=${totalActual}, forecast=${totalForecast}, roni=${totalRoniAle.toFixed(0)}`,
      );
    } catch (err) {
      errors++;
      console.error(
        `[cron:monthly-report-generator] Error for org ${org.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:monthly-report-generator] Done. Processed: ${processed}, Orgs: ${orgs.length}, Errors: ${errors}`,
  );

  return { processed, orgsProcessed: orgs.length, errors };
}
