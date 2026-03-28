// Sprint 85: Simulation Runner Worker
// Runs every 5 minutes — processes pending simulation runs

import { db, simulationRun, simulationResult, simulationScenario } from "@grc/db";
import { eq, and } from "drizzle-orm";

export async function processSimulationRunner(): Promise<{
  runsProcessed: number;
  runsCompleted: number;
  runsFailed: number;
}> {
  console.log("[simulation-runner] Processing pending simulation runs");

  const pendingRuns = await db.select().from(simulationRun)
    .where(eq(simulationRun.status, "running"));

  let runsCompleted = 0;
  let runsFailed = 0;

  for (const run of pendingRuns) {
    const startTime = Date.now();
    try {
      // In production: execute Monte Carlo / what-if analysis based on scenario type
      // Generate results with statistical metrics
      const durationMs = Date.now() - startTime;

      // Insert placeholder results
      await db.insert(simulationResult).values({
        orgId: run.orgId,
        runId: run.id,
        metricKey: "total_impact",
        metricName: "Total Impact",
        meanValue: String(Math.random() * 1000000),
        medianValue: String(Math.random() * 900000),
        p5Value: String(Math.random() * 200000),
        p95Value: String(Math.random() * 1800000),
        unit: "EUR",
      });

      await db.update(simulationRun).set({
        status: "completed",
        durationMs,
        completedAt: new Date(),
      }).where(eq(simulationRun.id, run.id));

      await db.update(simulationScenario).set({
        status: "completed",
        updatedAt: new Date(),
      }).where(eq(simulationScenario.id, run.scenarioId));

      runsCompleted++;
    } catch (err) {
      console.error(`[simulation-runner] Run ${run.id} failed:`, err);
      await db.update(simulationRun).set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      }).where(eq(simulationRun.id, run.id));
      runsFailed++;
    }
  }

  console.log(`[simulation-runner] Processed ${pendingRuns.length}: ${runsCompleted} completed, ${runsFailed} failed`);
  return { runsProcessed: pendingRuns.length, runsCompleted, runsFailed };
}
