// Cron Job: ESG Completeness Check (Weekly)
// Computes ESRS datapoint completeness % for current reporting year.
// Notifies responsible users if completeness <80% and report deadline approaching.

import { db, esgAnnualReport, esrsDatapointDefinition, esrsMetric, esgMeasurement, notification } from "@grc/db";
import { and, eq, sql, isNull, count } from "drizzle-orm";

interface EsgCompletenessResult {
  processed: number;
  notified: number;
  updated: number;
}

export async function processEsgCompletenessCheck(): Promise<EsgCompletenessResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  let notified = 0;
  let updated = 0;

  console.log(`[cron:esg-completeness-check] Starting at ${now.toISOString()} for year ${currentYear}`);

  // 1. Find all annual reports for the current year (all orgs)
  const reports = await db
    .select({
      id: esgAnnualReport.id,
      orgId: esgAnnualReport.orgId,
      reportingYear: esgAnnualReport.reportingYear,
      status: esgAnnualReport.status,
      completenessPercent: esgAnnualReport.completenessPercent,
    })
    .from(esgAnnualReport)
    .where(
      and(
        eq(esgAnnualReport.reportingYear, currentYear),
        sql`${esgAnnualReport.status} IN ('draft', 'in_review')`,
      ),
    );

  for (const report of reports) {
    try {
      // 2. Count total mandatory ESRS datapoints
      const [totalRow] = await db
        .select({ total: count() })
        .from(esrsDatapointDefinition)
        .where(eq(esrsDatapointDefinition.isMandatory, true));

      const totalMandatory = totalRow?.total ?? 0;
      if (totalMandatory === 0) continue;

      // 3. Count mandatory datapoints that have at least one metric with a measurement in the current year
      const [coveredRow] = await db
        .select({ covered: count(sql`DISTINCT ${esrsDatapointDefinition.id}`) })
        .from(esrsDatapointDefinition)
        .innerJoin(esrsMetric, and(
          eq(esrsMetric.datapointId, esrsDatapointDefinition.id),
          eq(esrsMetric.orgId, report.orgId),
          eq(esrsMetric.isActive, true),
        ))
        .innerJoin(esgMeasurement, and(
          eq(esgMeasurement.metricId, esrsMetric.id),
          sql`EXTRACT(YEAR FROM ${esgMeasurement.periodStart}::date) = ${currentYear}`,
        ))
        .where(eq(esrsDatapointDefinition.isMandatory, true));

      const coveredCount = coveredRow?.covered ?? 0;
      const pct = Math.round((coveredCount / totalMandatory) * 100);

      // 4. Update report completeness
      await db
        .update(esgAnnualReport)
        .set({ completenessPercent: pct, updatedAt: now })
        .where(eq(esgAnnualReport.id, report.id));
      updated++;

      // 5. Notify if <80% and we are in Q4 (deadline approaching)
      const month = now.getMonth(); // 0-indexed
      if (pct < 80 && month >= 9) {
        // Find metric owners to notify
        const responsibleUsers = await db
          .select({ userId: esrsMetric.responsibleUserId })
          .from(esrsMetric)
          .where(
            and(
              eq(esrsMetric.orgId, report.orgId),
              eq(esrsMetric.isActive, true),
              sql`${esrsMetric.responsibleUserId} IS NOT NULL`,
            ),
          )
          .groupBy(esrsMetric.responsibleUserId);

        for (const user of responsibleUsers) {
          if (!user.userId) continue;
          try {
            await db.insert(notification).values({
              userId: user.userId,
              orgId: report.orgId,
              type: "deadline_approaching" as const,
              entityType: "esg_annual_report",
              entityId: report.id,
              title: `ESG Report ${currentYear}: Completeness at ${pct}%`,
              message: `The ESRS report for ${currentYear} is currently at ${pct}% completeness. The reporting deadline is approaching. Please ensure all mandatory datapoints have measurements recorded.`,
              channel: "both" as const,
              templateKey: "esg_completeness_low",
              templateData: { reportId: report.id, year: currentYear, completeness: pct },
              createdAt: now,
              updatedAt: now,
            });
            notified++;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[cron:esg-completeness-check] Notification failed for user ${user.userId}:`, message);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron:esg-completeness-check] Failed for report ${report.id}:`, message);
    }
  }

  console.log(
    `[cron:esg-completeness-check] Processed ${reports.length} reports, ${updated} updated, ${notified} notifications`,
  );

  return { processed: reports.length, notified, updated };
}
