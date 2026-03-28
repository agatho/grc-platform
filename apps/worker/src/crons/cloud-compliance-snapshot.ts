// Sprint 63: Cloud Infrastructure Connectors — Compliance Snapshot
// Takes daily compliance posture snapshots per cloud provider

import { db, cloudTestSuite, cloudComplianceSnapshot, evidenceConnector } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";

export const cloudComplianceSnapshotCron = "0 1 * * *"; // Daily at 1 AM

export async function cloudComplianceSnapshotJob(): Promise<void> {
  const connectors = await db
    .select()
    .from(evidenceConnector)
    .where(
      and(
        eq(evidenceConnector.status, "active"),
        isNull(evidenceConnector.deletedAt),
      ),
    );

  const cloudConnectors = connectors.filter((c) =>
    ["aws", "azure", "gcp"].includes(c.connectorType),
  );

  for (const connector of cloudConnectors) {
    const suites = await db
      .select()
      .from(cloudTestSuite)
      .where(
        and(
          eq(cloudTestSuite.connectorId, connector.id),
          eq(cloudTestSuite.isEnabled, true),
        ),
      );

    if (suites.length === 0) continue;

    const totalChecks = suites.reduce((sum, s) => sum + s.totalTests, 0);
    const passingChecks = suites.reduce((sum, s) => sum + s.passingTests, 0);
    const failingChecks = suites.reduce((sum, s) => sum + s.failingTests, 0);
    const overallScore = totalChecks > 0 ? Math.round((passingChecks / totalChecks) * 10000) / 100 : 0;

    await db.insert(cloudComplianceSnapshot).values({
      orgId: connector.orgId,
      connectorId: connector.id,
      provider: connector.connectorType,
      snapshotDate: new Date(),
      overallScore: String(overallScore),
      categoryScores: {},
      totalChecks,
      passingChecks,
      failingChecks,
      criticalFindings: 0,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0,
      trendDirection: "stable",
      trendDelta: "0.00",
    });
  }
}
