// Cron Job: Dashboard Cleanup
// DAILY at 03:00 — Permanently delete soft-deleted dashboards older than 30 days

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface DashboardCleanupResult {
  processed: number;
  deleted: number;
  errors: string[];
}

export const processDashboardCleanup = withCronInstrumentation(
  "dashboard-cleanup",
  async (): Promise<DashboardCleanupResult> => {
    const errors: string[] = [];
    let deleted = 0;
    const now = new Date();

    try {
      // Find and permanently delete dashboards that were soft-deleted more
      // than 30 days ago.
      const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const result = await db.execute(
        sql`DELETE FROM custom_dashboard
            WHERE deleted_at IS NOT NULL
            AND deleted_at < ${cutoffDate.toISOString()}
            RETURNING id`,
      );

      deleted = result?.length ?? 0;
    } catch (err) {
      // Keep the in-result `errors` array for backwards compatibility
      // (some downstream callers inspect it). The wrapper also logs.
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
    }

    return { processed: deleted, deleted, errors };
  },
);
