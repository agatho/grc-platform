// Cron Job: Policy Reminder
// DAILY at 08:00 — Send reminders for pending acknowledgments approaching deadline
// Checks: configurable days before deadline (default 7d, 3d, 1d)

import {
  db,
  policyDistribution,
  policyAcknowledgment,
  notification,
} from "@grc/db";
import { eq, and, sql, gt } from "drizzle-orm";

interface PolicyReminderResult {
  processed: number;
  remindersSent: number;
  errors: string[];
}

export async function processPolicyReminder(): Promise<PolicyReminderResult> {
  const errors: string[] = [];
  let remindersSent = 0;
  const now = new Date();

  console.log(`[cron:policy-reminder] Starting at ${now.toISOString()}`);

  // Find all active distributions
  const activeDistributions = await db
    .select()
    .from(policyDistribution)
    .where(eq(policyDistribution.status, "active"));

  if (activeDistributions.length === 0) {
    console.log("[cron:policy-reminder] No active distributions found");
    return { processed: 0, remindersSent: 0, errors: [] };
  }

  for (const dist of activeDistributions) {
    try {
      const reminderDays = (dist.reminderDaysBefore as number[]) ?? [7, 3, 1];
      const deadlineDate = new Date(dist.deadline);
      const daysUntilDeadline = Math.ceil(
        (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Only send reminders at configured day marks
      if (!reminderDays.includes(daysUntilDeadline)) {
        continue;
      }

      // Find pending acknowledgments
      const pendingAcks = await db
        .select()
        .from(policyAcknowledgment)
        .where(
          and(
            eq(policyAcknowledgment.distributionId, dist.id),
            sql`${policyAcknowledgment.status} IN ('pending', 'failed_quiz')`,
          ),
        );

      for (const ack of pendingAcks) {
        try {
          await db.insert(notification).values({
            userId: ack.userId,
            orgId: dist.orgId,
            type: "deadline_approaching",
            entityType: "policy_distribution",
            entityId: dist.id,
            title: `Reminder: Policy acknowledgment due in ${daysUntilDeadline} day(s)`,
            message: `Please read and acknowledge "${dist.title}" by ${deadlineDate.toLocaleDateString("de-DE")}.`,
            channel: "both",
            templateKey: "policy_reminder",
            templateData: {
              policyTitle: dist.title,
              deadline: dist.deadline,
              daysRemaining: daysUntilDeadline,
              distributionId: dist.id,
            },
            createdAt: now,
            updatedAt: now,
          });

          await db
            .update(policyAcknowledgment)
            .set({
              remindersSent: (ack.remindersSent ?? 0) + 1,
              updatedAt: now,
            })
            .where(eq(policyAcknowledgment.id, ack.id));

          remindersSent++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(
            `Reminder for user ${ack.userId} in dist ${dist.id}: ${message}`,
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Distribution ${dist.id}: ${message}`);
    }
  }

  console.log(
    `[cron:policy-reminder] Processed ${activeDistributions.length} distributions, sent ${remindersSent} reminders, ${errors.length} errors`,
  );

  return { processed: activeDistributions.length, remindersSent, errors };
}
