// Sprint 47: KPI Threshold Alert (on measurement INSERT / daily check)
// Alert process owners when KPIs cross thresholds

import {
  db,
  processKpiDefinition,
  processKpiMeasurement,
  notification,
} from "@grc/db";
import { eq, sql, desc } from "drizzle-orm";

interface KpiAlertResult {
  processed: number;
  alerts: number;
}

export async function processKpiThresholdAlert(): Promise<KpiAlertResult> {
  console.log(`[cron:kpi-threshold-alert] Starting`);
  let alerts = 0;

  // Find recent measurements (last 24h) that are yellow or red
  const recentMeasurements = await db.execute(
    sql`SELECT m.id, m.kpi_definition_id, m.status, m.actual_value, m.target_value, m.org_id,
               k.name as kpi_name, k.owner_id, k.process_id
        FROM process_kpi_measurement m
        JOIN process_kpi_definition k ON m.kpi_definition_id = k.id
        WHERE m.measured_at >= NOW() - INTERVAL '24 hours'
          AND m.status IN ('yellow', 'red')`,
  );

  for (const m of recentMeasurements as any[]) {
    if (!m.owner_id) continue;
    try {
      const urgency = m.status === "red" ? "urgent" : "warning";
      await db.insert(notification).values({
        userId: m.owner_id,
        orgId: m.org_id,
        type: "escalation" as const,
        entityType: "process_kpi_measurement",
        entityId: m.id,
        title: `KPI ${urgency}: "${m.kpi_name}" is ${m.status}`,
        message: `KPI "${m.kpi_name}" measured ${m.actual_value} against target ${m.target_value}. Status: ${m.status.toUpperCase()}.`,
        channel: "both" as const,
        templateData: { subtype: "kpi_threshold_alert", urgency },
      });
      alerts++;
    } catch {
      /* skip */
    }
  }

  console.log(`[cron:kpi-threshold-alert] ${alerts} KPI alerts sent`);
  return { processed: (recentMeasurements as any[]).length, alerts };
}
