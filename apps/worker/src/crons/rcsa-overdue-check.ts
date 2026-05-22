// Cron Job: RCSA Overdue Check
// DAILY at 09:00 — Mark overdue assignments and escalate to campaign creator

import { db, rcsaCampaign, rcsaAssignment, notification } from "@grc/db";
import { eq, and, sql, lt } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface RcsaOverdueResult {
  processed: number;
  markedOverdue: number;
  escalationsSent: number;
  errors: string[];
}

export const processRcsaOverdueCheck = withCronInstrumentation(
  "rcsa-overdue-check",
  async (): Promise<RcsaOverdueResult> => {
    const errors: string[] = [];
    let markedOverdue = 0;
    let escalationsSent = 0;
    const now = new Date();

  // Find all active campaigns
  const activeCampaigns = await db
    .select()
    .from(rcsaCampaign)
    .where(eq(rcsaCampaign.status, "active"));

  if (activeCampaigns.length === 0) {
    console.log("[cron:rcsa-overdue-check] No active campaigns found");
    return { processed: 0, markedOverdue: 0, escalationsSent: 0, errors: [] };
  }

  for (const campaign of activeCampaigns) {
    try {
      // Find assignments that are past deadline and still pending/in_progress
      const overdueAssignments = await db
        .select()
        .from(rcsaAssignment)
        .where(
          and(
            eq(rcsaAssignment.campaignId, campaign.id),
            sql`${rcsaAssignment.status} IN ('pending', 'in_progress')`,
            lt(rcsaAssignment.deadline, now),
          ),
        );

      if (overdueAssignments.length === 0) continue;

      // Mark all as overdue
      const overdueIds = overdueAssignments.map((a) => a.id);
      await db
        .update(rcsaAssignment)
        .set({
          status: "overdue",
          updatedAt: now,
        })
        .where(sql`${rcsaAssignment.id} = ANY(${overdueIds}::uuid[])`);

      markedOverdue += overdueAssignments.length;

      // Send escalation to campaign creator
      if (campaign.createdBy) {
        const overdueUserIds = [
          ...new Set(overdueAssignments.map((a) => a.userId)),
        ];

        try {
          await db.insert(notification).values({
            orgId: campaign.orgId,
            userId: campaign.createdBy,
            type: "escalation",
            entityType: "rcsa_campaign",
            entityId: campaign.id,
            title: `RCSA Overdue: ${campaign.name}`,
            message: `${overdueAssignments.length} assessment(s) in "${campaign.name}" are overdue from ${overdueUserIds.length} participant(s).`,
            channel: "both",
            templateKey: "rcsa_escalation",
            templateData: {
              campaignName: campaign.name,
              overdueCount: overdueAssignments.length,
              overdueParticipants: overdueUserIds.length,
            },
            createdAt: now,
            updatedAt: now,
          });

          escalationsSent++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`Escalation for campaign ${campaign.id}: ${message}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Campaign ${campaign.id}: ${message}`);
    }
  }

    return {
      processed: activeCampaigns.length,
      markedOverdue,
      escalationsSent,
      errors,
    };
  },
);
