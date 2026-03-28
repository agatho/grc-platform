// Sprint 45: ESG Data Collection Reminder (Daily)
// Send reminders for upcoming collection deadlines

import { db, esgCollectionCampaign, esgCollectionAssignment, notification } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";

interface CollectionReminderResult { processed: number; reminders: number; }

export async function processEsgCollectionReminder(): Promise<CollectionReminderResult> {
  console.log(`[cron:esg-collection-reminder] Starting`);
  let reminders = 0;

  // Find active campaigns with approaching deadlines
  const campaigns = await db
    .select()
    .from(esgCollectionCampaign)
    .where(
      and(
        eq(esgCollectionCampaign.status, "active"),
        sql`${esgCollectionCampaign.deadline}::date > CURRENT_DATE`,
        sql`${esgCollectionCampaign.deadline}::date <= CURRENT_DATE + INTERVAL '14 days'`,
      ),
    );

  for (const campaign of campaigns) {
    // Find pending assignments
    const pending = await db
      .select()
      .from(esgCollectionAssignment)
      .where(
        and(
          eq(esgCollectionAssignment.campaignId, campaign.id),
          eq(esgCollectionAssignment.status, "pending"),
        ),
      );

    for (const assignment of pending) {
      try {
        await db.insert(notification).values({
          userId: assignment.assigneeId,
          orgId: campaign.orgId,
          type: "deadline_approaching" as const,
          entityType: "esg_collection_assignment",
          entityId: assignment.id,
          title: `ESG data collection: "${campaign.title}" — submission due ${campaign.deadline}`,
          message: `Please submit your ESG metric data for campaign "${campaign.title}". Deadline: ${campaign.deadline}.`,
          channel: "both" as const,
        });
        reminders++;
      } catch { /* skip */ }
    }
  }

  console.log(`[cron:esg-collection-reminder] Sent ${reminders} reminders`);
  return { processed: campaigns.length, reminders };
}
