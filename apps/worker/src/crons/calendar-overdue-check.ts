// Cron Job: Calendar Overdue Check
// DAILY at 08:00 — Find overdue events and create escalation notifications

import { db, notification } from "@grc/db";
import { sql } from "drizzle-orm";

interface CalendarOverdueResult {
  processed: number;
  overdueFound: number;
  escalationsSent: number;
  errors: string[];
}

export async function processCalendarOverdueCheck(): Promise<CalendarOverdueResult> {
  const errors: string[] = [];
  let overdueFound = 0;
  let escalationsSent = 0;
  const now = new Date();

  console.log(`[cron:calendar-overdue-check] Starting at ${now.toISOString()}`);

  // Get all active orgs
  const orgs = await db.execute(
    sql`SELECT id FROM organization WHERE deleted_at IS NULL`,
  );

  if (!orgs || orgs.length === 0) {
    return { processed: 0, overdueFound: 0, escalationsSent: 0, errors: [] };
  }

  for (const org of orgs as Array<Record<string, unknown>>) {
    const orgId = String(org.id);

    try {
      await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, false)`);

      // Check DSR deadlines that are overdue and still open
      const overdueDsrs = await db.execute(sql`
        SELECT d.id, d.handler_id, 'DSR: ' || d.request_type as title
        FROM dsr d
        WHERE d.org_id = ${orgId}
          AND d.deadline < ${now.toISOString()}::timestamptz
          AND d.status IN ('received', 'verified', 'processing')
      `);

      for (const dsr of (overdueDsrs ?? []) as Array<Record<string, unknown>>) {
        overdueFound++;
        if (dsr.handler_id) {
          try {
            await db.insert(notification).values({
              orgId,
              userId: String(dsr.handler_id),
              type: "escalation",
              entityType: "dsr",
              entityId: String(dsr.id),
              title: `Overdue: ${String(dsr.title)}`,
              message: "This DSR has passed its deadline and is still open. Immediate action is required.",
              channel: "both",
              templateKey: "calendar_overdue_escalation",
              createdAt: now,
              updatedAt: now,
            });
            escalationsSent++;
          } catch (err) {
            errors.push(`DSR notification ${dsr.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // Check overdue data breach 72h notifications
      const overdueBreaches = await db.execute(sql`
        SELECT db.id, db.assignee_id, 'Breach 72h: ' || db.title as title
        FROM data_breach db
        WHERE db.org_id = ${orgId}
          AND (db.detected_at + interval '72 hours') < ${now.toISOString()}::timestamptz
          AND db.status IN ('detected', 'investigating')
          AND db.dpa_notified_at IS NULL
          AND db.deleted_at IS NULL
      `);

      for (const breach of (overdueBreaches ?? []) as Array<Record<string, unknown>>) {
        overdueFound++;
        if (breach.assignee_id) {
          try {
            await db.insert(notification).values({
              orgId,
              userId: String(breach.assignee_id),
              type: "escalation",
              entityType: "data_breach",
              entityId: String(breach.id),
              title: `URGENT Overdue: ${String(breach.title)}`,
              message: "The 72-hour breach notification deadline has passed without DPA notification. This requires immediate escalation.",
              channel: "both",
              templateKey: "calendar_overdue_escalation",
              createdAt: now,
              updatedAt: now,
            });
            escalationsSent++;
          } catch (err) {
            errors.push(`Breach notification ${breach.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // Check overdue finding remediations
      const overdueFindings = await db.execute(sql`
        SELECT f.id, f.assignee_id, 'Finding: ' || f.title as title
        FROM finding f
        WHERE f.org_id = ${orgId}
          AND f.remediation_due_date IS NOT NULL
          AND f.remediation_due_date::timestamptz < ${now.toISOString()}::timestamptz
          AND f.status IN ('open', 'in_progress')
          AND f.deleted_at IS NULL
      `);

      for (const finding of (overdueFindings ?? []) as Array<Record<string, unknown>>) {
        overdueFound++;
        if (finding.assignee_id) {
          try {
            await db.insert(notification).values({
              orgId,
              userId: String(finding.assignee_id),
              type: "escalation",
              entityType: "finding",
              entityId: String(finding.id),
              title: `Overdue: ${String(finding.title)}`,
              message: "This finding has passed its remediation due date and is still open.",
              channel: "both",
              templateKey: "calendar_overdue_escalation",
              createdAt: now,
              updatedAt: now,
            });
            escalationsSent++;
          } catch (err) {
            errors.push(`Finding notification ${finding.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Org ${orgId}: ${message}`);
    }
  }

  console.log(
    `[cron:calendar-overdue-check] Processed ${(orgs ?? []).length} orgs, found ${overdueFound} overdue items, sent ${escalationsSent} escalations, ${errors.length} errors`,
  );

  return {
    processed: (orgs ?? []).length,
    overdueFound,
    escalationsSent,
    errors,
  };
}
