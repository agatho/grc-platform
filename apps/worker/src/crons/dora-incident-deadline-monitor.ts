// Cron Job: DORA ICT Incident Reporting Deadline Monitor
// Checks for incidents where reporting deadlines (4h/72h/1M) are approaching or overdue.

import { db, doraIctIncident, notification } from "@grc/db";
import { and, sql, isNull, isNotNull, ne } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface DoraDeadlineResult {
  processed: number;
  notified: number;
}

export const processDoraIncidentDeadlineMonitor = withCronInstrumentation(
  "dora-incident-deadline-monitor",
  async (): Promise<DoraDeadlineResult> => {
    const now = new Date();
    let notified = 0;

    // Find incidents with overdue initial reports (4h deadline)
    const overdueInitial = await db
      .select({
        id: doraIctIncident.id,
        orgId: doraIctIncident.orgId,
        title: doraIctIncident.title,
        incidentCode: doraIctIncident.incidentCode,
        handlerId: doraIctIncident.handlerId,
        initialReportDue: doraIctIncident.initialReportDue,
      })
      .from(doraIctIncident)
      .where(
        and(
          isNull(doraIctIncident.initialReportSent),
          isNotNull(doraIctIncident.initialReportDue),
          sql`${doraIctIncident.initialReportDue} < now()`,
          ne(doraIctIncident.status, "closed"),
        ),
      );

    for (const incident of overdueInitial) {
      if (!incident.handlerId) continue;
      try {
        await db.insert(notification).values({
          userId: incident.handlerId,
          orgId: incident.orgId,
          type: "deadline_approaching" as const,
          entityType: "dora_ict_incident",
          entityId: incident.id,
          title: `DORA: Initial report overdue for ${incident.incidentCode}`,
          message: `ICT incident "${incident.title}" has an overdue initial report (4h deadline). Due: ${incident.initialReportDue?.toISOString()}`,
          channel: "both" as const,
          templateKey: "dora_report_overdue",
          templateData: {
            incidentCode: incident.incidentCode,
            title: incident.title,
            deadline: "4h",
          },
          createdAt: now,
          updatedAt: now,
        });
        notified++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[cron:dora-incident-deadlines] Failed for ${incident.id}:`,
          message,
        );
      }
    }

    return { processed: overdueInitial.length, notified };
  },
);
