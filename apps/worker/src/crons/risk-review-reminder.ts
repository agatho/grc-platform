// Cron Job: Risk Review Reminders
// Finds risks where review_date is within the next 14 days and
// creates notifications for the risk owner.

import { db, risk, notification } from "@grc/db";
import { and, isNull, sql, isNotNull } from "drizzle-orm";

interface RiskReviewResult {
  processed: number;
  notified: number;
}

export async function processRiskReviewReminders(): Promise<RiskReviewResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:risk-review-reminders] Starting at ${now.toISOString()}`);

  // Find risks where review_date is between NOW() and NOW() + 14 days,
  // owner_id is set, and not soft-deleted
  const upcomingReviews = await db
    .select({
      id: risk.id,
      orgId: risk.orgId,
      title: risk.title,
      ownerId: risk.ownerId,
      reviewDate: risk.reviewDate,
    })
    .from(risk)
    .where(
      and(
        sql`${risk.reviewDate}::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'`,
        isNotNull(risk.ownerId),
        isNull(risk.deletedAt),
      ),
    );

  if (upcomingReviews.length === 0) {
    console.log("[cron:risk-review-reminders] No upcoming risk reviews found");
    return { processed: 0, notified: 0 };
  }

  for (const riskRow of upcomingReviews) {
    try {
      const reviewDate = riskRow.reviewDate;
      const daysUntilReview = reviewDate
        ? Math.ceil(
            (new Date(reviewDate).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

      await db.insert(notification).values({
        userId: riskRow.ownerId!,
        orgId: riskRow.orgId,
        type: "deadline_approaching" as const,
        entityType: "risk",
        entityId: riskRow.id,
        title: `Risk review upcoming: ${riskRow.title}`,
        message: `Risk "${riskRow.title}" is due for review in ${daysUntilReview} day(s) (${reviewDate}).`,
        channel: "both" as const,
        templateKey: "risk_review_reminder",
        templateData: {
          riskTitle: riskRow.title,
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
        `[cron:risk-review-reminders] Failed for risk ${riskRow.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:risk-review-reminders] Processed ${upcomingReviews.length} risks, ${notified} notifications created`,
  );

  return { processed: upcomingReviews.length, notified };
}
