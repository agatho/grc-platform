// Cron Job: SLA Measurement Reminder
// Per measurement frequency: remind responsible users to submit SLA measurements.

import {
  db,
  contract,
  contractSla,
  contractSlaMeasurement,
  notification,
} from "@grc/db";
import { and, sql, eq, isNull } from "drizzle-orm";

interface SlaMeasurementReminderResult {
  processed: number;
  notified: number;
}

export async function processSlaMeasurementReminder(): Promise<SlaMeasurementReminderResult> {
  const now = new Date();
  let notified = 0;

  console.log(
    `[cron:sla-measurement-reminder] Starting at ${now.toISOString()}`,
  );

  // Find active contracts with SLAs that need measurement
  const slasNeedingMeasurement = await db
    .select({
      slaId: contractSla.id,
      contractId: contractSla.contractId,
      orgId: contractSla.orgId,
      metricName: contractSla.metricName,
      measurementFrequency: contractSla.measurementFrequency,
      contractTitle: contract.title,
      contractOwnerId: contract.ownerId,
    })
    .from(contractSla)
    .innerJoin(contract, eq(contractSla.contractId, contract.id))
    .where(
      and(
        sql`${contract.status} IN ('active', 'renewal')`,
        isNull(contract.deletedAt),
      ),
    );

  for (const sla of slasNeedingMeasurement) {
    try {
      // Check if measurement is due based on frequency
      const isDue = await isMeasurementDue(sla.slaId, sla.measurementFrequency);
      if (!isDue) continue;

      const recipientId = sla.contractOwnerId;
      if (!recipientId) continue;

      await db.insert(notification).values({
        userId: recipientId,
        orgId: sla.orgId,
        type: "task_assigned" as const,
        entityType: "contract_sla",
        entityId: sla.slaId,
        title: `SLA measurement due: ${sla.metricName}`,
        message: `SLA "${sla.metricName}" for contract "${sla.contractTitle}" needs a ${sla.measurementFrequency} measurement. Please submit the current period's data.`,
        channel: "both" as const,
        templateKey: "sla_measurement_due",
        templateData: {
          slaId: sla.slaId,
          contractId: sla.contractId,
          metricName: sla.metricName,
          contractTitle: sla.contractTitle,
          frequency: sla.measurementFrequency,
        },
        createdAt: now,
        updatedAt: now,
      });

      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:sla-measurement-reminder] Failed for SLA ${sla.slaId}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:sla-measurement-reminder] Processed ${slasNeedingMeasurement.length} SLAs, ${notified} reminders sent`,
  );

  return { processed: slasNeedingMeasurement.length, notified };
}

async function isMeasurementDue(
  slaId: string,
  frequency: string,
): Promise<boolean> {
  // Find the latest measurement
  const [latest] = await db
    .select({ periodEnd: contractSlaMeasurement.periodEnd })
    .from(contractSlaMeasurement)
    .where(eq(contractSlaMeasurement.slaId, slaId))
    .orderBy(sql`${contractSlaMeasurement.periodEnd} DESC`)
    .limit(1);

  if (!latest) return true; // Never measured

  const lastEnd = new Date(latest.periodEnd);
  const now = new Date();
  const daysSinceLast = Math.floor(
    (now.getTime() - lastEnd.getTime()) / (1000 * 60 * 60 * 24),
  );

  switch (frequency) {
    case "monthly":
      // Due if last measurement was more than 25 days ago (5 day grace)
      return daysSinceLast >= 25;
    case "quarterly":
      // Due if last measurement was more than 80 days ago (10 day grace)
      return daysSinceLast >= 80;
    case "annually":
      // Due if last measurement was more than 350 days ago (15 day grace)
      return daysSinceLast >= 350;
    default:
      return daysSinceLast >= 25;
  }
}
