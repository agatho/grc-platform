// Cron Job: Process Review Reminders
// Finds processes where review_date is within the next 14 days
// or where review_cycle_days triggers a reminder, and creates
// notifications for the process owner.
//
// Sprint 3b addition: Also checks process_review_schedule records
// for schedules where nextReviewDate is approaching (30 days, 0 days, overdue).

import { db, process, processReviewSchedule, notification } from "@grc/db";
import {
  and,
  isNull,
  sql,
  isNotNull,
  or,
  inArray,
  eq,
  lte,
  gte,
} from "drizzle-orm";

interface ProcessReviewResult {
  processed: number;
  notified: number;
  scheduleProcessed: number;
  scheduleNotified: number;
}

export async function processReviewReminders(): Promise<ProcessReviewResult> {
  const now = new Date();
  let notified = 0;
  let scheduleNotified = 0;

  console.log(
    `[cron:process-review-reminders] Starting at ${now.toISOString()}`,
  );

  // ──────────────────────────────────────────────────────────────
  // Part 1: Legacy process table review fields
  // ──────────────────────────────────────────────────────────────

  // Find processes where:
  // - review_date IS NOT NULL AND review_date BETWEEN NOW() AND NOW() + 14 days
  // - OR review_cycle_days IS NOT NULL AND last_reviewed_at + review_cycle_days < NOW() + 14 days
  // - AND process_owner_id IS NOT NULL
  // - AND status IN ('published', 'approved')
  // - AND deleted_at IS NULL
  const upcomingReviews = await db
    .select({
      id: process.id,
      orgId: process.orgId,
      name: process.name,
      processOwnerId: process.processOwnerId,
      reviewDate: process.reviewDate,
      reviewCycleDays: process.reviewCycleDays,
      lastReviewedAt: process.lastReviewedAt,
    })
    .from(process)
    .where(
      and(
        isNotNull(process.processOwnerId),
        inArray(process.status, ["published", "approved"]),
        isNull(process.deletedAt),
        or(
          // Explicit review date within 14 days
          sql`${process.reviewDate} IS NOT NULL AND ${process.reviewDate} BETWEEN NOW() AND NOW() + INTERVAL '14 days'`,
          // Cycle-based: last_reviewed_at + cycle_days is within 14 days from now
          sql`${process.reviewCycleDays} IS NOT NULL AND ${process.lastReviewedAt} IS NOT NULL AND (${process.lastReviewedAt} + (${process.reviewCycleDays} || ' days')::interval) BETWEEN NOW() AND NOW() + INTERVAL '14 days'`,
          // Cycle-based but never reviewed: created_at + cycle_days is within 14 days
          sql`${process.reviewCycleDays} IS NOT NULL AND ${process.lastReviewedAt} IS NULL AND (${process.createdAt} + (${process.reviewCycleDays} || ' days')::interval) BETWEEN NOW() AND NOW() + INTERVAL '14 days'`,
        ),
      ),
    );

  for (const proc of upcomingReviews) {
    try {
      let daysUntilReview = 0;
      let reviewDateStr = "";

      if (proc.reviewDate) {
        const rd = new Date(proc.reviewDate);
        daysUntilReview = Math.ceil(
          (rd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        reviewDateStr = rd.toISOString().split("T")[0];
      } else if (proc.reviewCycleDays) {
        const baseDate = proc.lastReviewedAt
          ? new Date(proc.lastReviewedAt)
          : new Date(proc.id); // fallback — should use createdAt
        const nextReview = new Date(
          baseDate.getTime() + proc.reviewCycleDays * 86400000,
        );
        daysUntilReview = Math.ceil(
          (nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        reviewDateStr = nextReview.toISOString().split("T")[0];
      }

      await db.insert(notification).values({
        userId: proc.processOwnerId!,
        orgId: proc.orgId,
        type: "deadline_approaching" as const,
        entityType: "process",
        entityId: proc.id,
        title: `Process review upcoming: ${proc.name}`,
        message: `Process "${proc.name}" is due for review in ${daysUntilReview} day(s) (${reviewDateStr}).`,
        channel: "both" as const,
        templateKey: "process_review_reminder",
        templateData: {
          processName: proc.name,
          reviewDate: reviewDateStr,
          daysUntilReview,
        },
        createdAt: now,
        updatedAt: now,
      });

      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:process-review-reminders] Failed for process ${proc.id}:`,
        message,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Part 2: Process review schedules (Sprint 3b)
  // ──────────────────────────────────────────────────────────────
  // Find active schedules where nextReviewDate falls within:
  // - 30 days from now (upcoming reminder)
  // - 0 days (due today)
  // - Past dates (overdue — creates task)

  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
  const todayStr = now.toISOString().split("T")[0];

  const scheduleReviews = await db
    .select({
      scheduleId: processReviewSchedule.id,
      orgId: processReviewSchedule.orgId,
      processId: processReviewSchedule.processId,
      nextReviewDate: processReviewSchedule.nextReviewDate,
      assignedReviewerId: processReviewSchedule.assignedReviewerId,
      lastReminderSentAt: processReviewSchedule.lastReminderSentAt,
      processName: process.name,
      processOwnerId: process.processOwnerId,
    })
    .from(processReviewSchedule)
    .innerJoin(process, eq(process.id, processReviewSchedule.processId))
    .where(
      and(
        eq(processReviewSchedule.isActive, true),
        lte(
          processReviewSchedule.nextReviewDate,
          thirtyDaysFromNow.toISOString().split("T")[0],
        ),
        isNull(process.deletedAt),
        or(
          // No reminder sent yet
          isNull(processReviewSchedule.lastReminderSentAt),
          // Last reminder was sent more than 7 days ago (avoid spamming)
          sql`${processReviewSchedule.lastReminderSentAt} < NOW() - INTERVAL '7 days'`,
        ),
      ),
    );

  for (const sched of scheduleReviews) {
    try {
      const reviewDate = new Date(sched.nextReviewDate);
      const daysUntilReview = Math.ceil(
        (reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const reviewDateStr = reviewDate.toISOString().split("T")[0];

      // Determine notification recipient: assignedReviewer or processOwner
      const recipientId = sched.assignedReviewerId ?? sched.processOwnerId;
      if (!recipientId) continue;

      // Determine urgency
      const isOverdue = daysUntilReview < 0;
      const isDueToday = daysUntilReview === 0;

      const urgencyLabel = isOverdue
        ? "OVERDUE"
        : isDueToday
          ? "DUE TODAY"
          : `in ${daysUntilReview} day(s)`;

      await db.insert(notification).values({
        userId: recipientId,
        orgId: sched.orgId,
        type: isOverdue
          ? ("escalation" as const)
          : ("deadline_approaching" as const),
        entityType: "process",
        entityId: sched.processId,
        title: `Process review ${urgencyLabel}: ${sched.processName}`,
        message: `Process "${sched.processName}" review is ${urgencyLabel} (${reviewDateStr}).`,
        channel: "both" as const,
        templateKey: isOverdue
          ? "process_review_overdue"
          : "process_review_reminder",
        templateData: {
          processName: sched.processName,
          reviewDate: reviewDateStr,
          daysUntilReview,
          isOverdue,
        },
        createdAt: now,
        updatedAt: now,
      });

      // Update last_reminder_sent_at
      await db
        .update(processReviewSchedule)
        .set({ lastReminderSentAt: now })
        .where(eq(processReviewSchedule.id, sched.scheduleId));

      scheduleNotified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:process-review-reminders] Failed for schedule ${sched.scheduleId}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:process-review-reminders] Legacy: ${upcomingReviews.length} processed, ${notified} notified. Schedules: ${scheduleReviews.length} processed, ${scheduleNotified} notified.`,
  );

  return {
    processed: upcomingReviews.length,
    notified,
    scheduleProcessed: scheduleReviews.length,
    scheduleNotified,
  };
}
