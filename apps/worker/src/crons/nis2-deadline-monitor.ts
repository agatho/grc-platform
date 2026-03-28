// Cron Job: NIS2 Incident Report Deadline Monitor
// Monitors NIS2 Art. 23 notification deadlines and sends alerts for overdue/upcoming reports

import {
  db,
  nis2IncidentReport,
  securityIncident,
  organization,
} from "@grc/db";
import { eq, and, sql, isNull, lte } from "drizzle-orm";

interface Nis2DeadlineResult {
  orgsProcessed: number;
  overdueReports: number;
  upcomingAlerts: number;
  errors: number;
}

export async function processNis2DeadlineMonitor(): Promise<Nis2DeadlineResult> {
  const now = new Date();
  console.log(`[cron:nis2-deadline-monitor] Starting at ${now.toISOString()}`);

  let orgsProcessed = 0;
  let overdueReports = 0;
  let upcomingAlerts = 0;
  let errors = 0;

  try {
    const orgs = await db
      .select({ id: organization.id })
      .from(organization)
      .where(isNull(organization.deletedAt));

    for (const org of orgs) {
      try {
        orgsProcessed++;

        // Find overdue draft reports
        const overdueRows = await db
          .select({
            id: nis2IncidentReport.id,
            reportType: nis2IncidentReport.reportType,
            deadlineAt: nis2IncidentReport.deadlineAt,
            incidentTitle: securityIncident.title,
            incidentElementId: securityIncident.elementId,
          })
          .from(nis2IncidentReport)
          .innerJoin(securityIncident, eq(nis2IncidentReport.incidentId, securityIncident.id))
          .where(
            and(
              eq(nis2IncidentReport.orgId, org.id),
              eq(nis2IncidentReport.status, "draft"),
              lte(nis2IncidentReport.deadlineAt, now),
            ),
          );

        overdueReports += overdueRows.length;

        // Find reports due within 4 hours (upcoming deadline alerts)
        const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        const upcomingRows = await db
          .select({
            id: nis2IncidentReport.id,
            reportType: nis2IncidentReport.reportType,
            deadlineAt: nis2IncidentReport.deadlineAt,
          })
          .from(nis2IncidentReport)
          .where(
            and(
              eq(nis2IncidentReport.orgId, org.id),
              eq(nis2IncidentReport.status, "draft"),
              sql`${nis2IncidentReport.deadlineAt} > ${now} AND ${nis2IncidentReport.deadlineAt} <= ${fourHoursFromNow}`,
            ),
          );

        upcomingAlerts += upcomingRows.length;

        // In production: create notifications and tasks for overdue/upcoming
        for (const report of overdueRows) {
          console.log(
            `[cron:nis2-deadline-monitor] OVERDUE: ${report.incidentElementId} - ${report.reportType} - deadline: ${report.deadlineAt}`,
          );
        }
      } catch (err) {
        errors++;
        console.error(
          `[cron:nis2-deadline-monitor] Error processing org ${org.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  } catch (err) {
    errors++;
    console.error(
      "[cron:nis2-deadline-monitor] Fatal error:",
      err instanceof Error ? err.message : String(err),
    );
  }

  console.log(
    `[cron:nis2-deadline-monitor] Done: ${orgsProcessed} orgs, ${overdueReports} overdue, ${upcomingAlerts} upcoming, ${errors} errors`,
  );

  return { orgsProcessed, overdueReports, upcomingAlerts, errors };
}
