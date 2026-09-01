// Sprint 41: Resilience Score Snapshot Worker
// MONTHLY (1st of month) — Compute all 7 resilience factors and store snapshot
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S14-04, S10-11, S10-13]
//
// The audit found three of seven factors permanently `0`, making the score
// systematically too low. Running the job against the live database turned
// up something worse: the three SQL statements it did execute referenced
// `bc_process`, `crisis_contact_tree` and `recovery_procedure` — none of
// which exist in the schema. Every organisation therefore threw on the
// first query, the empty `catch { // Wrapper logs structured error }`
// swallowed it (that comment is false: `withCronInstrumentation` only logs
// what ESCAPES the handler — S10-11), and the job returned
// `{processed: N, snapshots: 0}` as HTTP 200 `success: true`. Not one
// snapshot was ever written, and nothing said so.
//
// This rewrite:
//   * computes all seven factors from tables that actually exist (`bcp`,
//     `bcp_procedure`, `bc_exercise`, `crisis_scenario`,
//     `crisis_team_member`, `vendor`, `vendor_exit_plan`);
//   * yields `null` — not `0` — for a factor with an empty denominator and
//     SKIPS the organisation rather than persisting a low score that reads
//     as measured weakness. "No BCP exists yet" and "every BCP is out of
//     date" must not look identical in a resilience trend;
//   * reports every failure instead of discarding it.

import { db, resilienceScoreSnapshot, organization } from "@grc/db";
import { sql, isNull, type SQL } from "drizzle-orm";
import { computeResilienceScore } from "@grc/shared";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { createRunReport, withOrgContext } from "../lib/job-runtime";

/** Percentage numerator/denominator, or null when there is nothing to measure. */
async function ratio(numerator: SQL, denominator: SQL): Promise<number | null> {
  const rows = (await db.execute(sql`
    SELECT (${numerator})::numeric AS num, (${denominator})::numeric AS den
  `)) as unknown as Array<{ num: string; den: string }>;
  const den = Number(rows[0]?.den ?? 0);
  if (!den) return null;
  const num = Number(rows[0]?.num ?? 0);
  return Math.max(0, Math.min(100, Math.round((num / den) * 100)));
}

export const processResilienceScoreSnapshot = withCronInstrumentation(
  "resilience-score-snapshot",
  async (): Promise<{
    processed: number;
    snapshots: number;
    skippedInsufficientData: number;
    ok: boolean;
    failed: number;
    errors: string[];
  }> => {
    const report = createRunReport("resilience-score-snapshot");
    let snapshots = 0;
    let skippedInsufficientData = 0;

    const orgs = await db
      .select({ id: organization.id })
      .from(organization)
      .where(isNull(organization.deletedAt));

    for (const org of orgs) {
      try {
        const id = org.id;
        const allPlans = sql`(SELECT count(*) FROM bcp WHERE org_id = ${id}::uuid AND deleted_at IS NULL)`;

        // BIA completeness — approved business continuity plans.
        const biaCompleteness = await ratio(
          sql`(SELECT count(*) FROM bcp WHERE org_id = ${id}::uuid AND deleted_at IS NULL AND approved_at IS NOT NULL)`,
          allPlans,
        );

        // BCP currency — plans whose next review date has not passed.
        const bcpCurrency = await ratio(
          sql`(SELECT count(*) FROM bcp WHERE org_id = ${id}::uuid AND deleted_at IS NULL AND next_review_date >= CURRENT_DATE)`,
          allPlans,
        );

        // Exercise completion — plans exercised in the last 12 months.
        const exerciseCompletion = await ratio(
          sql`(SELECT count(DISTINCT e.bcp_id) FROM bc_exercise e
                WHERE e.org_id = ${id}::uuid AND e.status = 'completed'
                  AND e.bcp_id IS NOT NULL
                  AND coalesce(e.actual_date, e.planned_date) > CURRENT_DATE - INTERVAL '12 months')`,
          allPlans,
        );

        // Recovery capability — plans tested in the last 12 months.
        const recoverCapability = await ratio(
          sql`(SELECT count(*) FROM bcp WHERE org_id = ${id}::uuid AND deleted_at IS NULL
                 AND last_tested_date > CURRENT_DATE - INTERVAL '12 months')`,
          allPlans,
        );

        // Communication readiness — crisis scenarios with a reachable
        // primary responder (a team member carrying a phone number).
        const communicationReadiness = await ratio(
          sql`(SELECT count(DISTINCT m.crisis_scenario_id) FROM crisis_team_member m
                WHERE m.org_id = ${id}::uuid AND m.is_primary = true
                  AND m.phone_number IS NOT NULL AND m.phone_number <> '')`,
          sql`(SELECT count(*) FROM crisis_scenario WHERE org_id = ${id}::uuid)`,
        );

        // Procedure completeness — plans with at least one step that names
        // a responsible party AND success criteria.
        const procedureCompleteness = await ratio(
          sql`(SELECT count(DISTINCT p.bcp_id) FROM bcp_procedure p
                WHERE p.org_id = ${id}::uuid
                  AND (p.responsible_role IS NOT NULL OR p.responsible_id IS NOT NULL)
                  AND p.success_criteria IS NOT NULL)`,
          allPlans,
        );

        // Supply-chain resilience — critical vendors with an approved exit
        // plan. "Critical" = top tier or DORA-critical ICT provider.
        const criticalVendors = sql`(SELECT count(*) FROM vendor v
             WHERE v.org_id = ${id}::uuid AND v.deleted_at IS NULL
               AND (v.tier = 'critical' OR v.dora_critical_ict = true))`;
        const supplyChainResilience = await ratio(
          sql`(SELECT count(DISTINCT v.id) FROM vendor v
                 JOIN vendor_exit_plan x ON x.vendor_id = v.id AND x.status = 'approved'
                WHERE v.org_id = ${id}::uuid AND v.deleted_at IS NULL
                  AND (v.tier = 'critical' OR v.dora_critical_ict = true))`,
          criticalVendors,
        );

        const factors = {
          biaCompleteness,
          bcpCurrency,
          exerciseCompletion,
          recoverCapability,
          communicationReadiness,
          procedureCompleteness,
          supplyChainResilience,
        };

        if (Object.values(factors).some((v) => v === null)) {
          // Not measurable ≠ measured as zero. Skip rather than persist a
          // number a board report would read as a genuine weakness.
          skippedInsufficientData++;
          continue;
        }

        const measured = factors as { [K in keyof typeof factors]: number };
        const overallScore = computeResilienceScore(measured);

        await withOrgContext(id, async (tx) => {
          await tx.insert(resilienceScoreSnapshot).values({
            orgId: id,
            overallScore,
            ...measured,
          });
        });
        snapshots++;
      } catch (err) {
        report.fail(`org ${org.id}`, err);
      }
    }

    return report.toResult({
      processed: orgs.length,
      snapshots,
      skippedInsufficientData,
    });
  },
);
