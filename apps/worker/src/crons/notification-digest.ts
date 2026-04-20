// Cron Job: Daily Notification Digest
// Collects unread notifications for users with daily digest preference
// and sends a consolidated digest email.

import { db, notification, user } from "@grc/db";
import { eq, and, isNull, gte, sql } from "drizzle-orm";
import { emailService } from "@grc/email";

interface DigestResult {
  usersProcessed: number;
  emailsSent: number;
}

export async function processNotificationDigest(): Promise<DigestResult> {
  const now = new Date();
  let emailsSent = 0;

  console.log(`[cron:notification-digest] Starting at ${now.toISOString()}`);

  // Find users who have opted into daily digest emails
  const digestUsers = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      language: user.language,
    })
    .from(user)
    .where(
      and(
        sql`${user.notificationPreferences}->>'emailMode' = 'daily_digest'`,
        eq(user.isActive, true),
        isNull(user.deletedAt),
      ),
    );

  if (digestUsers.length === 0) {
    console.log(
      "[cron:notification-digest] No users with daily digest enabled",
    );
    return { usersProcessed: 0, emailsSent: 0 };
  }

  // 24 hours ago
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const digestUser of digestUsers) {
    try {
      // Collect unread notifications from the last 24 hours
      // that haven't already been sent as part of a digest
      const unreadNotifications = await db
        .select({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          entityType: notification.entityType,
          entityId: notification.entityId,
          createdAt: notification.createdAt,
        })
        .from(notification)
        .where(
          and(
            eq(notification.userId, digestUser.id),
            eq(notification.isRead, false),
            isNull(notification.emailSentAt),
            isNull(notification.deletedAt),
            gte(notification.createdAt, since),
          ),
        )
        .orderBy(notification.createdAt);

      if (unreadNotifications.length === 0) {
        continue;
      }

      const lang = (digestUser.language === "en" ? "en" : "de") as "de" | "en";

      const platformUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      // Build digest notification items for the template
      const notificationItems = unreadNotifications.map((n) => ({
        type: n.type,
        title: n.title,
        timestamp: n.createdAt.toISOString(),
        url:
          n.entityType && n.entityId
            ? `${platformUrl}/${n.entityType}s/${n.entityId}`
            : undefined,
      }));

      const digestDate = now.toLocaleDateString(
        lang === "de" ? "de-DE" : "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        },
      );

      await emailService.send({
        to: digestUser.email,
        templateKey: "notification_digest",
        data: {
          notifications: notificationItems,
          platformUrl,
          recipientName: digestUser.name,
          digestDate,
        },
        lang,
      });

      // Mark all included notifications as email-sent
      const notificationIds = unreadNotifications.map((n) => n.id);
      await db
        .update(notification)
        .set({
          emailSentAt: now,
          updatedAt: now,
        })
        .where(sql`${notification.id} = ANY(${notificationIds}::uuid[])`);

      emailsSent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:notification-digest] Failed for user ${digestUser.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:notification-digest] Processed ${digestUsers.length} users, sent ${emailsSent} digests`,
  );

  return { usersProcessed: digestUsers.length, emailsSent };
}
