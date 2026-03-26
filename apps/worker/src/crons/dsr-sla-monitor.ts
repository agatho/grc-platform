// Cron Job: DSR SLA Monitor (Daily)
// Checks 30-day deadlines for open DSRs.
// Warns at 20d, 25d, and 28d remaining (i.e. 10d, 5d, 2d before deadline).

import { db, dsr, notification } from "@grc/db";
import { and, sql, isNotNull } from "drizzle-orm";

interface DsrSlaResult {
  processed: number;
  notified: number;
}

export async function processDsrSlaMonitor(): Promise<DsrSlaResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:dsr-sla-monitor] Starting at ${now.toISOString()}`);

  // Find open DSRs (not closed/rejected) where deadline is approaching
  // Warn at specific thresholds: 10 days, 5 days, 2 days before deadline
  const approachingDeadline = await db
    .select({
      id: dsr.id,
      orgId: dsr.orgId,
      requestType: dsr.requestType,
      subjectName: dsr.subjectName,
      deadline: dsr.deadline,
      handlerId: dsr.handlerId,
      createdBy: dsr.createdBy,
    })
    .from(dsr)
    .where(
      and(
        sql`${dsr.status} NOT IN ('closed', 'rejected')`,
        sql`${dsr.deadline}::date - CURRENT_DATE IN (2, 5, 10)`,
      ),
    );

  if (approachingDeadline.length === 0) {
    console.log("[cron:dsr-sla-monitor] No DSRs approaching deadline threshold");
    return { processed: 0, notified: 0 };
  }

  for (const dsrRow of approachingDeadline) {
    try {
      const deadlineDate = new Date(dsrRow.deadline);
      const daysRemaining = Math.ceil(
        (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Notify the handler, or fallback to the creator
      const recipientId = dsrRow.handlerId ?? dsrRow.createdBy;
      if (!recipientId) continue;

      await db.insert(notification).values({
        userId: recipientId,
        orgId: dsrRow.orgId,
        type: "deadline_approaching" as const,
        entityType: "dsr",
        entityId: dsrRow.id,
        title: `DSR deadline approaching: ${dsrRow.subjectName ?? dsrRow.requestType}`,
        message: `Data subject request (${dsrRow.requestType}) for "${dsrRow.subjectName}" has ${daysRemaining} day(s) remaining until the 30-day GDPR deadline.`,
        channel: "both" as const,
        templateKey: "dsr_sla_warning",
        templateData: {
          dsrId: dsrRow.id,
          requestType: dsrRow.requestType,
          subjectName: dsrRow.subjectName,
          daysRemaining,
          deadline: deadlineDate.toISOString(),
        },
        createdAt: now,
        updatedAt: now,
      });

      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:dsr-sla-monitor] Failed for DSR ${dsrRow.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:dsr-sla-monitor] Processed ${approachingDeadline.length} DSRs, ${notified} notifications created`,
  );

  return { processed: approachingDeadline.length, notified };
}
