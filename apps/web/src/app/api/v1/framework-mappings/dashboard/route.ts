import { db, frameworkGapAnalysis, frameworkCoverageSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const latestAnalyses = await db
    .select()
    .from(frameworkGapAnalysis)
    .where(eq(frameworkGapAnalysis.orgId, ctx.orgId))
    .orderBy(desc(frameworkGapAnalysis.analysisDate))
    .limit(20);

  // Deduplicate by framework, keeping latest
  const frameworkMap = new Map<string, (typeof latestAnalyses)[0]>();
  for (const analysis of latestAnalyses) {
    if (!frameworkMap.has(analysis.framework)) {
      frameworkMap.set(analysis.framework, analysis);
    }
  }

  const frameworkScores = Array.from(frameworkMap.entries()).map(
    ([framework, analysis]) => ({
      framework,
      coverage: Number(analysis.coveragePercentage),
      gaps: analysis.notCoveredControls,
      trend: "stable" as const,
    }),
  );

  // [ARCTOS-FULL-2026-08-31 / WP12 · S14-01] Per-category coverage matrix.
  //
  // The heatmap UI showed a category x framework grid whose cells were
  // `fw.coverage + Math.floor(Math.random() * 20 - 10)` — re-rolled on every
  // render. The only place a real matrix could come from is
  // `framework_coverage_snapshot.heatmap_data`, and the cron that writes those
  // snapshots (`apps/worker/src/crons/framework-coverage-snapshot.ts:71`) sets
  // it to `{}` unconditionally. So the data does not exist.
  //
  // The endpoint now reports that honestly: it returns whatever the latest
  // snapshot actually holds and a `categoryCoverageMeasured` flag. The UI
  // renders real cells when there are any and an explicit "not measured"
  // notice otherwise — it no longer invents numbers that end up in management
  // reviews and audit reports.
  const [latestSnapshot] = await db
    .select({
      heatmapData: frameworkCoverageSnapshot.heatmapData,
      snapshotDate: frameworkCoverageSnapshot.snapshotDate,
    })
    .from(frameworkCoverageSnapshot)
    .where(eq(frameworkCoverageSnapshot.orgId, ctx.orgId))
    .orderBy(desc(frameworkCoverageSnapshot.snapshotDate))
    .limit(1);

  const rawMatrix = (latestSnapshot?.heatmapData ?? {}) as Record<
    string,
    Record<string, number>
  >;
  const categoryCoverage: Record<string, Record<string, number>> = {};
  for (const [framework, byCategory] of Object.entries(rawMatrix)) {
    if (!byCategory || typeof byCategory !== "object") continue;
    const clean: Record<string, number> = {};
    for (const [category, value] of Object.entries(byCategory)) {
      if (typeof value === "number" && Number.isFinite(value))
        clean[category] = value;
    }
    if (Object.keys(clean).length > 0) categoryCoverage[framework] = clean;
  }
  const categoryCoverageMeasured = Object.keys(categoryCoverage).length > 0;

  const overallCoverage =
    frameworkScores.length > 0
      ? Math.round(
          frameworkScores.reduce((sum, f) => sum + f.coverage, 0) /
            frameworkScores.length,
        )
      : 0;

  const topGaps = latestAnalyses
    .flatMap((a) =>
      (
        a.gapDetails as Array<{
          controlId: string;
          controlTitle: string;
          status: string;
          recommendation?: string;
        }>
      ).map((g) => ({ ...g, framework: a.framework })),
    )
    .filter((g) => g.status === "not_covered")
    .slice(0, 10);

  return Response.json({
    data: {
      overallCoverage,
      frameworkCount: frameworkScores.length,
      frameworkScores,
      // S14-01: empty object + false flag means "no measurement exists",
      // which is a different statement from "coverage is 0".
      categoryCoverage,
      categoryCoverageMeasured,
      categoryCoverageAsOf: categoryCoverageMeasured
        ? String(latestSnapshot?.snapshotDate)
        : null,
      topGaps,
      lastAnalysisDate:
        latestAnalyses.length > 0
          ? String(latestAnalyses[0].analysisDate)
          : null,
    },
  });
}
