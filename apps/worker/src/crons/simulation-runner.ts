// Sprint 85: Simulation Runner Worker
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-15, S10-09]
//
// The removed block wrote, under the comment "Insert placeholder results":
//
//     meanValue:   String(Math.random() * 1000000),
//     medianValue: String(Math.random() *  900000),
//     p5Value:     String(Math.random() *  200000),
//     p95Value:    String(Math.random() * 1800000),
//     unit: "EUR",
//
// and then set the run and its scenario to `completed`. Those are
// Monte-Carlo / value-at-risk figures denominated in euros: a risk
// committee reading `simulation_run_result` sees a p95 loss estimate that
// came out of a random number generator, on a run marked completed, with
// nothing in the record suggesting otherwise.
//
// Concurrency (S10-09): the job selected rows that were ALREADY
// `status = 'running'` and did no claim step at all — the audit called this
// the extreme case. Two workers, or one worker restarted mid-run, processed
// the same simulation repeatedly. The `simulation_status` enum has no
// intermediate "claimed" value (draft | configuring | running | completed |
// failed | archived) and a run is created directly as `running`, so the
// claim is the terminal transition itself: `UPDATE … WHERE status='running'
// RETURNING` — exactly one worker wins, and the transition is idempotent.

import { db, simulationRun } from "@grc/db";
import { eq } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { claimRow, createRunReport } from "../lib/job-runtime";

export const processSimulationRunner = withCronInstrumentation(
  "simulation-runner",
  async (): Promise<{
    runsProcessed: number;
    runsFailed: number;
    ok: boolean;
    failed: number;
    errors: string[];
  }> => {
    const report = createRunReport("simulation-runner");

    const pendingRuns = await db
      .select({ id: simulationRun.id })
      .from(simulationRun)
      .where(eq(simulationRun.status, "running"))
      .limit(25);

    let runsFailed = 0;

    for (const run of pendingRuns) {
      try {
        // Atomic claim: only the worker whose UPDATE actually changed the
        // row continues. Everyone else skips.
        const claimed = await claimRow({
          table: "simulation_run",
          id: run.id,
          expectedStatus: "running",
          nextStatus: "failed",
          touchColumns: ["completed_at"],
        });
        if (!claimed) continue;

        await db
          .update(simulationRun)
          .set({
            errorMessage:
              "Monte-Carlo / what-if simulation is not implemented in this " +
              "build. No result was computed, and no result was recorded — " +
              "an absent VaR figure is auditable, an invented one is not.",
            durationMs: 0,
          })
          .where(eq(simulationRun.id, run.id));
        runsFailed++;

        report.fail(
          `run ${run.id}`,
          new Error("simulation engine not implemented — no result persisted"),
        );
      } catch (err) {
        report.fail(`run ${run.id}`, err);
      }
    }

    return report.toResult({
      runsProcessed: pendingRuns.length,
      runsFailed,
    });
  },
);
