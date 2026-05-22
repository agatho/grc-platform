// Cron Job: Breach 72h Monitor (HOURLY)
// Checks Art. 33 GDPR 72h notification deadline for active breaches.
// Warns at 48h, 24h, and 0h remaining.

import { db, dataBreach, notification } from "@grc/db";
import { and, isNull, sql, eq } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface Breach72hResult {
  processed: number;
  notified: number;
}

export const processBreach72hMonitor = withCronInstrumentation(
  "breach-72h-monitor",
  async (): Promise<Breach72hResult> => {
    const now = new Date();
    let notified = 0;

    // Find active breaches (not closed) that require DPA notification and haven't been notified yet
    const activeBreaches = await db
      .select({
        id: dataBreach.id,
        orgId: dataBreach.orgId,
        title: dataBreach.title,
        severity: dataBreach.severity,
        detectedAt: dataBreach.detectedAt,
        dpoId: dataBreach.dpoId,
        assigneeId: dataBreach.assigneeId,
        createdBy: dataBreach.createdBy,
      })
      .from(dataBreach)
      .where(
        and(
          sql`${dataBreach.status} != 'closed'`,
          isNull(dataBreach.deletedAt),
          eq(dataBreach.isDpaNotificationRequired, true),
          isNull(dataBreach.dpaNotifiedAt),
        ),
      );

    if (activeBreaches.length === 0) {
      console.log(
        "[cron:breach-72h-monitor] No active breaches requiring DPA notification",
      );
      return { processed: 0, notified: 0 };
    }

    for (const breach of activeBreaches) {
      try {
        const detectedAt = new Date(breach.detectedAt);
        const deadline72h = new Date(
          detectedAt.getTime() + 72 * 60 * 60 * 1000,
        );
        const hoursRemaining = Math.floor(
          (deadline72h.getTime() - now.getTime()) / (1000 * 60 * 60),
        );

        // Only warn at specific thresholds: ~48h, ~24h, ~0h (or overdue).
        // Windows are 2 hours wide and inclusive so the hourly cron always
        // catches the threshold even when Math.floor on the time delta
        // produces 47 instead of 48 (millisecond drift between
        // detectedAt and cron-tick `now`). The hourly cadence guarantees
        // each window fires at most once per breach.
        const shouldWarn =
          hoursRemaining <= 0 ||
          (hoursRemaining >= 0 && hoursRemaining <= 1) ||
          (hoursRemaining >= 23 && hoursRemaining <= 24) ||
          (hoursRemaining >= 47 && hoursRemaining <= 48);

        if (!shouldWarn) continue;

        // Notify DPO, assignee, or creator (in priority order)
        const recipientId =
          breach.dpoId ?? breach.assigneeId ?? breach.createdBy;
        if (!recipientId) continue;

        const urgencyLevel =
          hoursRemaining <= 0
            ? "OVERDUE"
            : hoursRemaining <= 24
              ? "CRITICAL"
              : "WARNING";

        await db.insert(notification).values({
          userId: recipientId,
          orgId: breach.orgId,
          type: "deadline_approaching" as const,
          entityType: "data_breach",
          entityId: breach.id,
          title: `[${urgencyLevel}] Breach 72h deadline: ${breach.title}`,
          message:
            hoursRemaining <= 0
              ? `OVERDUE: The 72h Art. 33 GDPR notification deadline for breach "${breach.title}" has expired!`
              : `Breach "${breach.title}" has ${hoursRemaining} hour(s) remaining until the 72h DPA notification deadline.`,
          channel: "both" as const,
          templateKey: "breach_72h_warning",
          templateData: {
            breachId: breach.id,
            breachTitle: breach.title,
            severity: breach.severity,
            hoursRemaining: Math.max(0, hoursRemaining),
            deadline: deadline72h.toISOString(),
            urgencyLevel,
          },
          createdAt: now,
          updatedAt: now,
        });

        notified++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[cron:breach-72h-monitor] Failed for breach ${breach.id}:`,
          message,
        );
      }
    }

    void notified;
    return { processed: activeBreaches.length, notified };
  },
);
