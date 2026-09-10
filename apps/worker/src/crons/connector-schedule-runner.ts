// Sprint 62: Evidence Connector Framework — Schedule Runner
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-06 (High)]
//
// Two defects lived here, and they amplified each other.
//
// (1) Fabricated evidence. For every active test definition the job wrote
//     `connector_test_result` with `status: "pass"`, `resourcesFailed: 0`,
//     `findings: []` and `durationMs: Math.floor(Math.random()*500)+50`,
//     under the comment "Simulated — real impl would execute test logic".
//     No test was executed. `connector_test_result` is the table an
//     ISO-27001 / SOC-2 assessor reads as proof of continuous control
//     effectiveness.
//
// (2) The schedule never advanced. The selection filtered
//     `next_run_at <= now`, but the update wrote `last_run_at`,
//     `last_run_status`, `last_run_duration_ms`, `consecutive_failures` and
//     `updated_at` — never `next_run_at`. Repository-wide,
//     `connector_schedule.next_run_at` was written by nothing at all. A
//     schedule that fell due once stayed due forever: 12 test definitions ×
//     96 runs a day = 1.152 fabricated "pass" results per schedule per day,
//     growing without bound.
//
// Both are fixed here:
//   * nothing is persisted as a test result, because nothing is measured;
//   * `next_run_at` is advanced from the schedule's own cron expression on
//     every run — success or failure — so the loop terminates;
//   * the failure is recorded on the schedule (`last_run_status`,
//     `consecutive_failures`) and logged with its cause, instead of the
//     previous bare `catch {}` that swallowed the reason.

import {
  db,
  connectorSchedule,
  evidenceConnector,
  connectorTestDefinition,
} from "@grc/db";
import { eq, and, lte, isNull } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { parseCron, nextRunAfter } from "../lib/scheduler";
import { createRunReport, withOrgContext } from "../lib/job-runtime";

export const connectorScheduleRunnerCron = "*/15 * * * *"; // Every 15 minutes

export const connectorScheduleRunner = withCronInstrumentation(
  "connector-schedule-runner",
  async (): Promise<{
    due: number;
    advanced: number;
    testsSkipped: number;
    ok: boolean;
    failed: number;
    errors: string[];
  }> => {
    const report = createRunReport("connector-schedule-runner");
    const now = new Date();
    let advanced = 0;
    let testsSkipped = 0;

    const dueSchedules = await db
      .select()
      .from(connectorSchedule)
      .where(
        and(
          eq(connectorSchedule.isEnabled, true),
          lte(connectorSchedule.nextRunAt, now),
        ),
      )
      .limit(50);

    for (const schedule of dueSchedules) {
      try {
        let next: Date | null = null;
        try {
          next = nextRunAfter(parseCron(schedule.cronExpression), now);
        } catch (err) {
          report.fail(
            `schedule ${schedule.id} cron "${schedule.cronExpression}"`,
            err,
          );
        }

        const [connector] = await db
          .select()
          .from(evidenceConnector)
          .where(
            and(
              eq(evidenceConnector.id, schedule.connectorId),
              eq(evidenceConnector.status, "active"),
              isNull(evidenceConnector.deletedAt),
            ),
          );

        let applicableTests = 0;
        if (connector) {
          const testDefs = await db
            .select({ testKey: connectorTestDefinition.testKey })
            .from(connectorTestDefinition)
            .where(
              and(
                eq(
                  connectorTestDefinition.connectorType,
                  connector.connectorType,
                ),
                eq(connectorTestDefinition.isActive, true),
              ),
            );
          const testIds = (schedule.testIds as string[] | null) ?? [];
          applicableTests =
            testIds.length > 0
              ? testDefs.filter((t) => testIds.includes(t.testKey)).length
              : testDefs.length;
        }
        testsSkipped += applicableTests;

        await withOrgContext(schedule.orgId, async (tx) => {
          await tx
            .update(connectorSchedule)
            .set({
              lastRunAt: now,
              // Honest status: the run happened, executed nothing and
              // produced no evidence. The old code always wrote "success"
              // here, because `failCount` was declared and never
              // incremented.
              lastRunStatus: "failure",
              lastRunDurationMs: 0,
              consecutiveFailures: (schedule.consecutiveFailures ?? 0) + 1,
              // `next_run_at` — the column nothing in the repository wrote.
              nextRunAt: next,
              updatedAt: now,
            })
            .where(eq(connectorSchedule.id, schedule.id));
        });
        if (next) advanced++;

        report.fail(
          `schedule ${schedule.id}`,
          new Error(
            `connector test execution is not implemented in this build; ` +
              `${applicableTests} test definition(s) were NOT run and no ` +
              `result was recorded`,
          ),
        );
      } catch (err) {
        report.fail(`schedule ${schedule.id}`, err);
      }
    }

    return report.toResult({
      due: dueSchedules.length,
      advanced,
      testsSkipped,
    });
  },
);
