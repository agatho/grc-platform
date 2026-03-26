// Cron Job: CES Recompute (Daily at 02:00)
// Recomputes Control Effectiveness Scores for all organizations.

import {
  db,
  controlEffectivenessScore,
  control,
  controlTest,
  finding,
  organization,
} from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { computeCES, computeTrend } from "@grc/shared";

interface CesRecomputeResult {
  processed: number;
  orgsProcessed: number;
  errors: number;
}

export async function processCesRecompute(): Promise<CesRecomputeResult> {
  const now = new Date();
  console.log(`[cron:ces-recompute] Starting at ${now.toISOString()}`);

  let processed = 0;
  let errors = 0;

  // Fetch all active organizations
  const orgs = await db
    .select({ id: organization.id })
    .from(organization)
    .where(isNull(organization.deletedAt));

  for (const org of orgs) {
    // Fetch all active controls for this org
    const controls = await db
      .select({
        id: control.id,
        automationLevel: control.automationLevel,
      })
      .from(control)
      .where(and(eq(control.orgId, org.id), isNull(control.deletedAt)));

    for (const ctrl of controls) {
      try {
        // Fetch last 4 test results
        const tests = await db
          .select({
            result: controlTest.todResult,
            executedDate: controlTest.testDate,
          })
          .from(controlTest)
          .where(
            and(
              eq(controlTest.controlId, ctrl.id),
              eq(controlTest.orgId, org.id),
            ),
          )
          .orderBy(desc(controlTest.testDate))
          .limit(4);

        // Fetch open findings
        const openFindings = await db
          .select({ severity: finding.severity })
          .from(finding)
          .where(
            and(
              eq(finding.controlId, ctrl.id),
              eq(finding.orgId, org.id),
              isNull(finding.deletedAt),
              sql`${finding.status} NOT IN ('closed', 'verified')`,
            ),
          );

        const lastTestDate =
          tests.length > 0 && tests[0].executedDate
            ? new Date(tests[0].executedDate).toISOString()
            : null;

        const cesResult = computeCES({
          testResults: tests
            .filter((t) => t.result)
            .map((t) => ({
              result: t.result!,
              executedDate: t.executedDate
                ? new Date(t.executedDate).toISOString()
                : new Date().toISOString(),
            })),
          openFindings: openFindings.map((f) => ({ severity: f.severity })),
          automationLevel: ctrl.automationLevel,
          lastTestDate,
        });

        // Check existing score for trend
        const [existing] = await db
          .select({ score: controlEffectivenessScore.score })
          .from(controlEffectivenessScore)
          .where(
            and(
              eq(controlEffectivenessScore.controlId, ctrl.id),
              eq(controlEffectivenessScore.orgId, org.id),
            ),
          )
          .limit(1);

        const previousScore = existing?.score ?? null;
        const trend = computeTrend(cesResult.score, previousScore);

        // Upsert
        await db
          .insert(controlEffectivenessScore)
          .values({
            orgId: org.id,
            controlId: ctrl.id,
            score: cesResult.score,
            testScoreAvg: String(cesResult.testScoreAvg),
            overduePenalty: String(cesResult.overduePenalty),
            findingPenalty: String(cesResult.findingPenalty),
            automationBonus: String(cesResult.automationBonus),
            openFindingsCount: openFindings.length,
            lastTestAt: lastTestDate ? new Date(lastTestDate) : null,
            lastComputedAt: new Date(),
            trend,
            previousScore,
          })
          .onConflictDoUpdate({
            target: [
              controlEffectivenessScore.orgId,
              controlEffectivenessScore.controlId,
            ],
            set: {
              score: cesResult.score,
              testScoreAvg: String(cesResult.testScoreAvg),
              overduePenalty: String(cesResult.overduePenalty),
              findingPenalty: String(cesResult.findingPenalty),
              automationBonus: String(cesResult.automationBonus),
              openFindingsCount: openFindings.length,
              lastTestAt: lastTestDate ? new Date(lastTestDate) : null,
              lastComputedAt: new Date(),
              trend,
              previousScore,
              updatedAt: new Date(),
            },
          });

        processed++;
      } catch (err) {
        errors++;
        console.error(
          `[cron:ces-recompute] Error for control ${ctrl.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  console.log(
    `[cron:ces-recompute] Done. Processed: ${processed}, Orgs: ${orgs.length}, Errors: ${errors}`,
  );

  return { processed, orgsProcessed: orgs.length, errors };
}
