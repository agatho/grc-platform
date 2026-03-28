import { db, simulationScenario, simulationActivityParam, simulationResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/processes/:id/simulation/run — Run simulation
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;
  const { scenarioId } = await req.json();

  if (!scenarioId) {
    return Response.json({ error: "scenarioId required" }, { status: 422 });
  }

  // Load scenario + params
  const [scenario] = await db
    .select()
    .from(simulationScenario)
    .where(
      and(
        eq(simulationScenario.id, scenarioId),
        eq(simulationScenario.processId, processId),
        eq(simulationScenario.orgId, ctx.orgId),
      ),
    );

  if (!scenario) {
    return Response.json({ error: "Scenario not found" }, { status: 404 });
  }

  const activityParams = await db
    .select()
    .from(simulationActivityParam)
    .where(eq(simulationActivityParam.scenarioId, scenarioId));

  if (activityParams.length === 0) {
    return Response.json({ error: "No activity parameters configured" }, { status: 422 });
  }

  // Run Monte Carlo simulation with PERT distribution
  const caseCount = scenario.caseCount ?? 1000;
  const caseResults: { duration: number; cost: number; taskTimes: Record<string, number> }[] = [];

  for (let i = 0; i < caseCount; i++) {
    let totalDuration = 0;
    let totalCost = 0;
    const taskTimes: Record<string, number> = {};

    for (const param of activityParams) {
      const min = parseFloat(param.durationMin as string);
      const ml = parseFloat(param.durationMostLikely as string);
      const max = parseFloat(param.durationMax as string);
      const duration = pertSample(min, ml, max);
      const cost = parseFloat(param.costPerExecution as string) || 0;

      // Handle gateway probabilities
      if (param.gatewayProbabilities) {
        const probs = param.gatewayProbabilities as Record<string, number>;
        const rand = Math.random();
        let cumulative = 0;
        let selected = false;
        for (const [, prob] of Object.entries(probs)) {
          cumulative += prob;
          if (rand <= cumulative) {
            selected = true;
            break;
          }
        }
        if (!selected) continue;
      }

      taskTimes[param.activityId] = duration;
      totalDuration += duration;
      totalCost += cost;
    }

    caseResults.push({ duration: totalDuration, cost: totalCost, taskTimes });
  }

  // Compute statistics
  const durations = caseResults.map((r) => r.duration).sort((a, b) => a - b);
  const costs = caseResults.map((r) => r.cost);
  const avgCycleTime = mean(durations);
  const p50CycleTime = percentile(durations, 50);
  const p95CycleTime = percentile(durations, 95);
  const avgCost = mean(costs);
  const totalCost = costs.reduce((a, b) => a + b, 0);

  // Find bottlenecks
  const bottlenecks = activityParams.map((p) => {
    const times = caseResults.map((r) => r.taskTimes[p.activityId] ?? 0);
    return {
      activityId: p.activityId,
      activityName: p.activityName ?? p.activityId,
      avgDuration: mean(times),
      avgWaitTime: 0,
      utilizationPct: (mean(times) / avgCycleTime) * 100,
    };
  }).sort((a, b) => b.avgDuration - a.avgDuration);

  // Build histogram
  const binCount = 30;
  const histMin = durations[0] ?? 0;
  const histMax = durations[durations.length - 1] ?? 1;
  const binWidth = (histMax - histMin) / binCount || 1;
  const histogram = Array.from({ length: binCount }, (_, i) => ({
    binStart: histMin + i * binWidth,
    binEnd: histMin + (i + 1) * binWidth,
    count: durations.filter(
      (d) => d >= histMin + i * binWidth && d < histMin + (i + 1) * binWidth,
    ).length,
  }));

  // Store result
  const result = await withAuditContext(ctx, async (tx) => {
    const [stored] = await tx
      .insert(simulationResult)
      .values({
        scenarioId,
        orgId: ctx.orgId,
        caseCount,
        avgCycleTime: avgCycleTime.toFixed(4),
        p50CycleTime: p50CycleTime.toFixed(4),
        p95CycleTime: p95CycleTime.toFixed(4),
        avgCost: avgCost.toFixed(2),
        totalCost: totalCost.toFixed(2),
        bottleneckActivities: bottlenecks.slice(0, 10),
        costBreakdown: Object.fromEntries(
          activityParams.map((p) => [
            p.activityId,
            parseFloat(p.costPerExecution as string) * caseCount,
          ]),
        ),
        resourceUtilization: {},
        histogram,
      })
      .returning();
    return stored;
  });

  return Response.json({ data: result }, { status: 201 });
}

// PERT distribution sampling
function pertSample(min: number, ml: number, max: number): number {
  const lambda = 4;
  const mu = (min + lambda * ml + max) / (lambda + 2);
  const alpha = ((mu - min) * (2 * ml - min - max)) / ((ml - mu) * (max - min)) || 2;
  const beta = (alpha * (max - mu)) / (mu - min) || 2;

  const alphaClamp = Math.max(0.5, Math.min(alpha, 20));
  const betaClamp = Math.max(0.5, Math.min(beta, 20));

  const u = betaRandom(alphaClamp, betaClamp);
  return min + u * (max - min);
}

function betaRandom(a: number, b: number): number {
  const x = gammaRandom(a);
  const y = gammaRandom(b);
  return x / (x + y);
}

function gammaRandom(shape: number): number {
  if (shape < 1) {
    return gammaRandom(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      x = normalRandom();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function normalRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower] ?? 0;
  return (sorted[lower] ?? 0) + (idx - lower) * ((sorted[upper] ?? 0) - (sorted[lower] ?? 0));
}
