// Cron Job: RCSA Reminder
// DAILY at 08:00 — Send reminders for pending assignments approaching deadline
// Checks: 7d, 3d, 1d before deadline based on campaign's reminderDaysBefore setting

import { db, rcsaCampaign, rcsaAssignment, notification, user } from "@grc/db";
import { eq, and, sql, lt, gt } from "drizzle-orm";

interface RcsaReminderResult {
  processed: number;
  remindersSent: number;
  errors: string[];
}

export async function processRcsaReminder(): Promise<RcsaReminderResult> {
  const errors: string[] = [];
  let remindersSent = 0;
  const now = new Date();

  console.log(`[cron:rcsa-reminder] Starting at ${now.toISOString()}`);

  // Find all active campaigns
  const activeCampaigns = await db
    .select()
    .from(rcsaCampaign)
    .where(eq(rcsaCampaign.status, "active"));

  if (activeCampaigns.length === 0) {
    console.log("[cron:rcsa-reminder] No active campaigns found");
    return { processed: 0, remindersSent: 0, errors: [] };
  }

  for (const campaign of activeCampaigns) {
    try {
      const reminderDays = campaign.reminderDaysBefore ?? 7;

      // Find pending/in_progress assignments where deadline is approaching
      const pendingAssignments = await db
        .select()
        .from(rcsaAssignment)
        .where(
          and(
            eq(rcsaAssignment.campaignId, campaign.id),
            sql`${rcsaAssignment.status} IN ('pending', 'in_progress')`,
            // Deadline is in the future but within reminder window
            gt(rcsaAssignment.deadline, now),
            lt(
              rcsaAssignment.deadline,
              sql`NOW() + INTERVAL '${sql.raw(String(reminderDays))} days'`,
            ),
          ),
        );

      // Group by user
      const byUser = new Map<string, typeof pendingAssignments>();
      for (const assignment of pendingAssignments) {
        const existing = byUser.get(assignment.userId) ?? [];
        existing.push(assignment);
        byUser.set(assignment.userId, existing);
      }

      for (const [userId, userAssignments] of byUser.entries()) {
        // Check days until deadline (use first assignment's deadline as reference)
        const firstDeadline = userAssignments[0].deadline;
        const daysRemaining = Math.ceil(
          (firstDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Only send at 7, 3, 1 day marks
        if (daysRemaining !== 7 && daysRemaining !== 3 && daysRemaining !== 1) {
          continue;
        }

        try {
          await db.insert(notification).values({
            orgId: campaign.orgId,
            userId,
            type: "deadline_approaching",
            entityType: "rcsa_campaign",
            entityId: campaign.id,
            title: `RCSA Reminder: ${campaign.name}`,
            message: `You have ${userAssignments.length} pending assessment(s) for "${campaign.name}". Deadline in ${daysRemaining} day(s).`,
            channel: "both",
            templateKey: "rcsa_reminder",
            templateData: {
              campaignName: campaign.name,
              pendingCount: userAssignments.length,
              deadline: campaign.periodEnd,
              daysRemaining,
            },
            createdAt: now,
            updatedAt: now,
          });

          // Increment reminders_sent on each assignment
          for (const assignment of userAssignments) {
            await db
              .update(rcsaAssignment)
              .set({
                remindersSent: (assignment.remindersSent ?? 0) + 1,
                updatedAt: now,
              })
              .where(eq(rcsaAssignment.id, assignment.id));
          }

          remindersSent++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`Reminder for user ${userId} in campaign ${campaign.id}: ${message}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Campaign ${campaign.id}: ${message}`);
    }
  }

  console.log(
    `[cron:rcsa-reminder] Processed ${activeCampaigns.length} campaigns, sent ${remindersSent} reminders, ${errors.length} errors`,
  );

  return { processed: activeCampaigns.length, remindersSent, errors };
}
