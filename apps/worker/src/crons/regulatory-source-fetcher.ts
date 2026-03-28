// Sprint 69: Regulatory Source Fetcher Worker
// Runs every hour — fetches new regulatory changes from configured sources

import { db, regulatorySource, regulatoryChange } from "@grc/db";
import { eq, and, lte, sql } from "drizzle-orm";

export async function processRegulatorySources(): Promise<{
  sourcesChecked: number;
  changesDetected: number;
}> {
  console.log("[regulatory-source-fetcher] Checking for sources due for fetch");

  const now = new Date();

  // Find active sources due for fetching
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
      console.log(`[regulatory-source-fetcher] Fetching source: ${source.name}`);

      // In production: fetch from source.url, parse content, classify via NLP
      // Placeholder: update last fetch time
      await db
        .update(regulatorySource)
        .set({
          lastFetchedAt: now,
          lastFetchError: null,
          updatedAt: now,
        })
        .where(eq(regulatorySource.id, source.id));

    } catch (err) {
      console.error(`[regulatory-source-fetcher] Source ${source.name} failed:`, err);
      await db
        .update(regulatorySource)
        .set({
          lastFetchError: err instanceof Error ? err.message : "Unknown error",
          updatedAt: now,
        })
        .where(eq(regulatorySource.id, source.id));
    }
  }

  console.log(`[regulatory-source-fetcher] Checked ${dueSources.length} sources, detected ${changesDetected} changes`);
  return { sourcesChecked: dueSources.length, changesDetected };
}
