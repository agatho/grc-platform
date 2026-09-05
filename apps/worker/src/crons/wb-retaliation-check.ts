// Sprint 46: Whistleblower Retaliation Check (Weekly)
// Check new protection events against retaliation indicator rules

import { db, wbProtectionCase, wbProtectionEvent, notification } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { reportJobError } from "../lib/job-runtime";
import { insertNotification } from "../lib/notify";

interface RetaliationCheckResult {
  processed: number;
  alerts: number;
}

export const processWbRetaliationCheck = withCronInstrumentation(
  "wb-retaliation-check",
  async (): Promise<RetaliationCheckResult> => {
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
      {
        eventType: "salary_change",
        timeWindowMonths: 6,
        severity: "suspicious",
      },
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
        -- [WP9 · S10-07] Revoked org roles are soft-deleted, and the
        -- user row stays active while the person belongs to another org.
        -- Without these filters a former officer kept receiving suspected
        -- retaliation cases (HinSchG §8 confidentiality).
        SELECT uor.user_id FROM user_organization_role uor
        JOIN "user" u ON u.id = uor.user_id
        WHERE uor.org_id = ${event.org_id as string}
          AND uor.role IN ('whistleblowing_officer', 'admin')
          AND uor.deleted_at IS NULL
          AND u.is_active = true
          AND u.deleted_at IS NULL
        ORDER BY CASE uor.role WHEN 'whistleblowing_officer' THEN 0 ELSE 1 END
        LIMIT 1
      `);
        const recipientId = (
          recipients as unknown as Array<{ user_id: string }>
        )[0]?.user_id;
        if (!recipientId) continue;

        await insertNotification(
          {
            userId: recipientId,
            orgId: String(event.org_id),
            type: "escalation" as const,
            entityType: "wb_protection_event",
            entityId: String(event.id),
            title: `Retaliation alert: ${String(event.event_type)} flagged as ${String(event.flag)}`,
            message: `Protection case ${String(event.reporter_reference)}: A ${String(event.event_type)} event on ${String(event.event_date)} has been flagged as ${String(event.flag)}. Review required per HinSchG section 36.`,
            channel: "both" as const,
            templateData: { subtype: "retaliation_alert" },
          },
          { job: "wb-retaliation-check" },
        );
        alerts++;
      } catch (err) {
        // [WP9 · S10-11] was a silent catch — see lib/job-runtime.ts
        reportJobError(
          {
            job: "wb-retaliation-check",
            scope: "Resolve a whistleblowing officer falls back",
          },
          err,
        );
        /* skip */
      }
    }

    return {
      processed: (recentEvents as unknown as Array<unknown>).length,
      alerts,
    };
  },
);
