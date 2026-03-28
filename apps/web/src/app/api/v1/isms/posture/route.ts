import {
  db,
  securityPostureSnapshot,
  asset,
  assetClassification,
  controlMaturity,
  controlEffectivenessScore,
  vulnerability,
  securityIncident,
  soaEntry,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, isNotNull, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { computeSecurityPosture, computeScoreTrend } from "@grc/shared";
import type { PostureData } from "@grc/shared";

// GET /api/v1/isms/posture — Current overall score + factors
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const data = await collectPostureData(ctx.orgId);
  const result = computeSecurityPosture(data);

  // Get previous snapshot for trend
  const [prevSnapshot] = await db
    .select({ overallScore: securityPostureSnapshot.overallScore })
    .from(securityPostureSnapshot)
    .where(eq(securityPostureSnapshot.orgId, ctx.orgId))
    .orderBy(desc(securityPostureSnapshot.snapshotDate))
    .limit(1);

  return Response.json({
    overallScore: result.score,
    factors: result.factors,
    trend: computeScoreTrend(result.score, prevSnapshot?.overallScore ?? null),
    previousScore: prevSnapshot?.overallScore ?? null,
  });
}

async function collectPostureData(orgId: string): Promise<PostureData> {
  // Asset coverage: assets with protection requirement classification
  const [assetStats] = await db
    .select({
      totalAssets: sql<number>`COUNT(*)::integer`,
    })
    .from(asset)
    .where(and(eq(asset.orgId, orgId), isNull(asset.deletedAt)));

  const [classifiedStats] = await db
    .select({
      assetsWithPRQ: sql<number>`COUNT(*)::integer`,
    })
    .from(assetClassification)
    .where(eq(assetClassification.orgId, orgId));

  // Average control maturity (0-5 scale)
  const [maturityStats] = await db
    .select({
      avgMaturity: sql<number>`COALESCE(AVG(${controlMaturity.currentMaturity}), 0)::numeric(3,1)`,
    })
    .from(controlMaturity)
    .where(eq(controlMaturity.orgId, orgId));

  // Average CES
  const [cesStats] = await db
    .select({
      avgCES: sql<number>`COALESCE(AVG(${controlEffectivenessScore.score}), 50)::integer`,
    })
    .from(controlEffectivenessScore)
    .where(eq(controlEffectivenessScore.orgId, orgId));

  // Vulnerability exposure
  const [vulnStats] = await db
    .select({
      criticalVulns: sql<number>`COUNT(*) FILTER (WHERE ${vulnerability.severity} = 'critical')::integer`,
      highVulns: sql<number>`COUNT(*) FILTER (WHERE ${vulnerability.severity} = 'high')::integer`,
    })
    .from(vulnerability)
    .where(
      and(
        eq(vulnerability.orgId, orgId),
        isNull(vulnerability.deletedAt),
        sql`${vulnerability.status} != 'resolved'`,
      ),
    );

  // Incident TTR (avg days to close)
  const [incidentStats] = await db
    .select({
      avgTTRDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${securityIncident.closedAt} - ${securityIncident.detectedAt})) / 86400), 30)::integer`,
    })
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.orgId, orgId),
        isNotNull(securityIncident.closedAt),
      ),
    );

  // SoA completeness (entries that have been assessed / have implementation status set)
  const [soaStats] = await db
    .select({
      assessedControls: sql<number>`COUNT(*)::integer`,
    })
    .from(soaEntry)
    .where(
      and(
        eq(soaEntry.orgId, orgId),
        sql`${soaEntry.implementation} != 'not_implemented'`,
      ),
    );

  // Assessment freshness
  const avgAssessmentAgeDays = 90; // default if no assessments

  return {
    assetsWithPRQ: classifiedStats?.assetsWithPRQ ?? 0,
    totalAssets: Math.max(1, assetStats?.totalAssets ?? 1),
    avgMaturity: Number(maturityStats?.avgMaturity ?? 0),
    avgCES: cesStats?.avgCES ?? 50,
    criticalVulns: vulnStats?.criticalVulns ?? 0,
    highVulns: vulnStats?.highVulns ?? 0,
    avgTTRDays: incidentStats?.avgTTRDays ?? 30,
    avgAssessmentAgeDays,
    assessedControls: soaStats?.assessedControls ?? 0,
    totalAnnexAControls: 93, // ISO 27001:2022 Annex A has 93 controls
  };
}
