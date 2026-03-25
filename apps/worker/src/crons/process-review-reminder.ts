// Cron Job: Process Review Reminders
// Finds processes where review_date is within the next 14 days
// or where review_cycle_days triggers a reminder, and creates
// notifications for the process owner.

import { db, process, notification } from "@grc/db";
import { and, isNull, sql, isNotNull, or, inArray } from "drizzle-orm";

interface ProcessReviewResult {
  processed: number;
  notified: number;
}

export async function processReviewReminders(): Promise<ProcessReviewResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:process-review-reminders] Starting at ${now.toISOString()}`);

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

  if (upcomingReviews.length === 0) {
    console.log("[cron:process-review-reminders] No upcoming process reviews found");
    return { processed: 0, notified: 0 };
  }

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
        const nextReview = new Date(baseDate.getTime() + proc.reviewCycleDays * 86400000);
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

  console.log(
    `[cron:process-review-reminders] Processed ${upcomingReviews.length} processes, ${notified} notifications created`,
  );

  return { processed: upcomingReviews.length, notified };
}
