// Cron Job: Horizon Scanner Feed Fetcher
// Fetches regulatory items from active horizon scan sources.

import { db, horizonScanSource } from "@grc/db";
import { and, eq, sql, lte, or, isNull } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface HorizonFetchResult {
  sourcesProcessed: number;
  itemsFetched: number;
  errors: number;
}

export const processHorizonScannerFetch = withCronInstrumentation(
  "horizon-scanner-fetch",
  async (): Promise<HorizonFetchResult> => {
    const now = new Date();
    let itemsFetched = 0;
    let errors = 0;

    // Find sources due for fetching
    const dueSources = await db
      .select()
      .from(horizonScanSource)
      .where(
        and(
          eq(horizonScanSource.isActive, true),
          or(
            isNull(horizonScanSource.lastFetchedAt),
            sql`${horizonScanSource.lastFetchedAt} + (${horizonScanSource.fetchFrequencyHours} || ' hours')::interval < now()`,
          ),
        ),
      );

    for (const source of dueSources) {
      try {
        // Mark as fetched even if no new items (prevents re-processing)
        await db
          .update(horizonScanSource)
          .set({ lastFetchedAt: now, lastFetchError: null, updatedAt: now })
          .where(eq(horizonScanSource.id, source.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors++;
        await db
          .update(horizonScanSource)
          .set({ lastFetchError: message, updatedAt: now })
          .where(eq(horizonScanSource.id, source.id));
      }
    }

    return { sourcesProcessed: dueSources.length, itemsFetched, errors };
  },
);
