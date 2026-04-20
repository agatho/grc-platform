// Cron Job: ESG Target Status Recompute (Monthly)
// Recalculates target status (on_track / at_risk / off_track / achieved)
// based on current metric measurements vs. expected trajectory.

import {
  db,
  esgTarget,
  esrsMetric,
  esgMeasurement,
  notification,
} from "@grc/db";
import { and, eq, sql, desc } from "drizzle-orm";

interface EsgTargetStatusResult {
  processed: number;
  updated: number;
  notified: number;
}

export async function processEsgTargetStatus(): Promise<EsgTargetStatusResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  let updated = 0;
  let notified = 0;

  console.log(`[cron:esg-target-status] Starting at ${now.toISOString()}`);

  // 1. Fetch all active targets
  const targets = await db
    .select({
      id: esgTarget.id,
      orgId: esgTarget.orgId,
      metricId: esgTarget.metricId,
      name: esgTarget.name,
      baselineYear: esgTarget.baselineYear,
      baselineValue: esgTarget.baselineValue,
      targetYear: esgTarget.targetYear,
      targetValue: esgTarget.targetValue,
      status: esgTarget.status,
    })
    .from(esgTarget)
    .where(sql`${esgTarget.status} != 'achieved'`);

  for (const target of targets) {
    try {
      const baseline = Number(target.baselineValue);
      const targetVal = Number(target.targetValue);

      // 2. Get latest measurement for this target's metric
      const [latestMeasurement] = await db
        .select({
          value: esgMeasurement.value,
          periodEnd: esgMeasurement.periodEnd,
        })
        .from(esgMeasurement)
        .where(eq(esgMeasurement.metricId, target.metricId))
        .orderBy(desc(esgMeasurement.periodEnd))
        .limit(1);

      if (!latestMeasurement) continue;

      const currentValue = Number(latestMeasurement.value);

      // 3. Compute expected trajectory value for current point in time
      const totalYears = target.targetYear - target.baselineYear;
      const elapsedYears = currentYear - target.baselineYear;
      if (totalYears <= 0) continue;

      const progressFraction = Math.min(1, elapsedYears / totalYears);
      const expectedValue =
        baseline + (targetVal - baseline) * progressFraction;

      // 4. Determine new status
      let newStatus: string;
      const totalRange = Math.abs(targetVal - baseline);

      if (totalRange === 0) {
        newStatus = "achieved";
      } else {
        // For reduction targets: baseline > target, lower current is better
        // For increase targets: baseline < target, higher current is better
        const isReduction = targetVal < baseline;
        const achievedRange = isReduction
          ? baseline - currentValue
          : currentValue - baseline;
        const expectedRange = isReduction
          ? baseline - expectedValue
          : expectedValue - baseline;

        if (achievedRange >= totalRange) {
          newStatus = "achieved";
        } else if (expectedRange <= 0) {
          // No progress expected yet
          newStatus = "on_track";
        } else {
          const ratio = achievedRange / expectedRange;
          if (ratio >= 0.9) {
            newStatus = "on_track";
          } else if (ratio >= 0.6) {
            newStatus = "at_risk";
          } else {
            newStatus = "off_track";
          }
        }
      }

      // 5. Update if status changed
      if (newStatus !== target.status) {
        await db
          .update(esgTarget)
          .set({
            status: newStatus as typeof target.status,
            updatedAt: now,
          })
          .where(eq(esgTarget.id, target.id));
        updated++;

        // 6. Notify metric owner if at_risk or off_track
        if (newStatus === "at_risk" || newStatus === "off_track") {
          const [metric] = await db
            .select({ responsibleUserId: esrsMetric.responsibleUserId })
            .from(esrsMetric)
            .where(eq(esrsMetric.id, target.metricId));

          if (metric?.responsibleUserId) {
            await db.insert(notification).values({
              userId: metric.responsibleUserId,
              orgId: target.orgId,
              type: "status_change" as const,
              entityType: "esg_target",
              entityId: target.id,
              title: `ESG Target "${target.name}": ${newStatus.replace("_", " ")}`,
              message: `Target "${target.name}" status changed to ${newStatus.replace("_", " ")}. Current value: ${currentValue}, expected: ${expectedValue.toFixed(2)}, target: ${targetVal}.`,
              channel: "both" as const,
              templateKey: "esg_target_status_change",
              templateData: {
                targetId: target.id,
                targetName: target.name,
                oldStatus: target.status,
                newStatus,
                currentValue,
              },
              createdAt: now,
              updatedAt: now,
            });
            notified++;
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:esg-target-status] Failed for target ${target.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:esg-target-status] Processed ${targets.length} targets, ${updated} updated, ${notified} notifications`,
  );

  return { processed: targets.length, updated, notified };
}
