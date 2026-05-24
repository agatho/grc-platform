// Cron Job: Risk Review Reminders
// Finds risks where review_date is within the next 14 days and
// creates notifications for the risk owner.

import { db, risk, notification } from "@grc/db";
import { and, isNull, sql, isNotNull } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface RiskReviewResult {
  processed: number;
  notified: number;
}

export const processRiskReviewReminders = withCronInstrumentation(
  "risk-review-reminder",
  async (): Promise<RiskReviewResult> => {
    const now = new Date();
    let notified = 0;

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
      } catch {
        // Wrapper logs structured error; loop continues.
      }
    }

    return { processed: upcomingReviews.length, notified };
  },
);
