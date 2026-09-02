// Cron Job: Scheduled Notification Email Delivery
// Finds pending email notifications and sends them via the EmailService,
// tracking delivery status and handling retries.

import { db, notification, user } from "@grc/db";
import { eq, and, lte, isNull, inArray, lt, sql } from "drizzle-orm";
import { emailService, isEmailTemplateKey } from "@grc/email";
import type { EmailTemplateKey } from "@grc/email";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { createRunReport } from "../lib/job-runtime";

const MAX_RETRIES = 3;

interface ScheduledNotificationResult {
  processed: number;
  sent: number;
  failed: number;
  /** Not sent because delivery is switched off — NOT counted as delivered. */
  skipped: number;
  ok: boolean;
  errors: string[];
}

export const processScheduledNotifications = withCronInstrumentation(
  "scheduled-notifications",
  async (): Promise<ScheduledNotificationResult> => {
    const now = new Date();
    const report = createRunReport("scheduled-notifications");
    let sent = 0;
    let failed = 0;
    let skipped = 0;

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
          lt(notification.retryCount, MAX_RETRIES),
        ),
      );

    if (pendingNotifications.length === 0) {
      return report.toResult({ processed: 0, sent: 0, failed: 0, skipped: 0 });
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
          // [ARCTOS-FULL-2026-08-31 · OP-108] Dieser Zweig zaehlte nur den
          // lokalen `failed`-Zaehler hoch. `report.toResult()` ueberschreibt
          // `failed`/`ok` mit den Zahlen des Reports — eine Benachrichtigung,
          // die nie zugestellt werden kann, kam damit als
          // `{ failed: 0, ok: true }` zurueck: dieselbe Klasse wie S10-12
          // ("Teilfehlschlag als Erfolg gemeldet"), einen Zweig weiter. Der
          // Zweig darunter (unbekannter Template-Key) hat es richtig gemacht.
          report.fail(
            `notification ${notif.id}`,
            new Error("recipient user not found"),
          );
          failed++;
          continue;
        }

        // [WP9 · S10-03] `notification.template_key` is a plain varchar and
        // the `as EmailTemplateKey` cast silently disabled the type check.
        // 36 of the 38 keys the crons wrote had no renderer, hit
        // `default: throw`, burned three retries and were then excluded
        // forever by `retry_count < 3` — including the GDPR Art. 33 warning.
        // The key set now covers all of them, but the column can still hold
        // a stale value, so it is validated instead of cast.
        const rawKey = notif.templateKey ?? "task_reminder";
        if (!isEmailTemplateKey(rawKey)) {
          await db
            .update(notification)
            .set({
              emailError: `Unknown e-mail template key "${rawKey}"`,
              retryCount: MAX_RETRIES, // retrying cannot help
              updatedAt: now,
            })
            .where(eq(notification.id, notif.id));
          report.fail(
            `notification ${notif.id}`,
            new Error(`unknown e-mail template key "${rawKey}"`),
          );
          failed++;
          continue;
        }
        const templateKey: EmailTemplateKey = rawKey;

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

        // [WP9 · S10-04 B] The old code wrote `emailSentAt = now` here
        // unconditionally, with `result?.messageId ?? null`. Two ways that
        // was wrong:
        //
        //   * `result === null` means e-mail delivery is switched OFF —
        //     and `EMAIL_ENABLED` defaults to false in
        //     docker-compose.production.yml, so this was the DEFAULT path.
        //     The platform stamped every notification as delivered without
        //     sending anything, and because `isNull(emailSentAt)` excludes
        //     those rows, they could never be sent later either.
        //   * an empty `messageId` meant the provider had rejected the
        //     message (see S10-04 A) — also recorded as delivered.
        //
        // `emailSentAt` is the evidence that a deadline was communicated.
        // It is now written only when the provider returned a message id.
        if (!result) {
          await db
            .update(notification)
            .set({
              emailError:
                "not sent: e-mail delivery is disabled (EMAIL_ENABLED != true)",
              updatedAt: now,
              // retryCount deliberately NOT incremented: the notification is
              // not broken, the mailer is off. It must still be sendable
              // once e-mail is switched on.
            })
            .where(eq(notification.id, notif.id));
          skipped++;
          continue;
        }
        if (!result.messageId) {
          throw new Error(
            "e-mail provider returned no message id — treating as not delivered",
          );
        }

        await db
          .update(notification)
          .set({
            emailSentAt: now,
            emailMessageId: result.messageId,
            emailError: null,
            updatedAt: now,
          })
          .where(eq(notification.id, notif.id));

        sent++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        report.fail(`notification ${notif.id}`, err);

        // On failure: record the error and increment the retry count
        await db
          .update(notification)
          .set({
            emailError: message,
            retryCount: (notif.retryCount ?? 0) + 1,
            updatedAt: now,
          })
          .where(eq(notification.id, notif.id));

        failed++;
      }
    }

    return report.toResult({
      processed: pendingNotifications.length,
      sent,
      failed,
      skipped,
    });
  },
);
