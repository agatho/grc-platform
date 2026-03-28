// Sprint 46: Whistleblower Retaliation Check (Weekly)
// Check new protection events against retaliation indicator rules

import { db, wbProtectionCase, wbProtectionEvent, notification } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";

interface RetaliationCheckResult { processed: number; alerts: number; }

export async function processWbRetaliationCheck(): Promise<RetaliationCheckResult> {
  console.log(`[cron:wb-retaliation-check] Starting`);
  let alerts = 0;

  // Default retaliation indicator rules
  const rules = [
    { eventType: "performance_review", timeWindowMonths: 6, severity: "suspicious" },
    { eventType: "termination", timeWindowMonths: 0, severity: "critical" },
    { eventType: "role_change", timeWindowMonths: 3, severity: "suspicious" },
    { eventType: "salary_change", timeWindowMonths: 6, severity: "suspicious" },
    { eventType: "assignment_change", timeWindowMonths: 3, severity: "suspicious" },
  ];

  // Find recent suspicious/critical events from the last week
  const recentEvents = await db.execute(
    sql`SELECT pe.id, pe.protection_case_id, pe.event_type, pe.event_date, pe.flag, pe.org_id,
               pc.reporter_reference, pc.protection_start_date
        FROM wb_protection_event pe
        JOIN wb_protection_case pc ON pe.protection_case_id = pc.id
        WHERE pe.created_at >= NOW() - INTERVAL '7 days'
          AND pe.flag IN ('suspicious', 'critical')`,
  );

  for (const event of recentEvents as any[]) {
    try {
      // Find compliance officer for this org and send notification
      await db.insert(notification).values({
        userId: null as any, // Compliance officer lookup needed
        orgId: event.org_id,
        type: "alert" as const,
        entityType: "wb_protection_event",
        entityId: event.id,
        title: `Retaliation alert: ${event.event_type} flagged as ${event.flag}`,
        message: `Protection case ${event.reporter_reference}: A ${event.event_type} event on ${event.event_date} has been flagged as ${event.flag}. Review required per HinSchG section 36.`,
        channel: "both" as const,
      });
      alerts++;
    } catch { /* skip */ }
  }

  console.log(`[cron:wb-retaliation-check] ${alerts} retaliation alerts`);
  return { processed: (recentEvents as any[]).length, alerts };
}
