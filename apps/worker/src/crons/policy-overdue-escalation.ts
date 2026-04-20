// Cron Job: Policy Overdue Escalation
// WEEKLY — Mark overdue acknowledgments, escalate to distribution creator

import {
  db,
  policyDistribution,
  policyAcknowledgment,
  notification,
  user,
} from "@grc/db";
import { eq, and, sql, lt } from "drizzle-orm";

interface PolicyOverdueResult {
  processed: number;
  markedOverdue: number;
  escalationsSent: number;
  errors: string[];
}

export async function processPolicyOverdueEscalation(): Promise<PolicyOverdueResult> {
  const errors: string[] = [];
  let markedOverdue = 0;
  let escalationsSent = 0;
  const now = new Date();

  console.log(
    `[cron:policy-overdue-escalation] Starting at ${now.toISOString()}`,
  );

  // Find active distributions past their deadline
  const overdueDistributions = await db
    .select()
    .from(policyDistribution)
    .where(
      and(
        eq(policyDistribution.status, "active"),
        lt(policyDistribution.deadline, now),
      ),
    );

  if (overdueDistributions.length === 0) {
    console.log(
      "[cron:policy-overdue-escalation] No overdue distributions found",
    );
    return { processed: 0, markedOverdue: 0, escalationsSent: 0, errors: [] };
  }

  for (const dist of overdueDistributions) {
    try {
      // Mark pending acknowledgments as overdue
      const result = await db
        .update(policyAcknowledgment)
        .set({
          status: "overdue",
          updatedAt: now,
        })
        .where(
          and(
            eq(policyAcknowledgment.distributionId, dist.id),
            eq(policyAcknowledgment.status, "pending"),
          ),
        )
        .returning();

      markedOverdue += result.length;

      // Count total overdue for this distribution
      const overdueResult = await db.execute(sql`
        SELECT
          COUNT(*)::int as overdue_count,
          array_agg(u.name) as overdue_names
        FROM policy_acknowledgment pa
        INNER JOIN "user" u ON u.id = pa.user_id
        WHERE pa.distribution_id = ${dist.id}
          AND pa.status = 'overdue'
      `);

      const overdueCount = (overdueResult[0] as { overdue_count: number })
        .overdue_count;
      const overdueNames = (overdueResult[0] as { overdue_names: string[] })
        .overdue_names;

      if (overdueCount > 0 && dist.distributedBy) {
        // Send escalation to distribution creator
        await db.insert(notification).values({
          userId: dist.distributedBy,
          orgId: dist.orgId,
          type: "deadline_approaching",
          entityType: "policy_distribution",
          entityId: dist.id,
          title: `Escalation: ${overdueCount} overdue acknowledgment(s) for "${dist.title}"`,
          message: `The following employees have not acknowledged the policy: ${(overdueNames ?? []).slice(0, 10).join(", ")}${overdueCount > 10 ? ` and ${overdueCount - 10} more` : ""}.`,
          channel: "both",
          templateKey: "policy_escalation",
          templateData: {
            policyTitle: dist.title,
            overdueCount,
            overdueUsers: (overdueNames ?? []).slice(0, 20).join(", "),
            distributionId: dist.id,
          },
          createdAt: now,
          updatedAt: now,
        });

        // Send overdue notification to each overdue user
        for (const ackRecord of result) {
          try {
            await db.insert(notification).values({
              userId: ackRecord.userId,
              orgId: dist.orgId,
              type: "deadline_approaching",
              entityType: "policy_distribution",
              entityId: dist.id,
              title: `OVERDUE: Policy acknowledgment past deadline — ${dist.title}`,
              message: `Your policy acknowledgment is overdue. The deadline was ${new Date(dist.deadline).toLocaleDateString("de-DE")}. Please acknowledge immediately.`,
              channel: "both",
              templateKey: "policy_overdue",
              templateData: {
                policyTitle: dist.title,
                deadline: dist.deadline,
                distributionId: dist.id,
              },
              createdAt: now,
              updatedAt: now,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(
              `Overdue notification for user ${ackRecord.userId}: ${message}`,
            );
          }
        }

        escalationsSent++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Distribution ${dist.id}: ${message}`);
    }
  }

  console.log(
    `[cron:policy-overdue-escalation] Processed ${overdueDistributions.length} distributions, marked ${markedOverdue} overdue, sent ${escalationsSent} escalations, ${errors.length} errors`,
  );

  return {
    processed: overdueDistributions.length,
    markedOverdue,
    escalationsSent,
    errors,
  };
}
