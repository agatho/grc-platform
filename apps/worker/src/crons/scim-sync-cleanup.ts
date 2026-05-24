// Cron Job: SCIM Sync Log Cleanup
// DAILY — Removes SCIM sync log entries older than 90 days
// to prevent unbounded growth of the scim_sync_log table

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface ScimCleanupResult {
  deletedEntries: number;
  error: string | null;
}

export const processScimSyncCleanup = withCronInstrumentation(
  "scim-sync-cleanup",
  async (): Promise<ScimCleanupResult> => {
    try {
      const result = await db.execute(sql`
        DELETE FROM scim_sync_log
        WHERE created_at < now() - interval '90 days'
      `);

      const deletedEntries = (result as any).rowCount ?? 0;
      return { deletedEntries, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { deletedEntries: 0, error: message };
    }
  },
);
