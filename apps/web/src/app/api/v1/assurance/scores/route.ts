import {
  db,
  assuranceScoreSnapshot,
  control,
  controlTest,
  evidence,
  finding,
  moduleConfig,
} from "@grc/db";
import { eq, and, isNull, desc, sql, isNotNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { computeAssuranceScore, computeScoreTrend } from "@grc/shared";
import type { AssuranceModuleScore, ModuleAssuranceData } from "@grc/shared";

const ASSURANCE_MODULES = [
  "erm",
  "isms",
  "ics",
  "dpms",
  "audit",
  "tprm",
  "bcms",
  "esg",
] as const;

// GET /api/v1/assurance/scores — Current scores per module
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  // Check which modules are enabled
  const enabledModules = await db
    .select({ moduleKey: moduleConfig.moduleKey })
    .from(moduleConfig)
    .where(
      and(
        eq(moduleConfig.orgId, ctx.orgId),
        eq(moduleConfig.uiStatus, "enabled"),
      ),
    );

  const enabledSet = new Set(enabledModules.map((m) => m.moduleKey));

  const modules: AssuranceModuleScore[] = [];

  for (const mod of ASSURANCE_MODULES) {
    if (!enabledSet.has(mod)) continue;

    const data = await collectModuleData(ctx.orgId, mod);
    const result = computeAssuranceScore(mod, data);

    // Get previous snapshot for trend
    const [prevSnapshot] = await db
      .select({ score: assuranceScoreSnapshot.score })
      .from(assuranceScoreSnapshot)
      .where(
        and(
          eq(assuranceScoreSnapshot.orgId, ctx.orgId),
          eq(assuranceScoreSnapshot.module, mod),
        ),
      )
      .orderBy(desc(assuranceScoreSnapshot.snapshotDate))
      .limit(1);

    modules.push({
      module: mod,
      score: result.score,
      factors: result.factors,
      recommendations: result.recommendations,
      trend: computeScoreTrend(result.score, prevSnapshot?.score ?? null),
    });
  }

  // Compute overall average
  const overallScore =
    modules.length > 0
      ? Math.round(
          modules.reduce((sum, m) => sum + m.score, 0) / modules.length,
        )
      : 0;

  return Response.json({
    modules,
    overallScore,
    moduleCount: modules.length,
  });
}

async function collectModuleData(
  orgId: string,
  _mod: string,
): Promise<ModuleAssuranceData> {
  // Get control and test statistics for the org
  const [controlStats] = await db
    .select({
      totalControls: sql<number>`COUNT(*)::integer`,
    })
    .from(control)
    .where(and(eq(control.orgId, orgId), isNull(control.deletedAt)));

  const [testedStats] = await db
    .select({
      testedControls: sql<number>`COUNT(DISTINCT ${controlTest.controlId})::integer`,
    })
    .from(controlTest)
    .where(eq(controlTest.orgId, orgId));

  // Evidence age statistics
  const [evidenceStats] = await db
    .select({
      totalEvidence: sql<number>`COUNT(*)::integer`,
      avgAgeDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - ${evidence.createdAt})) / 86400), 0)::integer`,
    })
    .from(evidence)
    .where(and(eq(evidence.orgId, orgId), isNull(evidence.deletedAt)));

  // Finding stats (measured vs estimated proxy)
  const [findingStats] = await db
    .select({
      totalFindings: sql<number>`COUNT(*)::integer`,
    })
    .from(finding)
    .where(and(eq(finding.orgId, orgId), isNull(finding.deletedAt)));

  const totalControls = controlStats?.totalControls ?? 0;
  const testedControls = testedStats?.testedControls ?? 0;
  const totalEvidence = evidenceStats?.totalEvidence ?? 1;
  const avgAgeDays = evidenceStats?.avgAgeDays ?? 180;

  // Approximate source distribution based on available data
  const measuredCount = Math.max(1, testedControls);
  const estimatedCount = Math.max(0, totalControls - testedControls);

  return {
    avgEvidenceAgeDays: avgAgeDays,
    testedControls,
    totalControls: Math.max(1, totalControls),
    measuredCount,
    estimatedCount,
    thirdLinePercent: 15, // Default approximation
    secondLinePercent: 45,
    firstLinePercent: 40,
    autoCollectedEvidence: Math.round(totalEvidence * 0.3),
    totalEvidence: Math.max(1, totalEvidence),
  };
}
