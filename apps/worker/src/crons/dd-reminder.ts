// Cron Job: DD Session Reminder (Daily)
// Sends reminder emails when DD session deadline is in 7d, 3d, or 1d.

import { db, ddSession, notification, vendor } from "@grc/db";
import { and, sql, eq, isNull, inArray } from "drizzle-orm";

interface DdReminderResult {
  processed: number;
  notified: number;
}

const REMINDER_DAYS = [7, 3, 1] as const;

export async function processDdReminder(): Promise<DdReminderResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:dd-reminder] Starting at ${now.toISOString()}`);

  // Find active sessions (invited or in_progress) with deadlines at reminder thresholds
  const activeSessions = await db
    .select({
      sessionId: ddSession.id,
      orgId: ddSession.orgId,
      vendorId: ddSession.vendorId,
      supplierEmail: ddSession.supplierEmail,
      supplierName: ddSession.supplierName,
      tokenExpiresAt: ddSession.tokenExpiresAt,
      status: ddSession.status,
      progressPercent: ddSession.progressPercent,
      lastReminderAt: ddSession.lastReminderAt,
      createdBy: ddSession.createdBy,
      vendorName: vendor.name,
    })
    .from(ddSession)
    .innerJoin(vendor, eq(ddSession.vendorId, vendor.id))
    .where(
      and(
        inArray(ddSession.status, ["invited", "in_progress"]),
        sql`${ddSession.tokenExpiresAt} > NOW()`,
      ),
    );

  if (activeSessions.length === 0) {
    console.log("[cron:dd-reminder] No active DD sessions found");
    return { processed: 0, notified: 0 };
  }

  for (const session of activeSessions) {
    try {
      const deadline = new Date(session.tokenExpiresAt);
      const daysUntilDeadline = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Check if we should send a reminder at this threshold
      if (!REMINDER_DAYS.includes(daysUntilDeadline as 7 | 3 | 1)) {
        continue;
      }

      // Check last reminder to avoid duplicates within 24h
      if (session.lastReminderAt) {
        const hoursSinceLastReminder =
          (now.getTime() - new Date(session.lastReminderAt).getTime()) /
          (1000 * 60 * 60);
        if (hoursSinceLastReminder < 23) {
          continue;
        }
      }

      // Create notification for the internal user who created the session
      if (session.createdBy) {
        await db.insert(notification).values({
          userId: session.createdBy,
          orgId: session.orgId,
          type: "deadline_approaching" as const,
          entityType: "dd_session",
          entityId: session.sessionId,
          title: `DD reminder: ${session.vendorName} — ${daysUntilDeadline} days remaining`,
          message: `The due diligence questionnaire for "${session.vendorName}" (${session.supplierEmail}) is due in ${daysUntilDeadline} day(s). Current progress: ${session.progressPercent}%.`,
          channel: "both" as const,
          templateKey: "dd_session_reminder",
          templateData: {
            sessionId: session.sessionId,
            vendorName: session.vendorName,
            supplierEmail: session.supplierEmail,
            daysRemaining: daysUntilDeadline,
            progressPercent: session.progressPercent,
            deadline: deadline.toISOString(),
          },
          createdAt: now,
          updatedAt: now,
        });
      }

      // Update last reminder timestamp
      await db
        .update(ddSession)
        .set({ lastReminderAt: now, updatedAt: now })
        .where(eq(ddSession.id, session.sessionId));

      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:dd-reminder] Failed for session ${session.sessionId}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:dd-reminder] Processed ${activeSessions.length} sessions, ${notified} reminders sent`,
  );

  return { processed: activeSessions.length, notified };
}
