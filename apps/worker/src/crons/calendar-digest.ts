// Cron Job: Calendar Weekly Digest
// WEEKLY Monday 07:00 — Send email digest per user with this week's GRC deadlines

import { db, notification } from "@grc/db";
import { sql } from "drizzle-orm";

interface CalendarDigestResult {
  processed: number;
  emailsSent: number;
  errors: string[];
}

export async function processCalendarDigest(): Promise<CalendarDigestResult> {
  const errors: string[] = [];
  let emailsSent = 0;
  const now = new Date();

  console.log(`[cron:calendar-digest] Starting weekly digest at ${now.toISOString()}`);

  // Calculate this week's date range (Monday to Sunday)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  weekEnd.setHours(23, 59, 59, 999);

  const weekStartStr = weekStart.toISOString();
  const weekEndStr = weekEnd.toISOString();

  // Get all orgs with active users
  const orgs = await db.execute(
    sql`SELECT DISTINCT uor.org_id, uor.user_id, u.name as user_name, u.email
        FROM user_organization_role uor
        JOIN "user" u ON u.id = uor.user_id
        WHERE u.is_active = true AND u.deleted_at IS NULL`,
  );

  if (!orgs.rows || orgs.rows.length === 0) {
    console.log("[cron:calendar-digest] No active users found");
    return { processed: 0, emailsSent: 0, errors: [] };
  }

  // Group by user (a user may have multiple orgs)
  const userOrgMap = new Map<string, { email: string; name: string; orgIds: string[] }>();
  for (const row of orgs.rows as Array<Record<string, unknown>>) {
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
    try {
      for (const orgId of userData.orgIds) {
        // Set RLS context
        await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, false)`);

        // Query calendar events for this week across all sources
        // Simplified: check manual events + audit + control tests
        const weekEvents = await db.execute(sql`
          SELECT title, start_at, 'manual' as module FROM compliance_calendar_event
          WHERE org_id = ${orgId} AND start_at >= ${weekStartStr}::timestamptz AND start_at <= ${weekEndStr}::timestamptz AND deleted_at IS NULL
          UNION ALL
          SELECT 'Audit: ' || title as title, planned_start::timestamptz as start_at, 'audit' as module FROM audit
          WHERE org_id = ${orgId} AND planned_start IS NOT NULL AND planned_start::timestamptz >= ${weekStartStr}::timestamptz AND planned_start::timestamptz <= ${weekEndStr}::timestamptz AND deleted_at IS NULL
          ORDER BY start_at ASC
          LIMIT 20
        `);

        if (weekEvents.rows && weekEvents.rows.length > 0) {
          // Create in-app notification as digest
          await db.insert(notification).values({
            orgId,
            userId,
            type: "deadline_approaching",
            entityType: "calendar_digest",
            title: `Weekly Calendar Digest: ${weekEvents.rows.length} event(s) this week`,
            message: `You have ${weekEvents.rows.length} compliance calendar event(s) scheduled this week.`,
            channel: "both",
            templateKey: "calendar_weekly_digest",
            templateData: {
              userName: userData.name,
              eventCount: weekEvents.rows.length,
              weekStart: weekStartStr,
              weekEnd: weekEndStr,
              events: (weekEvents.rows as Array<Record<string, unknown>>).slice(0, 10).map((e) => ({
                title: String(e.title),
                startAt: String(e.start_at),
                module: String(e.module),
              })),
            },
            createdAt: now,
            updatedAt: now,
          });

          emailsSent++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`User ${userId}: ${message}`);
    }
  }

  console.log(
    `[cron:calendar-digest] Processed ${userOrgMap.size} users, sent ${emailsSent} digests, ${errors.length} errors`,
  );

  return { processed: userOrgMap.size, emailsSent, errors };
}
