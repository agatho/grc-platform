// BPM Overhaul Phase 8: Cost-modeling simulation endpoint.
//
// Lightweight Monte-Carlo cost estimator. Given a scenario with per-activity
// duration (triangular distribution: min/mostLikely/max) and cost-per-execution,
// runs N cases, sums the costs, and writes a process_simulation_result.

import {
  db,
  process,
  simulationScenario,
  simulationActivityParam,
  processSimulationResult,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const activitySchema = z.object({
  activityId: z.string().min(1).max(200),
  activityName: z.string().optional(),
  durationMin: z.number(),
  durationMostLikely: z.number(),
  durationMax: z.number(),
  costPerExecution: z.number().nonnegative().default(0),
});

const scenarioSchema = z.object({
  scenarioName: z.string().min(1).max(500),
  caseCount: z.number().int().min(10).max(10000).default(1000),
  timePeriodDays: z.number().int().min(1).max(365).default(30),
  activities: z.array(activitySchema).min(1).max(200),
});

// Triangular random draw — fast and dependency-free.
function triangular(min: number, mode: number, max: number): number {
  const u = Math.random();
  const c = (mode - min) / (max - min);
  if (u < c) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "quality_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const parsed = scenarioSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Run the cost simulation
  const caseCount = parsed.data.caseCount;
  const cycleTimes: number[] = [];
  const caseCosts: number[] = [];
  const activityCostBreakdown: Record<string, number> = {};
  for (let i = 0; i < caseCount; i++) {
    let caseDuration = 0;
    let caseCost = 0;
    for (const a of parsed.data.activities) {
      const duration = triangular(
        a.durationMin,
        a.durationMostLikely,
        a.durationMax,
      );
      caseDuration += duration;
      caseCost += a.costPerExecution;
      activityCostBreakdown[a.activityName ?? a.activityId] =
        (activityCostBreakdown[a.activityName ?? a.activityId] ?? 0) +
        a.costPerExecution;
    }
    cycleTimes.push(caseDuration);
    caseCosts.push(caseCost);
  }

  cycleTimes.sort((a, b) => a - b);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const pct = (xs: number[], p: number) => xs[Math.floor((xs.length - 1) * p)];
  const avgCycleTime = sum(cycleTimes) / cycleTimes.length;
  const p50 = pct(cycleTimes, 0.5);
  const p95 = pct(cycleTimes, 0.95);
  const avgCost = sum(caseCosts) / caseCosts.length;
  const totalCost = sum(caseCosts);

  // Identify bottleneck activities by mean cost contribution
  const bottlenecks = Object.entries(activityCostBreakdown)
    .map(([name, total]) => ({
      name,
      totalCost: total,
      avgCost: total / caseCount,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5);

  // Persist scenario + result
  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [scenario] = await tx
        .insert(simulationScenario)
        .values({
          orgId: ctx.orgId,
          processId: id,
          name: parsed.data.scenarioName,
          caseCount,
          timePeriodDays: parsed.data.timePeriodDays,
          status: "completed",
          createdBy: ctx.userId,
        })
        .returning();

      // Persist per-activity params
      if (parsed.data.activities.length > 0) {
        await tx.insert(simulationActivityParam).values(
          parsed.data.activities.map((a) => ({
            scenarioId: scenario.id,
            orgId: ctx.orgId,
            activityId: a.activityId,
            activityName: a.activityName ?? null,
            durationMin: String(a.durationMin),
            durationMostLikely: String(a.durationMostLikely),
            durationMax: String(a.durationMax),
            costPerExecution: String(a.costPerExecution),
          })),
        );
      }

      const [res] = await tx
        .insert(processSimulationResult)
        .values({
          scenarioId: scenario.id,
          orgId: ctx.orgId,
          caseCount,
          avgCycleTime: String(avgCycleTime),
          p50CycleTime: String(p50),
          p95CycleTime: String(p95),
          avgCost: String(avgCost),
          totalCost: String(totalCost),
          bottleneckActivities: bottlenecks,
          costBreakdown: activityCostBreakdown,
        })
        .returning();
      return { scenario, result: res };
    },
    { actionDetail: "Cost simulation run" },
  );

  return Response.json({
    data: {
      scenarioId: result.scenario.id,
      resultId: result.result.id,
      avgCycleTime,
      p50CycleTime: p50,
      p95CycleTime: p95,
      avgCost,
      totalCost,
      bottlenecks,
      caseCount,
    },
  });
}
