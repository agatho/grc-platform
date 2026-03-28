// Sprint 77: BI Scheduled Report Runner
// Checks bi_scheduled_report.next_run_at and triggers report generation

import { db, biScheduledReport, biReportExecution } from "@grc/db";
import { eq, and, lte, sql } from "drizzle-orm";

interface BiReportSchedulerResult {
  checked: number;
  triggered: number;
  errors: number;
}

function computeNextRun(frequency: string, fromDate: Date): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  return next;
}

export async function processBiReportScheduler(): Promise<BiReportSchedulerResult> {
  const now = new Date();
  const result: BiReportSchedulerResult = { checked: 0, triggered: 0, errors: 0 };

  const schedules = await db
    .select()
    .from(biScheduledReport)
    .where(
      and(
        eq(biScheduledReport.isActive, true),
        lte(biScheduledReport.nextRunAt, now),
      ),
    );

  result.checked = schedules.length;

  for (const schedule of schedules) {
    try {
      // Create execution record
      await db.insert(biReportExecution).values({
        orgId: schedule.orgId,
        reportId: schedule.reportId,
        scheduledReportId: schedule.id,
        outputFormat: schedule.outputFormat,
        parametersJson: schedule.parametersJson,
        status: "queued",
      });

      // Update schedule
      const nextRun = computeNextRun(schedule.frequency, now);
      await db
        .update(biScheduledReport)
        .set({ lastRunAt: now, nextRunAt: nextRun })
        .where(eq(biScheduledReport.id, schedule.id));

      result.triggered++;
    } catch (err) {
      console.error(`[worker] bi-report-scheduler: Failed for schedule ${schedule.id}:`, err);
      result.errors++;
    }
  }

  return result;
}
