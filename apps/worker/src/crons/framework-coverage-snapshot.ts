// Sprint 66: Cross-Framework Auto-Mapping Engine — Coverage Snapshot
// Takes weekly coverage snapshot across all frameworks

import { db, frameworkGapAnalysis, frameworkCoverageSnapshot } from "@grc/db";
import { eq, desc } from "drizzle-orm";

export const frameworkCoverageSnapshotCron = "0 3 * * 0"; // Weekly Sunday at 3 AM

export async function frameworkCoverageSnapshotJob(): Promise<void> {
  // Get unique org IDs from gap analyses
  const analyses = await db
    .select()
    .from(frameworkGapAnalysis)
    .orderBy(desc(frameworkGapAnalysis.analysisDate))
    .limit(200);

  const orgAnalyses = new Map<string, typeof analyses>();
  for (const a of analyses) {
    const existing = orgAnalyses.get(a.orgId) ?? [];
    existing.push(a);
    orgAnalyses.set(a.orgId, existing);
  }

  for (const [orgId, orgData] of orgAnalyses) {
    // Deduplicate by framework
    const frameworkMap = new Map<string, (typeof analyses)[0]>();
    for (const a of orgData) {
      if (!frameworkMap.has(a.framework)) {
        frameworkMap.set(a.framework, a);
      }
    }

    const frameworkScores: Record<string, { coverage: number; gaps: number }> =
      {};
    let totalCoverage = 0;
    let fullyCompliant = 0;
    let partiallyCompliant = 0;
    let nonCompliant = 0;

    for (const [framework, analysis] of frameworkMap) {
      const coverage = Number(analysis.coveragePercentage);
      frameworkScores[framework] = {
        coverage,
        gaps: analysis.notCoveredControls,
      };
      totalCoverage += coverage;

      if (coverage >= 90) fullyCompliant++;
      else if (coverage >= 50) partiallyCompliant++;
      else nonCompliant++;
    }

    const totalFrameworks = frameworkMap.size;
    const overallCoverage =
      totalFrameworks > 0 ? Math.round(totalCoverage / totalFrameworks) : 0;

    await db.insert(frameworkCoverageSnapshot).values({
      orgId,
      snapshotDate: new Date(),
      frameworkScores,
      overallCoverage: String(overallCoverage),
      totalFrameworks,
      fullyCompliant,
      partiallyCompliant,
      nonCompliant,
      heatmapData: {},
      trendData: {},
    });
  }
}
