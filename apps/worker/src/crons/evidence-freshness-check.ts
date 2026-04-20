// Sprint 62: Evidence Connector Framework — Freshness Check
// Checks for stale evidence and sends notifications

import { db, evidenceFreshnessConfig, connectorTestResult } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";

export const evidenceFreshnessCheckCron = "0 6 * * *"; // Daily at 6 AM

export async function evidenceFreshnessCheck(): Promise<void> {
  const configs = await db
    .select()
    .from(evidenceFreshnessConfig)
    .where(eq(evidenceFreshnessConfig.notifyOnStale, true));

  const now = new Date();

  for (const config of configs) {
    if (!config.connectorId) continue;

    // Get latest test result for this connector
    const [latestResult] = await db
      .select()
      .from(connectorTestResult)
      .where(
        and(
          eq(connectorTestResult.connectorId, config.connectorId),
          eq(connectorTestResult.orgId, config.orgId),
        ),
      )
      .orderBy(desc(connectorTestResult.executedAt))
      .limit(1);

    if (!latestResult) continue;

    const daysSinceLastRun = Math.floor(
      (now.getTime() - new Date(latestResult.executedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (daysSinceLastRun >= config.maxAgeDays) {
      // Evidence is stale — would trigger notification in real implementation
      console.log(
        `[evidence-freshness] Stale evidence for org=${config.orgId}, connector=${config.connectorId}, days=${daysSinceLastRun}`,
      );
    } else if (daysSinceLastRun >= config.maxAgeDays - config.warningDays) {
      // Warning threshold — would trigger warning notification
      console.log(
        `[evidence-freshness] Warning: evidence aging for org=${config.orgId}, connector=${config.connectorId}, days=${daysSinceLastRun}`,
      );
    }
  }
}
