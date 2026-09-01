// Cron Job: Calendar Overdue Check
// DAILY at 08:00 — Find overdue events and create escalation notifications
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-14, S10-10, S10-12]
// Handed over by WP3 together with `calendar-digest.ts`.
//
// Three defects, all from the audit:
//
//   S10-14 The org context was `set_config('app.current_org_id', X, false)`
//          on the shared base pool — session-scoped, applied to whichever
//          pooled connection `db.execute` happened to take, and left behind
//          on that connection afterwards. Since a custom GUC can never be
//          reset to NULL (only to `''`, which throws as `''::uuid` inside
//          the RLS policies), the loop poisoned base-pool connections for
//          later context-less queries. It only appeared to work because the
//          worker ran as a superuser with RLS inactive.
//
//   S10-10 No dedup guard. An overdue DSR produced a NEW escalation on every
//          day it stayed overdue — an escalation repeated daily stops
//          working as an escalation.
//
//   S10-12 Errors were collected into an `errors[]` array and returned in an
//          HTTP 200 `{"success": true, …}` body that nothing reads.
//
// The rewrite runs one transaction per org with a transaction-local context,
// deduplicates each escalation per entity, recipient and day, and reports a
// partial failure as such.

import { sql } from "drizzle-orm";
import { db } from "@grc/db";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { withOrgContext } from "../lib/org-context";
import { createRunReport } from "../lib/job-runtime";
import { insertNotification } from "../lib/notify";

interface OverdueRow {
  id: string;
  assignee: string | null;
  title: string;
}

interface CalendarOverdueResult {
  processed: number;
  overdueFound: number;
  escalationsSent: number;
  ok: boolean;
  failed: number;
  errors: string[];
}

export const processCalendarOverdueCheck = withCronInstrumentation(
  "calendar-overdue-check",
  async (): Promise<CalendarOverdueResult> => {
    const report = createRunReport("calendar-overdue-check");
    let overdueFound = 0;
    let escalationsSent = 0;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const nowIso = now.toISOString();

    const orgs = (await db.execute(
      sql`SELECT id FROM organization WHERE deleted_at IS NULL`,
    )) as unknown as Array<{ id: string }>;

    if (orgs.length === 0) {
      return report.toResult({
        processed: 0,
        overdueFound: 0,
        escalationsSent: 0,
      });
    }

    for (const org of orgs) {
      const orgId = String(org.id);
      try {
        await withOrgContext(orgId, async (tx) => {
          const overdueDsrs = (await tx.execute(sql`
            SELECT d.id, d.handler_id AS assignee, 'DSR: ' || d.request_type AS title
              FROM dsr d
             WHERE d.org_id = ${orgId}::uuid
               AND d.deadline < ${nowIso}::timestamptz
               AND d.status IN ('received', 'verified', 'processing')`)) as unknown as OverdueRow[];

          const overdueBreaches = (await tx.execute(sql`
            SELECT b.id, b.assignee_id AS assignee, 'Breach 72h: ' || b.title AS title
              FROM data_breach b
             WHERE b.org_id = ${orgId}::uuid
               AND (b.detected_at + interval '72 hours') < ${nowIso}::timestamptz
               AND b.status IN ('detected', 'investigating')
               AND b.dpa_notified_at IS NULL
               AND b.deleted_at IS NULL`)) as unknown as OverdueRow[];

          const overdueFindings = (await tx.execute(sql`
            SELECT f.id, f.assignee_id AS assignee, 'Finding: ' || f.title AS title
              FROM finding f
             WHERE f.org_id = ${orgId}::uuid
               AND f.remediation_due_date IS NOT NULL
               AND f.remediation_due_date::timestamptz < ${nowIso}::timestamptz
               AND f.status IN ('open', 'in_progress')
               AND f.deleted_at IS NULL`)) as unknown as OverdueRow[];

          const groups = [
            {
              entityType: "dsr",
              rows: overdueDsrs,
              titlePrefix: "Overdue",
              message:
                "This DSR has passed its deadline and is still open. Immediate action is required.",
            },
            {
              entityType: "data_breach",
              rows: overdueBreaches,
              titlePrefix: "URGENT Overdue",
              message:
                "The 72-hour breach notification deadline has passed without DPA notification. This requires immediate escalation.",
            },
            {
              entityType: "finding",
              rows: overdueFindings,
              titlePrefix: "Overdue",
              message:
                "This finding has passed its remediation due date and is still open.",
            },
          ];

          for (const group of groups) {
            for (const row of group.rows) {
              overdueFound++;
              if (!row.assignee) continue;
              const title = `${group.titlePrefix}: ${String(row.title)}`;
              const written = await insertNotification(
                {
                  orgId,
                  userId: String(row.assignee),
                  type: "escalation",
                  entityType: group.entityType,
                  entityId: String(row.id),
                  title,
                  message: group.message,
                  channel: "both",
                  templateKey: "calendar_overdue_escalation",
                  templateData: {
                    title,
                    message: group.message,
                    entityType: group.entityType,
                    entityId: String(row.id),
                  },
                  scheduledFor: now,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  job: "calendar-overdue-check",
                  tx,
                  // One escalation per entity, recipient and day.
                  dedupeKey: `calendar-overdue|${group.entityType}|${row.id}|${row.assignee}|${today}`,
                },
              );
              if (written) escalationsSent++;
            }
          }
        });
      } catch (err) {
        report.fail(`org ${orgId}`, err);
      }
    }

    return report.toResult({
      processed: orgs.length,
      overdueFound,
      escalationsSent,
    });
  },
);
