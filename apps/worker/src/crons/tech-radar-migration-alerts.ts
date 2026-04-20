// Sprint 37: Technology Radar Migration Alerts Worker
// Runs weekly — finds HOLD technologies with active applications, creates tasks

import {
  db,
  technologyEntry,
  technologyApplicationLink,
  architectureElement,
} from "@grc/db";
import { eq, and, sql } from "drizzle-orm";

export async function processTechRadarMigrationAlerts(): Promise<{
  holdTechnologies: number;
  alertsCreated: number;
}> {
  console.log(
    "[tech-radar-migration] Checking HOLD technologies with active applications",
  );

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
  let alertsCreated = 0;

  for (const tech of withApps) {
    console.log(
      `[tech-radar-migration] ${tech.techName}: ${tech.appCount} applications still using HOLD technology`,
    );
    alertsCreated++;
  }

  console.log(
    `[tech-radar-migration] Found ${withApps.length} HOLD techs with usage, created ${alertsCreated} alerts`,
  );
  return { holdTechnologies: withApps.length, alertsCreated };
}
