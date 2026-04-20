// Cron Job: ISMS CAP Overdue Monitor (DAILY)
// ISO 27001 Kap. 10: Corrective-Action-Program deadline hygiene.
// Flags open nonconformities + corrective actions whose due_date has passed.
// Fires one notification at 3d remaining, at-deadline, and every 7d while overdue.

import {
  db,
  ismsNonconformity,
  ismsCorrectiveAction,
  notification,
} from "@grc/db";
import { and, eq, not, inArray, isNotNull, sql } from "drizzle-orm";

interface IsmsCapMonitorResult {
  ncProcessed: number;
  caProcessed: number;
  notified: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function processIsmsCapOverdueMonitor(): Promise<IsmsCapMonitorResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:isms-cap-overdue] Starting at ${now.toISOString()}`);

  // ─── Nonconformities ─────────────────────────────────────
  const ncs = await db
    .select({
      id: ismsNonconformity.id,
      orgId: ismsNonconformity.orgId,
      ncCode: ismsNonconformity.ncCode,
      title: ismsNonconformity.title,
      severity: ismsNonconformity.severity,
      status: ismsNonconformity.status,
      dueDate: ismsNonconformity.dueDate,
      assignedTo: ismsNonconformity.assignedTo,
      identifiedBy: ismsNonconformity.identifiedBy,
    })
    .from(ismsNonconformity)
    .where(
      and(
        not(inArray(ismsNonconformity.status, ["closed"])),
        isNotNull(ismsNonconformity.dueDate),
      ),
    );

  for (const nc of ncs) {
    try {
      const due = new Date(nc.dueDate as unknown as string);
      const diffDays = Math.round((due.getTime() - now.getTime()) / DAY_MS);

      // Fire at 3 days before, at deadline, then once per 7-day window while overdue.
      const shouldWarn =
        diffDays === 3 ||
        diffDays === 0 ||
        (diffDays < 0 && Math.abs(diffDays) % 7 === 0);

      if (!shouldWarn) continue;

      const recipientId = nc.assignedTo ?? nc.identifiedBy;
      if (!recipientId) continue;

      const urgencyLevel =
        diffDays <= -30
          ? "CRITICAL_OVERDUE"
          : diffDays < 0
            ? "OVERDUE"
            : "WARNING";

      await db.insert(notification).values({
        userId: recipientId,
        orgId: nc.orgId,
        type: "deadline_approaching" as const,
        entityType: "isms_nonconformity",
        entityId: nc.id,
        title: `[${urgencyLevel}] ISMS NC: ${nc.ncCode ?? ""} ${nc.title}`,
        message:
          diffDays < 0
            ? `OVERDUE by ${Math.abs(diffDays)}d: ISO 27001 Kap. 10 corrective-action deadline for NC "${nc.title}" has passed.`
            : `Nonconformity "${nc.title}" has ${diffDays}d remaining until the due date.`,
        channel: "both" as const,
        templateKey: "isms_cap_overdue",
        templateData: {
          kind: "nonconformity",
          ncId: nc.id,
          ncCode: nc.ncCode,
          ncTitle: nc.title,
          severity: nc.severity,
          daysRemaining: Math.max(0, diffDays),
          daysOverdue: diffDays < 0 ? Math.abs(diffDays) : 0,
          urgencyLevel,
        },
        createdAt: now,
        updatedAt: now,
      });

      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron:isms-cap-overdue] Failed for NC ${nc.id}:`, message);
    }
  }

  // ─── Corrective Actions ──────────────────────────────────
  const cas = await db
    .select({
      id: ismsCorrectiveAction.id,
      orgId: ismsCorrectiveAction.orgId,
      title: ismsCorrectiveAction.title,
      status: ismsCorrectiveAction.status,
      dueDate: ismsCorrectiveAction.dueDate,
      assignedTo: ismsCorrectiveAction.assignedTo,
    })
    .from(ismsCorrectiveAction)
    .where(
      and(
        not(eq(ismsCorrectiveAction.status, "closed")),
        sql`${ismsCorrectiveAction.completedAt} is null`,
        isNotNull(ismsCorrectiveAction.dueDate),
      ),
    );

  for (const ca of cas) {
    try {
      const due = new Date(ca.dueDate as unknown as string);
      const diffDays = Math.round((due.getTime() - now.getTime()) / DAY_MS);

      const shouldWarn =
        diffDays === 3 ||
        diffDays === 0 ||
        (diffDays < 0 && Math.abs(diffDays) % 7 === 0);

      if (!shouldWarn) continue;

      const recipientId = ca.assignedTo;
      if (!recipientId) continue;

      const urgencyLevel =
        diffDays <= -30
          ? "CRITICAL_OVERDUE"
          : diffDays < 0
            ? "OVERDUE"
            : "WARNING";

      await db.insert(notification).values({
        userId: recipientId,
        orgId: ca.orgId,
        type: "deadline_approaching" as const,
        entityType: "isms_corrective_action",
        entityId: ca.id,
        title: `[${urgencyLevel}] ISMS CAPA: ${ca.title}`,
        message:
          diffDays < 0
            ? `OVERDUE by ${Math.abs(diffDays)}d: Corrective action "${ca.title}" has passed its due date.`
            : `Corrective action "${ca.title}" has ${diffDays}d remaining until the due date.`,
        channel: "both" as const,
        templateKey: "isms_cap_overdue",
        templateData: {
          kind: "corrective_action",
          caId: ca.id,
          caTitle: ca.title,
          daysRemaining: Math.max(0, diffDays),
          daysOverdue: diffDays < 0 ? Math.abs(diffDays) : 0,
          urgencyLevel,
        },
        createdAt: now,
        updatedAt: now,
      });

      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:isms-cap-overdue] Failed for CAPA ${ca.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:isms-cap-overdue] Processed ${ncs.length} NCs + ${cas.length} CAPAs, ${notified} notifications created`,
  );

  return { ncProcessed: ncs.length, caProcessed: cas.length, notified };
}
