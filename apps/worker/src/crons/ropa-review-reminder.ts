// Cron Job: RoPA Review Reminder (Monthly)
// Reminds responsible users 14 days before next_review_date.

import { db, ropaEntry, notification } from "@grc/db";
import { and, isNull, sql, isNotNull } from "drizzle-orm";

interface RopaReviewResult {
  processed: number;
  notified: number;
}

export async function processRopaReviewReminders(): Promise<RopaReviewResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:ropa-review-reminder] Starting at ${now.toISOString()}`);

  // Find RoPA entries where next_review_date is within the next 14 days,
  // responsible_id is set, and not soft-deleted
  const upcomingReviews = await db
    .select({
      id: ropaEntry.id,
      orgId: ropaEntry.orgId,
      title: ropaEntry.title,
      responsibleId: ropaEntry.responsibleId,
      nextReviewDate: ropaEntry.nextReviewDate,
    })
    .from(ropaEntry)
    .where(
      and(
        sql`${ropaEntry.nextReviewDate}::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'`,
        isNotNull(ropaEntry.responsibleId),
        isNull(ropaEntry.deletedAt),
      ),
    );

  if (upcomingReviews.length === 0) {
    console.log("[cron:ropa-review-reminder] No upcoming RoPA reviews found");
    return { processed: 0, notified: 0 };
  }

  for (const entry of upcomingReviews) {
    try {
      const reviewDate = entry.nextReviewDate;
      const daysUntilReview = reviewDate
        ? Math.ceil(
            (new Date(reviewDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;

      await db.insert(notification).values({
        userId: entry.responsibleId!,
        orgId: entry.orgId,
        type: "deadline_approaching" as const,
        entityType: "ropa_entry",
        entityId: entry.id,
        title: `RoPA review upcoming: ${entry.title}`,
        message: `Processing activity "${entry.title}" is due for review in ${daysUntilReview} day(s) (${reviewDate}).`,
        channel: "both" as const,
        templateKey: "ropa_review_reminder",
        templateData: {
          ropaTitle: entry.title,
          reviewDate,
          daysUntilReview,
        },
        createdAt: now,
        updatedAt: now,
      });

      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:ropa-review-reminder] Failed for RoPA ${entry.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:ropa-review-reminder] Processed ${upcomingReviews.length} entries, ${notified} notifications created`,
  );

  return { processed: upcomingReviews.length, notified };
}
