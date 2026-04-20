import {
  db,
  assuranceScoreSnapshot,
  control,
  controlTest,
  evidence,
  finding,
  moduleConfig,
} from "@grc/db";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { computeAssuranceScore, computeScoreTrend } from "@grc/shared";
import type { ModuleAssuranceData } from "@grc/shared";

const VALID_MODULES = new Set([
  "erm",
  "isms",
  "ics",
  "dpms",
  "audit",
  "tprm",
  "bcms",
  "esg",
]);

// GET /api/v1/assurance/scores/:module — Detail + factors + recommendations
export async function GET(
  req: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { module: mod } = await params;

  if (!VALID_MODULES.has(mod)) {
    return Response.json({ error: "Invalid module" }, { status: 400 });
  }

  // Check module is enabled
  const [moduleEnabled] = await db
    .select({ moduleKey: moduleConfig.moduleKey })
    .from(moduleConfig)
    .where(
      and(
        eq(moduleConfig.orgId, ctx.orgId),
        eq(moduleConfig.moduleKey, mod),
        eq(moduleConfig.uiStatus, "enabled"),
      ),
    )
    .limit(1);

  if (!moduleEnabled) {
    return Response.json({ error: "Module not enabled" }, { status: 404 });
  }

  const data = await collectModuleData(ctx.orgId);
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

  return Response.json({
    module: mod,
    score: result.score,
    factors: result.factors,
    recommendations: result.recommendations,
    trend: computeScoreTrend(result.score, prevSnapshot?.score ?? null),
  });
}

async function collectModuleData(orgId: string): Promise<ModuleAssuranceData> {
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

  const [evidenceStats] = await db
    .select({
      totalEvidence: sql<number>`COUNT(*)::integer`,
      avgAgeDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - ${evidence.createdAt})) / 86400), 0)::integer`,
    })
    .from(evidence)
    .where(and(eq(evidence.orgId, orgId), isNull(evidence.deletedAt)));

  const totalControls = controlStats?.totalControls ?? 0;
  const testedControls = testedStats?.testedControls ?? 0;
  const totalEvidence = evidenceStats?.totalEvidence ?? 1;
  const avgAgeDays = evidenceStats?.avgAgeDays ?? 180;
  const measuredCount = Math.max(1, testedControls);
  const estimatedCount = Math.max(0, totalControls - testedControls);

  return {
    avgEvidenceAgeDays: avgAgeDays,
    testedControls,
    totalControls: Math.max(1, totalControls),
    measuredCount,
    estimatedCount,
    thirdLinePercent: 15,
    secondLinePercent: 45,
    firstLinePercent: 40,
    autoCollectedEvidence: Math.round(totalEvidence * 0.3),
    totalEvidence: Math.max(1, totalEvidence),
  };
}
