// Cron Job: Whistleblowing Deadline Monitor (Daily 08:00)
// 1. Warn when 7-day acknowledge deadline is <2d away
// 2. Warn when 3-month response deadline is <14d away
// 3. Flag SLA breaches for acknowledgment
// 4. Flag SLA breaches for response

import { db, wbCase, notification, user } from "@grc/db";
import { and, sql, eq, isNull, inArray } from "drizzle-orm";

interface WbDeadlineResult {
  processed: number;
  warnings: number;
  breaches: number;
}

export async function processWbDeadlineMonitor(): Promise<WbDeadlineResult> {
  const now = new Date();
  let warnings = 0;
  let breaches = 0;

  console.log(`[cron:wb-deadline-monitor] Starting at ${now.toISOString()}`);

  // ──────────────────────────────────────────────────────────────
  // 1. 7-day acknowledge deadline warning (<2 days remaining)
  // ──────────────────────────────────────────────────────────────

  const ackWarningCases = await db.execute(
    sql`SELECT c.id, c.org_id, c.case_number, c.assigned_to, c.acknowledge_deadline
        FROM wb_case c
        WHERE c.status = 'received'
          AND c.acknowledged_at IS NULL
          AND c.acknowledge_deadline > NOW()
          AND c.acknowledge_deadline <= NOW() + INTERVAL '2 days'`,
  );

  for (const row of ackWarningCases as any[]) {
    try {
      if (row.assigned_to) {
        await db.insert(notification).values({
          userId: row.assigned_to,
          orgId: row.org_id,
          type: "deadline_approaching" as const,
          entityType: "wb_case",
          entityId: row.id,
          title: `Whistleblowing: ${row.case_number} — acknowledgment deadline approaching`,
          message: `The 7-day acknowledgment deadline for case ${row.case_number} is approaching. Deadline: ${new Date(row.acknowledge_deadline).toISOString()}.`,
          channel: "both" as const,
          templateKey: "wb_acknowledge_reminder",
          templateData: {
            caseNumber: row.case_number,
            deadline: row.acknowledge_deadline,
          },
          createdAt: now,
          updatedAt: now,
        });
        warnings++;
      }
    } catch (err) {
      console.error(`[cron:wb-deadline-monitor] Warning failed for ${row.id}:`, err);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 2. 3-month response deadline warning (<14 days remaining)
  // ──────────────────────────────────────────────────────────────

  const respWarningCases = await db.execute(
    sql`SELECT c.id, c.org_id, c.case_number, c.assigned_to, c.response_deadline
        FROM wb_case c
        WHERE c.status IN ('received', 'acknowledged', 'investigating')
          AND c.resolved_at IS NULL
          AND c.response_deadline > NOW()
          AND c.response_deadline <= NOW() + INTERVAL '14 days'`,
  );

  for (const row of respWarningCases as any[]) {
    try {
      if (row.assigned_to) {
        await db.insert(notification).values({
          userId: row.assigned_to,
          orgId: row.org_id,
          type: "deadline_approaching" as const,
          entityType: "wb_case",
          entityId: row.id,
          title: `Whistleblowing: ${row.case_number} — 3-month response deadline approaching`,
          message: `The 3-month response deadline for case ${row.case_number} is approaching. Deadline: ${new Date(row.response_deadline).toISOString()}.`,
          channel: "both" as const,
          templateKey: "wb_response_reminder",
          templateData: {
            caseNumber: row.case_number,
            deadline: row.response_deadline,
          },
          createdAt: now,
          updatedAt: now,
        });
        warnings++;
      }
    } catch (err) {
      console.error(`[cron:wb-deadline-monitor] Response warning failed for ${row.id}:`, err);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3. SLA breach: acknowledgment deadline passed without ack
  // ──────────────────────────────────────────────────────────────

  const ackBreachCases = await db.execute(
    sql`SELECT c.id, c.org_id, c.case_number, c.assigned_to
        FROM wb_case c
        WHERE c.acknowledged_at IS NULL
          AND c.acknowledge_deadline < NOW()
          AND c.status = 'received'`,
  );

  for (const row of ackBreachCases as any[]) {
    try {
      // Notify all admins in the org
      const admins = await db.execute(
        sql`SELECT u.id FROM "user" u
            JOIN user_organization_role uor ON uor.user_id = u.id
            WHERE uor.org_id = ${row.org_id} AND uor.role = 'admin'
            AND u.is_active = true`,
      );

      for (const admin of admins as any[]) {
        await db.insert(notification).values({
          userId: admin.id,
          orgId: row.org_id,
          type: "escalation" as const,
          entityType: "wb_case",
          entityId: row.id,
          title: `SLA BREACH: ${row.case_number} — 7-day acknowledgment deadline exceeded`,
          message: `Case ${row.case_number} has exceeded the 7-day acknowledgment deadline required by HinSchG. Immediate action required.`,
          channel: "both" as const,
          templateKey: "wb_sla_breach_ack",
          templateData: { caseNumber: row.case_number },
          createdAt: now,
          updatedAt: now,
        });
      }
      breaches++;
    } catch (err) {
      console.error(`[cron:wb-deadline-monitor] Ack breach failed for ${row.id}:`, err);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 4. SLA breach: response deadline passed without resolution
  // ──────────────────────────────────────────────────────────────

  const respBreachCases = await db.execute(
    sql`SELECT c.id, c.org_id, c.case_number, c.assigned_to
        FROM wb_case c
        WHERE c.resolved_at IS NULL
          AND c.response_deadline < NOW()
          AND c.status IN ('received', 'acknowledged', 'investigating')`,
  );

  for (const row of respBreachCases as any[]) {
    try {
      const admins = await db.execute(
        sql`SELECT u.id FROM "user" u
            JOIN user_organization_role uor ON uor.user_id = u.id
            WHERE uor.org_id = ${row.org_id} AND uor.role = 'admin'
            AND u.is_active = true`,
      );

      for (const admin of admins as any[]) {
        await db.insert(notification).values({
          userId: admin.id,
          orgId: row.org_id,
          type: "escalation" as const,
          entityType: "wb_case",
          entityId: row.id,
          title: `SLA BREACH: ${row.case_number} — 3-month response deadline exceeded`,
          message: `Case ${row.case_number} has exceeded the 3-month response deadline required by HinSchG. Immediate escalation required.`,
          channel: "both" as const,
          templateKey: "wb_sla_breach_response",
          templateData: { caseNumber: row.case_number },
          createdAt: now,
          updatedAt: now,
        });
      }
      breaches++;
    } catch (err) {
      console.error(`[cron:wb-deadline-monitor] Response breach failed for ${row.id}:`, err);
    }
  }

  const processed =
    (ackWarningCases as any[]).length +
    (respWarningCases as any[]).length +
    (ackBreachCases as any[]).length +
    (respBreachCases as any[]).length;

  console.log(
    `[cron:wb-deadline-monitor] Processed ${processed} checks, ${warnings} warnings, ${breaches} breaches`,
  );

  return { processed, warnings, breaches };
}
