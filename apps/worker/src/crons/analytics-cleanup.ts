// Sprint 33: Analytics Data Cleanup Worker
// Runs daily — deletes expired audit_analytics_import records (>90 days)

import { db, auditAnalyticsImport } from "@grc/db";
import { lte } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processAnalyticsCleanup = withCronInstrumentation(
  "analytics-cleanup",
  async (): Promise<{ deleted: number }> => {
    const now = new Date();

    const expired = await db
      .delete(auditAnalyticsImport)
      .where(lte(auditAnalyticsImport.expiresAt, now))
      .returning({ id: auditAnalyticsImport.id });

    return { deleted: expired.length };
  },
);
