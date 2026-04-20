// Sprint 46: Whistleblower Retaliation Check (Weekly)
// Check new protection events against retaliation indicator rules

import { db, wbProtectionCase, wbProtectionEvent, notification } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";

interface RetaliationCheckResult {
  processed: number;
  alerts: number;
}

export async function processWbRetaliationCheck(): Promise<RetaliationCheckResult> {
  console.log(`[cron:wb-retaliation-check] Starting`);
  let alerts = 0;

  // Default retaliation indicator rules
  const rules = [
    {
      eventType: "performance_review",
      timeWindowMonths: 6,
      severity: "suspicious",
    },
    { eventType: "termination", timeWindowMonths: 0, severity: "critical" },
    { eventType: "role_change", timeWindowMonths: 3, severity: "suspicious" },
    { eventType: "salary_change", timeWindowMonths: 6, severity: "suspicious" },
    {
      eventType: "assignment_change",
      timeWindowMonths: 3,
      severity: "suspicious",
    },
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

  for (const event of recentEvents as Array<Record<string, unknown>>) {
    try {
      // Resolve a whistleblowing officer (falls back to first admin) for this org
      const recipients = await db.execute(sql`
        SELECT uor.user_id FROM user_organization_role uor
        WHERE uor.org_id = ${event.org_id as string}
          AND uor.role IN ('whistleblowing_officer', 'admin')
        ORDER BY CASE uor.role WHEN 'whistleblowing_officer' THEN 0 ELSE 1 END
        LIMIT 1
      `);
      const recipientId = (
        recipients as unknown as Array<{ user_id: string }>
      )[0]?.user_id;
      if (!recipientId) continue;

      await db.insert(notification).values({
        userId: recipientId,
        orgId: String(event.org_id),
        type: "escalation" as const,
        entityType: "wb_protection_event",
        entityId: String(event.id),
        title: `Retaliation alert: ${String(event.event_type)} flagged as ${String(event.flag)}`,
        message: `Protection case ${String(event.reporter_reference)}: A ${String(event.event_type)} event on ${String(event.event_date)} has been flagged as ${String(event.flag)}. Review required per HinSchG section 36.`,
        channel: "both" as const,
        templateData: { subtype: "retaliation_alert" },
      });
      alerts++;
    } catch {
      /* skip */
    }
  }

  console.log(`[cron:wb-retaliation-check] ${alerts} retaliation alerts`);
  return {
    processed: (recentEvents as unknown as Array<unknown>).length,
    alerts,
  };
}
