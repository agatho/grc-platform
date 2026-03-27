// Cron Job: Dashboard Cleanup
// DAILY at 03:00 — Permanently delete soft-deleted dashboards older than 30 days

import { db } from "@grc/db";
import { sql } from "drizzle-orm";

interface DashboardCleanupResult {
  processed: number;
  deleted: number;
  errors: string[];
}

export async function processDashboardCleanup(): Promise<DashboardCleanupResult> {
  const errors: string[] = [];
  let deleted = 0;
  const now = new Date();

  console.log(`[cron:dashboard-cleanup] Starting at ${now.toISOString()}`);

  try {
    // Find and permanently delete dashboards that were soft-deleted more than 30 days ago
    const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await db.execute(
      sql`DELETE FROM custom_dashboard
          WHERE deleted_at IS NOT NULL
          AND deleted_at < ${cutoffDate.toISOString()}
          RETURNING id`,
    );

    deleted = result.rows?.length ?? 0;

    console.log(
      `[cron:dashboard-cleanup] Permanently deleted ${deleted} dashboards (soft-deleted > 30 days)`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron:dashboard-cleanup] Error:", msg);
    errors.push(msg);
  }

  return { processed: deleted, deleted, errors };
}
