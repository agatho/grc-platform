// Cron Job: Scheduled Notification Email Delivery
// Finds pending email notifications and sends them via the EmailService,
// tracking delivery status and handling retries.

import { db, notification, user } from "@grc/db";
import { eq, and, lte, isNull, inArray, lt, sql } from "drizzle-orm";
import { emailService } from "@grc/email";
import type { EmailTemplateKey } from "@grc/email";

const MAX_RETRIES = 3;

interface ScheduledNotificationResult {
  processed: number;
  sent: number;
  failed: number;
}

export async function processScheduledNotifications(): Promise<ScheduledNotificationResult> {
  const now = new Date();
  let sent = 0;
  let failed = 0;

  console.log(`[cron:scheduled-notifications] Starting at ${now.toISOString()}`);

  // Find notifications that are due for email delivery
  const pendingNotifications = await db
    .select({
      id: notification.id,
      userId: notification.userId,
      orgId: notification.orgId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      channel: notification.channel,
      templateKey: notification.templateKey,
      templateData: notification.templateData,
      retryCount: notification.retryCount,
    })
    .from(notification)
    .where(
      and(
        lte(notification.scheduledFor, sql`NOW()`),
        isNull(notification.emailSentAt),
        isNull(notification.deletedAt),
        inArray(notification.channel, ["email", "both"]),
        lt(notification.retryCount, MAX_RETRIES)
      )
    );

  if (pendingNotifications.length === 0) {
    console.log("[cron:scheduled-notifications] No pending notifications");
    return { processed: 0, sent: 0, failed: 0 };
  }

  for (const notif of pendingNotifications) {
    try {
      // Look up the recipient's email and language preference
      const [recipient] = await db
        .select({
          email: user.email,
          name: user.name,
          language: user.language,
        })
        .from(user)
        .where(eq(user.id, notif.userId))
        .limit(1);

      if (!recipient) {
        await db
          .update(notification)
          .set({
            emailError: "Recipient user not found",
            retryCount: MAX_RETRIES, // No point retrying
            updatedAt: now,
          })
          .where(eq(notification.id, notif.id));
        failed++;
        continue;
      }

      // Determine the template key — fall back to task_reminder if missing
      const templateKey: EmailTemplateKey =
        (notif.templateKey as EmailTemplateKey) ?? "task_reminder";

      const lang = (recipient.language === "en" ? "en" : "de") as "de" | "en";

      // Build template data from notification fields + stored template data
      const templateData: Record<string, unknown> = {
        ...(notif.templateData as Record<string, unknown> | null),
        notificationTitle: notif.title,
        notificationMessage: notif.message,
        recipientName: recipient.name,
      };

      const result = await emailService.send({
        to: recipient.email,
        templateKey,
        data: templateData,
        lang,
      });

      // On success: record delivery timestamp and message ID
      await db
        .update(notification)
        .set({
          emailSentAt: now,
          emailMessageId: result?.messageId ?? null,
          emailError: null,
          updatedAt: now,
        })
        .where(eq(notification.id, notif.id));

      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // On failure: record the error and increment retry count
      await db
        .update(notification)
        .set({
          emailError: message,
          retryCount: (notif.retryCount ?? 0) + 1,
          updatedAt: now,
        })
        .where(eq(notification.id, notif.id));

      failed++;
      console.error(
        `[cron:scheduled-notifications] Failed to send notification ${notif.id}:`,
        message
      );
    }
  }

  console.log(
    `[cron:scheduled-notifications] Processed ${pendingNotifications.length}: ${sent} sent, ${failed} failed`
  );

  return { processed: pendingNotifications.length, sent, failed };
}
