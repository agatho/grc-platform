// Cron Job: Assurance Score Snapshot (Weekly)
// Computes assurance score per module and stores snapshot for trend analysis

import {
  db,
  assuranceScoreSnapshot,
  control,
  controlTest,
  evidence,
  finding,
  moduleConfig,
  organization,
} from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { computeAssuranceScore } from "@grc/shared";
import type { ModuleAssuranceData } from "@grc/shared";

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

interface AssuranceSnapshotResult {
  orgsProcessed: number;
  snapshotsCreated: number;
  errors: number;
}

export async function processAssuranceSnapshot(): Promise<AssuranceSnapshotResult> {
  const now = new Date();
  const snapshotDate = now.toISOString().split("T")[0];
  console.log(`[cron:assurance-snapshot] Starting at ${now.toISOString()}`);

  let orgsProcessed = 0;
  let snapshotsCreated = 0;
  let errors = 0;

  const orgs = await db
    .select({ id: organization.id })
    .from(organization)
    .where(isNull(organization.deletedAt));

  for (const org of orgs) {
    try {
      // Get enabled modules
      const enabledModules = await db
        .select({ moduleKey: moduleConfig.moduleKey })
        .from(moduleConfig)
        .where(
          and(
            eq(moduleConfig.orgId, org.id),
            eq(moduleConfig.uiStatus, "enabled"),
          ),
        );

      const enabledSet = new Set(enabledModules.map((m) => m.moduleKey));

      for (const mod of ASSURANCE_MODULES) {
        if (!enabledSet.has(mod)) continue;

        try {
          const data = await collectModuleData(org.id);
          const result = computeAssuranceScore(mod, data);

          await db
            .insert(assuranceScoreSnapshot)
            .values({
              orgId: org.id,
              module: mod,
              score: result.score,
              factors: result.factors,
              recommendations: result.recommendations,
              snapshotDate,
            })
            .onConflictDoUpdate({
              target: [
                assuranceScoreSnapshot.orgId,
                assuranceScoreSnapshot.module,
                assuranceScoreSnapshot.snapshotDate,
              ],
              set: {
                score: result.score,
                factors: result.factors,
                recommendations: result.recommendations,
                computedAt: new Date(),
              },
            });

          snapshotsCreated++;
        } catch (err) {
          errors++;
          console.error(
            `[cron:assurance-snapshot] Error for org ${org.id} module ${mod}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      orgsProcessed++;
    } catch (err) {
      errors++;
      console.error(
        `[cron:assurance-snapshot] Error for org ${org.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:assurance-snapshot] Done. Orgs: ${orgsProcessed}, Snapshots: ${snapshotsCreated}, Errors: ${errors}`,
  );

  return { orgsProcessed, snapshotsCreated, errors };
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
