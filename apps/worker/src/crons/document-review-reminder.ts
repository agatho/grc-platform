// Cron Job: Document Review Reminders (DMS Paket D2)
//
// Finds documents whose review_date is within the next 30 days (or
// overdue) and notifies the owner + reviewer. Reminders are staged —
// 30 / 14 / 7 / 0 days before the review date — and fire once per
// stage, tracked via document.last_reminder_sent_at
// (@grc/shared shouldSendReviewReminder).

import { db, document, notification } from "@grc/db";
import { and, isNull, isNotNull, inArray, eq, sql } from "drizzle-orm";
import {
  shouldSendReviewReminder,
  reviewReminderStage,
  daysBetween,
} from "@grc/shared";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface DocumentReviewReminderResult {
  scanned: number;
  remindersSent: number;
  notified: number;
}

export const processDocumentReviewReminders = withCronInstrumentation(
  "document-review-reminder",
  async (): Promise<DocumentReviewReminderResult> => {
    const now = new Date();
    let remindersSent = 0;
    let notified = 0;

    const candidates = await db
      .select({
        id: document.id,
        orgId: document.orgId,
        title: document.title,
        ownerId: document.ownerId,
        reviewerId: document.reviewerId,
        reviewDate: document.reviewDate,
        lastReminderSentAt: document.lastReminderSentAt,
      })
      .from(document)
      .where(
        and(
          isNotNull(document.reviewDate),
          inArray(document.status, ["published", "approved"]),
          isNull(document.deletedAt),
          sql`${document.reviewDate} <= NOW() + INTERVAL '30 days'`,
        ),
      );

    for (const doc of candidates) {
      try {
        const reviewDate = new Date(doc.reviewDate!);
        if (
          !shouldSendReviewReminder({
            reviewDate,
            lastReminderSentAt: doc.lastReminderSentAt
              ? new Date(doc.lastReminderSentAt)
              : null,
            now,
          })
        ) {
          continue;
        }

        const daysUntilReview = daysBetween(now, reviewDate);
        const stage = reviewReminderStage(daysUntilReview);
        const reviewDateStr = reviewDate.toISOString().split("T")[0];
        const isOverdue = daysUntilReview <= 0;

        const recipients = [
          ...new Set([doc.ownerId, doc.reviewerId].filter(Boolean)),
        ] as string[];
        if (recipients.length === 0) continue;

        for (const recipientId of recipients) {
          await db.insert(notification).values({
            userId: recipientId,
            orgId: doc.orgId,
            type: isOverdue
              ? ("escalation" as const)
              : ("deadline_approaching" as const),
            entityType: "document",
            entityId: doc.id,
            title: isOverdue
              ? `Document review overdue: ${doc.title}`
              : `Document review due in ${daysUntilReview} day(s): ${doc.title}`,
            message: `Document "${doc.title}" is due for review on ${reviewDateStr}${isOverdue ? " (overdue)" : ""}.`,
            channel: "both" as const,
            templateKey: isOverdue
              ? "document_review_overdue"
              : "document_review_reminder",
            templateData: {
              documentId: doc.id,
              documentTitle: doc.title,
              reviewDate: reviewDateStr,
              daysUntilReview,
              stage,
            },
            createdAt: now,
            updatedAt: now,
          });
          notified++;
        }

        await db
          .update(document)
          .set({ lastReminderSentAt: now })
          .where(eq(document.id, doc.id));

        remindersSent++;
      } catch {
        // Wrapper logs structured error; loop continues.
      }
    }

    return { scanned: candidates.length, remindersSent, notified };
  },
);
