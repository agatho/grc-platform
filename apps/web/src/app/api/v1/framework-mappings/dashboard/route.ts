import { db, frameworkGapAnalysis, frameworkCoverageSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const latestAnalyses = await db.select().from(frameworkGapAnalysis).where(eq(frameworkGapAnalysis.orgId, ctx.orgId)).orderBy(desc(frameworkGapAnalysis.analysisDate)).limit(20);

  // Deduplicate by framework, keeping latest
  const frameworkMap = new Map<string, typeof latestAnalyses[0]>();
  for (const analysis of latestAnalyses) {
    if (!frameworkMap.has(analysis.framework)) {
      frameworkMap.set(analysis.framework, analysis);
    }
  }

  const frameworkScores = Array.from(frameworkMap.entries()).map(([framework, analysis]) => ({
    framework,
    coverage: Number(analysis.coveragePercentage),
    gaps: analysis.notCoveredControls,
    trend: "stable" as const,
  }));

  const overallCoverage = frameworkScores.length > 0
    ? Math.round(frameworkScores.reduce((sum, f) => sum + f.coverage, 0) / frameworkScores.length)
    : 0;

  const topGaps = latestAnalyses
    .flatMap((a) => (a.gapDetails as Array<{ controlId: string; controlTitle: string; status: string; recommendation?: string }>).map((g) => ({ ...g, framework: a.framework })))
    .filter((g) => g.status === "not_covered")
    .slice(0, 10);

  return Response.json({
    data: {
      overallCoverage,
      frameworkCount: frameworkScores.length,
      frameworkScores,
      topGaps,
      lastAnalysisDate: latestAnalyses.length > 0 ? String(latestAnalyses[0].analysisDate) : null,
    },
  });
}
