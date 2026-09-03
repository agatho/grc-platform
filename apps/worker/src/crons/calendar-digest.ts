// Cron Job: Calendar Weekly Digest
// WEEKLY Monday 07:00 — Send email digest per user with this week's GRC deadlines
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-14, S10-10, S10-07, S10-12]
// Handed over by WP3 together with `calendar-overdue-check.ts`.
//
// The org context was set with `set_config('app.current_org_id', X, false)`
// on the SHARED base pool. Three consequences, all real:
//   * `false` = session-local, and `db.execute` takes an arbitrary pooled
//     connection — the very next query (the events SELECT) usually ran on a
//     different connection, so the context did not apply where it was meant
//     to;
//   * the GUC stayed on that connection afterwards. `request-context.ts`
//     documents that it can never be reset to NULL, only to `''`, and
//     `''::uuid` THROWS inside the RLS policies — a poisoned base-pool
//     connection breaks unrelated context-less queries later on;
//   * consequently the whole loop only "worked" because the worker ran as
//     a superuser with RLS inactive. Under `grc_worker` it would have
//     returned another org's rows or none at all.
//
// It now uses one transaction per (user, org) with a transaction-local
// context — the pattern from `risk-acceptance-expiry.ts`, extracted into
// `lib/org-context.ts`.
//
// Also fixed here: the digest had no dedup guard (S10-10, a second run in
// the same week produced a second digest), recipients were resolved without
// the `deleted_at` filter (S10-07), and errors were returned inside an
// HTTP-200 `success: true` body (S10-12).

import { db, notification } from "@grc/db";
import { sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { withOrgContext } from "../lib/org-context";
import { createRunReport } from "../lib/job-runtime";
import { insertNotification } from "../lib/notify";

import { log } from "../lib/logger";
interface CalendarDigestResult {
  processed: number;
  digestsCreated: number;
  ok: boolean;
  failed: number;
  errors: string[];
}

export const processCalendarDigest = withCronInstrumentation(
  "calendar-digest",
  async (): Promise<CalendarDigestResult> => {
    const report = createRunReport("calendar-digest");
    let digestsCreated = 0;
    const now = new Date();

    // Calculate this week's date range (Monday to Sunday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + mondayOffset,
    );
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString();
    const weekEndStr = weekEnd.toISOString();

    // Get all orgs with active users
    const orgs = await db.execute(
      sql`SELECT DISTINCT uor.org_id, uor.user_id, u.name as user_name, u.email
        FROM user_organization_role uor
        JOIN "user" u ON u.id = uor.user_id
        -- [S10-07] A revoked org role is a SOFT delete; without this filter
        -- former members kept receiving that organisation's digest.
        WHERE uor.deleted_at IS NULL
          AND u.is_active = true AND u.deleted_at IS NULL`,
    );

    if (!orgs || orgs.length === 0) {
      log.info("[cron:calendar-digest] No active users found");
      return report.toResult({ processed: 0, digestsCreated: 0 });
    }

    // Group by user (a user may have multiple orgs)
    const userOrgMap = new Map<
      string,
      { email: string; name: string; orgIds: string[] }
    >();
    for (const row of orgs as Array<Record<string, unknown>>) {
      const userId = String(row.user_id);
      const existing = userOrgMap.get(userId);
      if (existing) {
        existing.orgIds.push(String(row.org_id));
      } else {
        userOrgMap.set(userId, {
          email: String(row.email),
          name: String(row.user_name),
          orgIds: [String(row.org_id)],
        });
      }
    }

    // For each user, find events across their orgs this week
    for (const [userId, userData] of userOrgMap.entries()) {
      for (const orgId of userData.orgIds) {
        try {
          // One transaction per (user, org): the context is
          // transaction-local, applies to every statement below, and
          // reverts on commit — no session state on a pooled connection.
          await withOrgContext(orgId, async (tx) => {
            // Query calendar events for this week across all sources
            // Simplified: check manual events + audit + control tests
            const weekEvents = await tx.execute(sql`
          SELECT title, start_at, 'manual' as module FROM compliance_calendar_event
          WHERE org_id = ${orgId} AND start_at >= ${weekStartStr}::timestamptz AND start_at <= ${weekEndStr}::timestamptz AND deleted_at IS NULL
          UNION ALL
          SELECT 'Audit: ' || title as title, planned_start::timestamptz as start_at, 'audit' as module FROM audit
          WHERE org_id = ${orgId} AND planned_start IS NOT NULL AND planned_start::timestamptz >= ${weekStartStr}::timestamptz AND planned_start::timestamptz <= ${weekEndStr}::timestamptz AND deleted_at IS NULL
          ORDER BY start_at ASC
          LIMIT 20
        `);

            if (weekEvents && weekEvents.length > 0) {
              const written = await insertNotification(
                {
                  orgId,
                  userId,
                  type: "deadline_approaching",
                  entityType: "calendar_digest",
                  title: `Weekly Calendar Digest: ${weekEvents.length} event(s) this week`,
                  message: `You have ${weekEvents.length} compliance calendar event(s) scheduled this week.`,
                  channel: "both",
                  templateKey: "calendar_weekly_digest",
                  templateData: {
                    userName: userData.name,
                    eventCount: weekEvents.length,
                    weekStart: weekStartStr,
                    weekEnd: weekEndStr,
                    events: (weekEvents as Array<Record<string, unknown>>)
                      .slice(0, 10)
                      .map((e) => ({
                        title: String(e.title),
                        startAt: String(e.start_at),
                        module: String(e.module),
                      })),
                  },
                  scheduledFor: now,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  job: "calendar-digest",
                  tx,
                  // [S10-10] One digest per user, org and calendar week —
                  // a re-run, a manual trigger or a second worker instance
                  // must not produce a second digest.
                  dedupeKey: `calendar-digest|${orgId}|${userId}|${weekStartStr.slice(0, 10)}`,
                },
              );
              if (written) digestsCreated++;
            }
          });
        } catch (err) {
          report.fail(`user ${userId} / org ${orgId}`, err);
        }
      }
    }

    return report.toResult({
      processed: userOrgMap.size,
      digestsCreated,
    });
  },
);
