// Cron Job: Security Posture Snapshot (Weekly)
// Computes security posture score and stores snapshot for trend analysis

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
  catalogEntry,
  organization,
} from "@grc/db";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { computeSecurityPosture } from "@grc/shared";
import type { PostureData, PostureDomain } from "@grc/shared";

interface PostureSnapshotResult {
  orgsProcessed: number;
  snapshotsCreated: number;
  errors: number;
}

export async function processPostureSnapshot(): Promise<PostureSnapshotResult> {
  const now = new Date();
  const snapshotDate = now.toISOString().split("T")[0];
  console.log(`[cron:posture-snapshot] Starting at ${now.toISOString()}`);

  let orgsProcessed = 0;
  let snapshotsCreated = 0;
  let errors = 0;

  const orgs = await db
    .select({ id: organization.id })
    .from(organization)
    .where(isNull(organization.deletedAt));

  for (const org of orgs) {
    try {
      const data = await collectPostureData(org.id);
      const result = computeSecurityPosture(data);

      // Compute domain scores
      const domainScores = await computeDomainScores(org.id);

      await db
        .insert(securityPostureSnapshot)
        .values({
          orgId: org.id,
          overallScore: result.score,
          factors: result.factors,
          domainScores,
          snapshotDate,
        })
        .onConflictDoUpdate({
          target: [
            securityPostureSnapshot.orgId,
            securityPostureSnapshot.snapshotDate,
          ],
          set: {
            overallScore: result.score,
            factors: result.factors,
            domainScores,
            computedAt: new Date(),
          },
        });

      snapshotsCreated++;
      orgsProcessed++;
    } catch (err) {
      errors++;
      console.error(
        `[cron:posture-snapshot] Error for org ${org.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:posture-snapshot] Done. Orgs: ${orgsProcessed}, Snapshots: ${snapshotsCreated}, Errors: ${errors}`,
  );

  return { orgsProcessed, snapshotsCreated, errors };
}

async function collectPostureData(orgId: string): Promise<PostureData> {
  const [assetStats] = await db
    .select({ totalAssets: sql<number>`COUNT(*)::integer` })
    .from(asset)
    .where(and(eq(asset.orgId, orgId), isNull(asset.deletedAt)));

  const [classifiedStats] = await db
    .select({ assetsWithPRQ: sql<number>`COUNT(*)::integer` })
    .from(assetClassification)
    .where(eq(assetClassification.orgId, orgId));

  const [maturityStats] = await db
    .select({
      avgMaturity: sql<number>`COALESCE(AVG(${controlMaturity.currentMaturity}), 0)::numeric(3,1)`,
    })
    .from(controlMaturity)
    .where(eq(controlMaturity.orgId, orgId));

  const [cesStats] = await db
    .select({
      avgCES: sql<number>`COALESCE(AVG(${controlEffectivenessScore.score}), 50)::integer`,
    })
    .from(controlEffectivenessScore)
    .where(eq(controlEffectivenessScore.orgId, orgId));

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

  const [soaStats] = await db
    .select({ assessedControls: sql<number>`COUNT(*)::integer` })
    .from(soaEntry)
    .where(
      and(
        eq(soaEntry.orgId, orgId),
        sql`${soaEntry.implementation} != 'not_implemented'`,
      ),
    );

  return {
    assetsWithPRQ: classifiedStats?.assetsWithPRQ ?? 0,
    totalAssets: Math.max(1, assetStats?.totalAssets ?? 1),
    avgMaturity: Number(maturityStats?.avgMaturity ?? 0),
    avgCES: cesStats?.avgCES ?? 50,
    criticalVulns: vulnStats?.criticalVulns ?? 0,
    highVulns: vulnStats?.highVulns ?? 0,
    avgTTRDays: incidentStats?.avgTTRDays ?? 30,
    avgAssessmentAgeDays: 90,
    assessedControls: soaStats?.assessedControls ?? 0,
    totalAnnexAControls: 93,
  };
}

async function computeDomainScores(
  orgId: string,
): Promise<Record<PostureDomain, number>> {
  const ANNEX_A_DOMAINS: Record<string, PostureDomain> = {
    "5": "organizational",
    "6": "people",
    "7": "physical",
    "8": "technological",
  };

  const soaEntries = await db
    .select({
      code: catalogEntry.code,
      implementation: soaEntry.implementation,
    })
    .from(soaEntry)
    .innerJoin(catalogEntry, eq(catalogEntry.id, soaEntry.catalogEntryId))
    .where(eq(soaEntry.orgId, orgId));

  const domainStats: Record<
    PostureDomain,
    { total: number; implemented: number }
  > = {
    organizational: { total: 0, implemented: 0 },
    people: { total: 0, implemented: 0 },
    physical: { total: 0, implemented: 0 },
    technological: { total: 0, implemented: 0 },
  };

  for (const entry of soaEntries) {
    const ref = entry.code ?? "";
    const match = ref.match(/A\.(\d+)/);
    if (!match) continue;
    const domain = ANNEX_A_DOMAINS[match[1]];
    if (!domain) continue;

    domainStats[domain].total++;
    if (
      entry.implementation === "implemented" ||
      entry.implementation === "partially_implemented"
    ) {
      domainStats[domain].implemented++;
    }
  }

  const scores: Record<PostureDomain, number> = {
    organizational: 0,
    people: 0,
    physical: 0,
    technological: 0,
  };

  for (const [domain, stats] of Object.entries(domainStats) as [
    PostureDomain,
    typeof domainStats.organizational,
  ][]) {
    scores[domain] =
      stats.total > 0 ? Math.round((stats.implemented / stats.total) * 100) : 0;
  }

  return scores;
}
