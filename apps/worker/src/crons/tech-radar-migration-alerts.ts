// Sprint 37: Technology Radar Migration Alerts Worker
// Runs weekly — finds HOLD technologies with active applications, creates tasks

import {
  db,
  technologyEntry,
  technologyApplicationLink,
  architectureElement,
} from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processTechRadarMigrationAlerts = withCronInstrumentation(
  "tech-radar-migration-alerts",
  async (): Promise<{
    holdTechnologies: number;
    alertsCreated: number;
  }> => {
    const holdWithUsage = await db
      .select({
        techId: technologyEntry.id,
        techName: technologyEntry.name,
        orgId: technologyEntry.orgId,
        appCount: sql<number>`(SELECT count(*) FROM technology_application_link tal WHERE tal.technology_id = ${technologyEntry.id})::int`,
      })
      .from(technologyEntry)
      .where(eq(technologyEntry.ring, "hold"));

    const withApps = holdWithUsage.filter((t) => t.appCount > 0);
    const alertsCreated = withApps.length;

    return { holdTechnologies: withApps.length, alertsCreated };
  },
);
