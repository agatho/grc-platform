// Sprint 33: Analytics Data Cleanup Worker
// Runs daily — deletes expired audit_analytics_import records (>90 days)

import { db, auditAnalyticsImport } from "@grc/db";
import { lte } from "drizzle-orm";

export async function processAnalyticsCleanup(): Promise<{
  deleted: number;
}> {
  console.log(
    "[analytics-cleanup] Starting daily cleanup of expired analytics imports",
  );

  const now = new Date();

  const expired = await db
    .delete(auditAnalyticsImport)
    .where(lte(auditAnalyticsImport.expiresAt, now))
    .returning({ id: auditAnalyticsImport.id });

  const deleted = expired.length;

  console.log(`[analytics-cleanup] Deleted ${deleted} expired import(s)`);

  return { deleted };
}
