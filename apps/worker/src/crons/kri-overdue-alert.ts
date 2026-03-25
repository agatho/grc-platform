// Cron Job: KRI Overdue Measurement Alerts
// Finds KRIs where alert_enabled=true and measurement is overdue based on
// frequency, then creates notifications for risk_managers and admins in that org.

import { db, kri, notification, userOrganizationRole } from "@grc/db";
import { eq, and, isNull, lt, inArray, sql } from "drizzle-orm";

interface KriOverdueResult {
  processed: number;
  notified: number;
}

export async function processKriOverdueAlerts(): Promise<KriOverdueResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:kri-overdue-alerts] Starting at ${now.toISOString()}`);

  // Find KRIs where alert_enabled=true and measurement is overdue based on frequency.
  // Overdue thresholds:
  //   daily:     last_measured_at < NOW() - 1 day
  //   weekly:    last_measured_at < NOW() - 7 days
  //   monthly:   last_measured_at < NOW() - 35 days
  //   quarterly: last_measured_at < NOW() - 100 days
  const overdueKris = await db
    .select({
      id: kri.id,
      orgId: kri.orgId,
      name: kri.name,
      measurementFrequency: kri.measurementFrequency,
      lastMeasuredAt: kri.lastMeasuredAt,
    })
    .from(kri)
    .where(
      and(
        eq(kri.alertEnabled, true),
        isNull(kri.deletedAt),
        sql`(
          (${kri.measurementFrequency} = 'daily' AND (${kri.lastMeasuredAt} IS NULL OR ${kri.lastMeasuredAt} < NOW() - INTERVAL '1 day'))
          OR (${kri.measurementFrequency} = 'weekly' AND (${kri.lastMeasuredAt} IS NULL OR ${kri.lastMeasuredAt} < NOW() - INTERVAL '7 days'))
          OR (${kri.measurementFrequency} = 'monthly' AND (${kri.lastMeasuredAt} IS NULL OR ${kri.lastMeasuredAt} < NOW() - INTERVAL '35 days'))
          OR (${kri.measurementFrequency} = 'quarterly' AND (${kri.lastMeasuredAt} IS NULL OR ${kri.lastMeasuredAt} < NOW() - INTERVAL '100 days'))
        )`,
      ),
    );

  if (overdueKris.length === 0) {
    console.log("[cron:kri-overdue-alerts] No overdue KRIs found");
    return { processed: 0, notified: 0 };
  }

  for (const overdueKri of overdueKris) {
    try {
      // Find risk_managers and admins in this org
      const recipients = await db
        .select({
          userId: userOrganizationRole.userId,
        })
        .from(userOrganizationRole)
        .where(
          and(
            eq(userOrganizationRole.orgId, overdueKri.orgId),
            inArray(userOrganizationRole.role, ["risk_manager", "admin"]),
            isNull(userOrganizationRole.deletedAt),
          ),
        );

      if (recipients.length === 0) continue;

      const daysOverdue = overdueKri.lastMeasuredAt
        ? Math.floor(
            (now.getTime() - overdueKri.lastMeasuredAt.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

      const notificationBase = {
        orgId: overdueKri.orgId,
        type: "deadline_approaching" as const,
        entityType: "kri",
        entityId: overdueKri.id,
        title: `KRI measurement overdue: ${overdueKri.name}`,
        message: daysOverdue !== null
          ? `KRI "${overdueKri.name}" (${overdueKri.measurementFrequency}) has not been measured for ${daysOverdue} day(s).`
          : `KRI "${overdueKri.name}" (${overdueKri.measurementFrequency}) has never been measured.`,
        channel: "both" as const,
        templateKey: "kri_overdue_measurement",
        templateData: {
          kriName: overdueKri.name,
          frequency: overdueKri.measurementFrequency,
          lastMeasuredAt: overdueKri.lastMeasuredAt?.toISOString() ?? null,
          daysOverdue,
        },
        createdAt: now,
        updatedAt: now,
      };

      for (const recipient of recipients) {
        await db.insert(notification).values({
          ...notificationBase,
          userId: recipient.userId,
        });
        notified++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:kri-overdue-alerts] Failed for KRI ${overdueKri.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:kri-overdue-alerts] Processed ${overdueKris.length} KRIs, ${notified} notifications created`,
  );

  return { processed: overdueKris.length, notified };
}
