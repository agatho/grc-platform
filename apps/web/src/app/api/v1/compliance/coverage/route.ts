// GET /api/v1/compliance/coverage — Cross-framework coverage rollup.
//
// #WAVE14-CROSS-05: Compliance dashboards live on a small set of
// aggregation endpoints. /controls/effectiveness already covers the
// "controls are tested and pass" angle; this one covers the upstream
// "controls exist for every framework requirement" angle.
//
// The data already lives in framework_gap_analysis (one row per
// org+framework+analysis_date). The /framework-mappings/dashboard
// endpoint exposes the same data shaped for the framework-mappings UI;
// this endpoint exposes it shaped for the compliance-overview page —
// short field names, no gap-detail flattening, ready to drop into a
// donut chart or a row of metric cards.

import { db, frameworkGapAnalysis } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // ICS owns the framework-mapping table; compliance is a read-only
  // consumer. requireModule("ics") matches /controls/effectiveness.
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Latest analysis per framework. We pull a wider window (50) than the
  // expected framework count (~46) so dedupe-by-framework keeps the
  // freshest row even if multiple analyses landed the same day.
  const recent = await db
    .select()
    .from(frameworkGapAnalysis)
    .where(eq(frameworkGapAnalysis.orgId, ctx.orgId))
    .orderBy(desc(frameworkGapAnalysis.analysisDate))
    .limit(50);

  const latestByFramework = new Map<string, (typeof recent)[number]>();
  for (const row of recent) {
    if (!latestByFramework.has(row.framework)) {
      latestByFramework.set(row.framework, row);
    }
  }

  const frameworks = Array.from(latestByFramework.values()).map((a) => ({
    framework: a.framework,
    coveragePct: Number(a.coveragePercentage),
    coveredControls: a.coveredControls ?? 0,
    notCoveredControls: a.notCoveredControls ?? 0,
    totalControls: (a.coveredControls ?? 0) + (a.notCoveredControls ?? 0),
    analysisDate: String(a.analysisDate),
  }));

  const overallCoveragePct =
    frameworks.length > 0
      ? Math.round(
          frameworks.reduce((sum, f) => sum + f.coveragePct, 0) /
            frameworks.length,
        )
      : 0;

  const fullyCovered = frameworks.filter((f) => f.coveragePct === 100).length;
  const atRisk = frameworks.filter(
    (f) => f.coveragePct < 80 && f.coveragePct >= 50,
  ).length;
  const critical = frameworks.filter((f) => f.coveragePct < 50).length;

  return Response.json({
    data: {
      overallCoveragePct,
      frameworkCount: frameworks.length,
      fullyCovered,
      atRisk,
      critical,
      frameworks,
      asOf: new Date().toISOString(),
    },
  });
});
