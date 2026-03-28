// Sprint 30: Report Scheduler Cron
// Runs every minute, checks report_schedule.next_run_at
// Generates reports and emails them to recipients

import {
  db,
  reportSchedule,
  reportGenerationLog,
  reportTemplate,
} from "@grc/db";
import { eq, and, lte, sql } from "drizzle-orm";
import { reportGenerator } from "@grc/reporting";

interface ReportSchedulerResult {
  checked: number;
  triggered: number;
  errors: number;
}

/**
 * Compute next run time from cron expression.
 * Simplified implementation — supports basic cron patterns.
 */
function computeNextRun(cronExpression: string, fromDate: Date): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) {
    return new Date(fromDate.getTime() + 3600000); // 1 hour
  }

  const minute = parts[0] === "*" ? 0 : parseInt(parts[0], 10);
  const hour = parts[1] === "*" ? fromDate.getHours() : parseInt(parts[1], 10);
  const dayOfMonth =
    parts[2] === "*" ? fromDate.getDate() : parseInt(parts[2], 10);

  const next = new Date(fromDate);
  next.setMinutes(minute);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setHours(hour);

  if (parts[2] !== "*") {
    // Monthly schedule — advance to next month
    next.setDate(dayOfMonth);
    if (next <= fromDate) {
      next.setMonth(next.getMonth() + 1);
    }
  } else if (parts[1] !== "*") {
    // Daily schedule — advance to next day
    if (next <= fromDate) {
      next.setDate(next.getDate() + 1);
    }
  } else {
    // Hourly or more frequent
    if (next <= fromDate) {
      next.setHours(next.getHours() + 1);
    }
  }

  return next;
}

export async function processReportScheduler(): Promise<ReportSchedulerResult> {
  const now = new Date();
  let triggered = 0;
  let errors = 0;

  // Find all active schedules where next_run_at <= now
  const dueSchedules = await db
    .select({
      id: reportSchedule.id,
      orgId: reportSchedule.orgId,
      templateId: reportSchedule.templateId,
      cronExpression: reportSchedule.cronExpression,
      parametersJson: reportSchedule.parametersJson,
      recipientEmails: reportSchedule.recipientEmails,
      outputFormat: reportSchedule.outputFormat,
      createdBy: reportSchedule.createdBy,
    })
    .from(reportSchedule)
    .where(
      and(
        eq(reportSchedule.isActive, true),
        lte(reportSchedule.nextRunAt, now),
      ),
    )
    .limit(50); // Process max 50 per run

  for (const schedule of dueSchedules) {
    try {
      // Create generation log entry
      const [log] = await db
        .insert(reportGenerationLog)
        .values({
          orgId: schedule.orgId,
          templateId: schedule.templateId,
          status: "queued",
          parametersJson: schedule.parametersJson || {},
          outputFormat: schedule.outputFormat,
          generatedBy: schedule.createdBy,
          scheduleId: schedule.id,
        })
        .returning();

      // Trigger generation
      reportGenerator
        .generate(
          log.id,
          schedule.orgId,
          schedule.templateId,
          (schedule.parametersJson as Record<string, unknown>) || {},
          schedule.outputFormat,
        )
        .then(async () => {
          // On success, email recipients
          const recipients = schedule.recipientEmails as string[];
          if (recipients && recipients.length > 0) {
            console.log(
              `[report-scheduler] Schedule ${schedule.id}: would email ${recipients.length} recipients`,
            );
            // TODO: integrate with sendEmail service
          }
        })
        .catch((error) => {
          console.error(
            `[report-scheduler] Schedule ${schedule.id} generation failed:`,
            error instanceof Error ? error.message : String(error),
          );
        });

      // Update schedule: last_run_at and next_run_at
      const nextRun = computeNextRun(schedule.cronExpression, now);
      await db
        .update(reportSchedule)
        .set({
          lastRunAt: now,
          nextRunAt: nextRun,
          updatedAt: now,
        })
        .where(eq(reportSchedule.id, schedule.id));

      triggered++;
    } catch (error) {
      console.error(
        `[report-scheduler] Error processing schedule ${schedule.id}:`,
        error instanceof Error ? error.message : String(error),
      );
      errors++;
    }
  }

  return {
    checked: dueSchedules.length,
    triggered,
    errors,
  };
}
