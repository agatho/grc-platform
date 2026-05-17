// BPM Overhaul Phase 2: Risk Heatmap aggregation per BPMN element.
//
// Returns one row per process_step with the activity's BPMN element id and
// aggregate risk scores. Used by the BPMN-js overlay renderer to color
// activities red/amber/green.

import { db, process, processStep, processStepRisk, processRisk, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

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
  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Per-step aggregation
  const perStep = await db
    .select({
      stepId: processStep.id,
      bpmnElementId: processStep.bpmnElementId,
      name: processStep.name,
      riskCount: sql<number>`COUNT(DISTINCT ${processStepRisk.riskId})::int`,
      maxInherent: sql<number | null>`MAX(${risk.riskScoreInherent})::int`,
      maxResidual: sql<number | null>`MAX(${risk.riskScoreResidual})::int`,
      criticalCount: sql<number>`SUM(CASE WHEN ${risk.riskScoreResidual} >= 15 THEN 1 ELSE 0 END)::int`,
      highCount: sql<number>`SUM(CASE WHEN ${risk.riskScoreResidual} BETWEEN 9 AND 14 THEN 1 ELSE 0 END)::int`,
      mediumCount: sql<number>`SUM(CASE WHEN ${risk.riskScoreResidual} BETWEEN 4 AND 8 THEN 1 ELSE 0 END)::int`,
      lowCount: sql<number>`SUM(CASE WHEN ${risk.riskScoreResidual} <= 3 THEN 1 ELSE 0 END)::int`,
    })
    .from(processStep)
    .leftJoin(processStepRisk, eq(processStep.id, processStepRisk.processStepId))
    .leftJoin(risk, and(eq(risk.id, processStepRisk.riskId), isNull(risk.deletedAt)))
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)))
    .groupBy(processStep.id, processStep.bpmnElementId, processStep.name);

  // Process-wide totals (also includes process-level risks not pinned to a step)
  const [overall] = await db
    .select({
      processRiskCount: sql<number>`COUNT(DISTINCT ${processRisk.riskId})::int`,
    })
    .from(processRisk)
    .where(eq(processRisk.processId, id));

  const totals = perStep.reduce(
    (acc, r) => {
      acc.critical += r.criticalCount ?? 0;
      acc.high += r.highCount ?? 0;
      acc.medium += r.mediumCount ?? 0;
      acc.low += r.lowCount ?? 0;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  return Response.json({
    data: {
      processId: id,
      activities: perStep,
      totals: {
        ...totals,
        processLevelRiskCount: overall?.processRiskCount ?? 0,
      },
    },
  });
}
