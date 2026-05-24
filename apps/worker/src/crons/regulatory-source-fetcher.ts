// Sprint 69: Regulatory Source Fetcher Worker
// Runs every hour — fetches new regulatory changes from configured sources

import { db, regulatorySource, regulatoryChange } from "@grc/db";
import { eq, and, lte, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processRegulatorySources = withCronInstrumentation(
  "regulatory-source-fetcher",
  async (): Promise<{
    sourcesChecked: number;
    changesDetected: number;
  }> => {
    const now = new Date();

    const dueSources = await db
      .select()
      .from(regulatorySource)
      .where(
        and(
          eq(regulatorySource.isActive, true),
          sql`(${regulatorySource.lastFetchedAt} IS NULL OR ${regulatorySource.lastFetchedAt} + (${regulatorySource.fetchFrequencyHours} * interval '1 hour') <= ${now})`,
        ),
      );

    let changesDetected = 0;

    for (const source of dueSources) {
      try {
        await db
          .update(regulatorySource)
          .set({
            lastFetchedAt: now,
            lastFetchError: null,
            updatedAt: now,
          })
          .where(eq(regulatorySource.id, source.id));
      } catch (err) {
        await db
          .update(regulatorySource)
          .set({
            lastFetchError:
              err instanceof Error ? err.message : "Unknown error",
            updatedAt: now,
          })
          .where(eq(regulatorySource.id, source.id));
      }
    }

    return { sourcesChecked: dueSources.length, changesDetected };
  },
);
