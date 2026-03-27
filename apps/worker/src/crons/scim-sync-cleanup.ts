// Cron Job: SCIM Sync Log Cleanup
// DAILY — Removes SCIM sync log entries older than 90 days
// to prevent unbounded growth of the scim_sync_log table

import { db } from "@grc/db";
import { sql } from "drizzle-orm";

interface ScimCleanupResult {
  deletedEntries: number;
  error: string | null;
}

export async function processScimSyncCleanup(): Promise<ScimCleanupResult> {
  const now = new Date();
  console.log(`[cron:scim-sync-cleanup] Starting at ${now.toISOString()}`);

  try {
    const result = await db.execute(sql`
      DELETE FROM scim_sync_log
      WHERE created_at < now() - interval '90 days'
    `);

    const deletedEntries = (result as any).rowCount ?? 0;
    console.log(`[cron:scim-sync-cleanup] Deleted ${deletedEntries} old sync log entries`);

    return { deletedEntries, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[cron:scim-sync-cleanup] Error: ${message}`);
    return { deletedEntries: 0, error: message };
  }
}
