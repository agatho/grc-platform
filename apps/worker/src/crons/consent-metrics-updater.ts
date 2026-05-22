// Sprint 42: Consent Metrics Updater Worker
// DAILY at 05:00 — Recompute consent metrics for all consent types
// Alert if withdrawal rate exceeds configurable threshold (default 30%)

import { db, consentType, consentRecord, notification } from "@grc/db";
import { eq, and, isNotNull, count } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface MetricsResult {
  processed: number;
  alerts: number;
}

const DEFAULT_WITHDRAWAL_THRESHOLD = 30;

export const processConsentMetrics = withCronInstrumentation(
  "consent-metrics-updater",
  async (): Promise<MetricsResult> => {
    const now = new Date();
    let alerts = 0;

    const types = await db.select().from(consentType);

    for (const ct of types) {
      // Count total given
      const [{ value: totalGiven }] = await db
        .select({ value: count() })
        .from(consentRecord)
        .where(eq(consentRecord.consentTypeId, ct.id));

      // Count total withdrawn
      const [{ value: totalWithdrawn }] = await db
        .select({ value: count() })
        .from(consentRecord)
        .where(
          and(
            eq(consentRecord.consentTypeId, ct.id),
            isNotNull(consentRecord.withdrawnAt),
          ),
        );

      const activeConsents = Number(totalGiven) - Number(totalWithdrawn);
      const withdrawalRate =
        Number(totalGiven) > 0
          ? (Number(totalWithdrawn) / Number(totalGiven)) * 100
          : 0;

      // Update consent type metrics
      await db
        .update(consentType)
        .set({
          totalGiven: Number(totalGiven),
          totalWithdrawn: Number(totalWithdrawn),
          activeConsents,
          withdrawalRate: withdrawalRate.toFixed(2),
          metricsUpdatedAt: now,
        })
        .where(eq(consentType.id, ct.id));

      // Alert if withdrawal rate exceeds threshold
      if (withdrawalRate > DEFAULT_WITHDRAWAL_THRESHOLD && ct.createdBy) {
        await db.insert(notification).values({
          orgId: ct.orgId,
          userId: ct.createdBy,
          type: "escalation",
          title: `High Withdrawal Rate: ${ct.name}`,
          message: `Consent type "${ct.name}" has a withdrawal rate of ${withdrawalRate.toFixed(1)}%, exceeding the ${DEFAULT_WITHDRAWAL_THRESHOLD}% threshold. This may indicate dark patterns or unfair consent practices.`,
          entityType: "consent_type",
          entityId: ct.id,
          templateData: {
            module: "dpms",
            priority: "high",
            subtype: "consent_withdrawal_alert",
          },
        });
        alerts++;
      }
    }

    return { processed: types.length, alerts };
  },
);
