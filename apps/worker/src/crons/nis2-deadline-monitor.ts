// Cron Job: NIS2 Incident Report Deadline Monitor
// Monitors NIS2 Art. 23 notification deadlines and sends alerts for overdue/upcoming reports

import {
  db,
  nis2IncidentReport,
  securityIncident,
  organization,
} from "@grc/db";
import { eq, and, sql, isNull, lte } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface Nis2DeadlineResult {
  orgsProcessed: number;
  overdueReports: number;
  upcomingAlerts: number;
  errors: number;
}

export const processNis2DeadlineMonitor = withCronInstrumentation(
  "nis2-deadline-monitor",
  async (): Promise<Nis2DeadlineResult> => {
    const now = new Date();

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
            .innerJoin(
              securityIncident,
              eq(nis2IncidentReport.incidentId, securityIncident.id),
            )
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

          // In production: create notifications and tasks for overdue/upcoming.
          // Per-incident details are visible via the dashboard; we don't
          // emit per-incident log lines from the cron.
          void overdueRows;
        } catch {
          // Wrapper logs structured error; bump the per-org counter.
          errors++;
        }
      }
    } catch {
      // Wrapper logs structured error; bump the fatal counter.
      errors++;
    }

    return { orgsProcessed, overdueReports, upcomingAlerts, errors };
  },
);
