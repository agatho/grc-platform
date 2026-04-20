// Sprint 79: VaR Calculation Runner
// Processes queued VaR calculations using Monte Carlo simulation

import { db, riskVarCalculation } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";

interface VarCalculationRunnerResult {
  queued: number;
  completed: number;
  failed: number;
}

export async function processVarCalculationRunner(): Promise<VarCalculationRunnerResult> {
  const result: VarCalculationRunnerResult = {
    queued: 0,
    completed: 0,
    failed: 0,
  };

  // Get pending calculations
  const pending = await db
    .select()
    .from(riskVarCalculation)
    .where(eq(riskVarCalculation.status, "pending"))
    .limit(5);

  result.queued = pending.length;

  for (const calc of pending) {
    try {
      // Mark as running
      await db
        .update(riskVarCalculation)
        .set({ status: "running" })
        .where(eq(riskVarCalculation.id, calc.id));

      // Get risk data for this org
      const risks = await db.execute(sql`
        SELECT r.id, fp.lef_min, fp.lef_most_likely, fp.lef_max,
               fp.lm_min, fp.lm_most_likely, fp.lm_max
        FROM risk r
        JOIN fair_parameters fp ON fp.risk_id = r.id
        WHERE r.org_id = ${calc.orgId}
      `);

      const riskArray = risks as Array<Record<string, unknown>>;
      const iterations = calc.iterations ?? 10000;

      if (riskArray.length === 0) {
        await db
          .update(riskVarCalculation)
          .set({ status: "completed", riskCount: 0, computedAt: new Date() })
          .where(eq(riskVarCalculation.id, calc.id));
        result.completed++;
        continue;
      }

      // Simple Monte Carlo simulation
      const losses: number[] = [];
      for (let i = 0; i < iterations; i++) {
        let totalLoss = 0;
        for (const risk of riskArray) {
          const lef = randomPert(
            Number(risk.lef_min),
            Number(risk.lef_most_likely),
            Number(risk.lef_max),
          );
          const lm = randomPert(
            Number(risk.lm_min),
            Number(risk.lm_most_likely),
            Number(risk.lm_max),
          );
          totalLoss += lef * lm;
        }
        losses.push(totalLoss);
      }

      losses.sort((a, b) => a - b);
      const percentile = (p: number) =>
        losses[Math.floor(losses.length * p)] ?? 0;
      const mean = losses.reduce((a, b) => a + b, 0) / losses.length;
      const stdDev = Math.sqrt(
        losses.reduce((a, b) => a + (b - mean) ** 2, 0) / losses.length,
      );

      await db
        .update(riskVarCalculation)
        .set({
          status: "completed",
          riskCount: riskArray.length,
          varP50: String(percentile(0.5).toFixed(2)),
          varP75: String(percentile(0.75).toFixed(2)),
          varP90: String(percentile(0.9).toFixed(2)),
          varP95: String(percentile(0.95).toFixed(2)),
          varP99: String(percentile(0.99).toFixed(2)),
          expectedLoss: String(mean.toFixed(2)),
          standardDeviation: String(stdDev.toFixed(2)),
          computedAt: new Date(),
        })
        .where(eq(riskVarCalculation.id, calc.id));

      result.completed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(riskVarCalculation)
        .set({ status: "failed", error: message })
        .where(eq(riskVarCalculation.id, calc.id));
      result.failed++;
    }
  }

  return result;
}

function randomPert(min: number, mode: number, max: number): number {
  if (min >= max) return mode;
  const lambda = 4;
  const alpha = 1 + (lambda * (mode - min)) / (max - min);
  const beta = 1 + (lambda * (max - mode)) / (max - min);
  const u = betaRandom(alpha, beta);
  return min + u * (max - min);
}

function betaRandom(alpha: number, beta: number): number {
  const gammaA = gammaRandom(alpha);
  const gammaB = gammaRandom(beta);
  return gammaA / (gammaA + gammaB);
}

function gammaRandom(shape: number): number {
  if (shape < 1) {
    return gammaRandom(1 + shape) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  let x: number, v: number, u: number;
  do {
    do {
      x = normalRandom();
      v = (1 + c * x) ** 3;
    } while (v <= 0);
    u = Math.random();
  } while (
    u >= 1 - 0.0331 * x ** 4 &&
    Math.log(u) >= 0.5 * x ** 2 + d * (1 - v + Math.log(v))
  );
  return d * v;
}

function normalRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
