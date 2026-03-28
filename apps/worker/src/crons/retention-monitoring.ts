// Sprint 42: Retention Monitoring Worker
// DAILY at 06:00 — Check retention schedules for overdue records
// Auto-create deletion requests for overdue data

import { db, retentionSchedule, deletionRequest, notification } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";

interface MonitoringResult {
  processed: number;
  requestsCreated: number;
}

export async function processRetentionMonitoring(): Promise<MonitoringResult> {
  const now = new Date();
  let requestsCreated = 0;

  console.log(`[cron:retention-monitoring] Starting at ${now.toISOString()}`);

  // Find active schedules
  const schedules = await db
    .select()
    .from(retentionSchedule)
    .where(eq(retentionSchedule.isActive, true));

  for (const schedule of schedules) {
    // Check if retention period has elapsed since schedule creation
    const monthsSinceCreation = Math.floor(
      (now.getTime() - new Date(schedule.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30),
    );

    if (monthsSinceCreation >= schedule.retentionPeriodMonths) {
      // Check if there's already an open deletion request for this schedule
      const [existing] = await db
        .select()
        .from(deletionRequest)
        .where(
          and(
            eq(deletionRequest.scheduleId, schedule.id),
            eq(deletionRequest.orgId, schedule.orgId),
            sql`${deletionRequest.status} NOT IN ('closed', 'rejected')`,
          ),
        );

      if (!existing) {
        await db.insert(deletionRequest).values({
          orgId: schedule.orgId,
          scheduleId: schedule.id,
          title: `Auto-generated: ${schedule.name} - Retention period exceeded`,
          dataCategory: schedule.dataCategory,
          status: "identified",
        });
        requestsCreated++;

        // Notify responsible person
        if (schedule.responsibleId) {
          await db.insert(notification).values({
            orgId: schedule.orgId,
            userId: schedule.responsibleId,
            type: "retention_overdue",
            title: `Retention Period Exceeded: ${schedule.name}`,
            body: `Data under "${schedule.name}" has exceeded the retention period of ${schedule.retentionPeriodMonths} months. A deletion request has been automatically created.`,
            entityType: "retention_schedule",
            entityId: schedule.id,
            module: "dpms",
            priority: "high",
            expiresAt: sql`now() + interval '90 days'`,
          });
        }
      }
    }
  }

  console.log(`[cron:retention-monitoring] Completed: ${schedules.length} schedules, ${requestsCreated} requests created`);
  return { processed: schedules.length, requestsCreated };
}
