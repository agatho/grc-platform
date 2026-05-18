// BPM Overhaul Phase 2: Control coverage aggregation per process.
//
// Returns coverage stats per activity (step) plus a process-wide summary:
//   - activitiesWithoutControl: number
//   - effectivenessAvg: % of controls in effective state
//   - per-activity control list with status

import {
  db,
  process,
  processStep,
  processStepControl,
  processControl,
  control,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
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

  // Per-step control aggregation
  const perStep = await db
    .select({
      stepId: processStep.id,
      bpmnElementId: processStep.bpmnElementId,
      name: processStep.name,
      controlCount: sql<number>`COUNT(DISTINCT ${processStepControl.controlId})::int`,
      effectiveCount: sql<number>`SUM(CASE WHEN ${control.status} = 'effective' THEN 1 ELSE 0 END)::int`,
      ineffectiveCount: sql<number>`SUM(CASE WHEN ${control.status} = 'ineffective' THEN 1 ELSE 0 END)::int`,
      implementedCount: sql<number>`SUM(CASE WHEN ${control.status} = 'implemented' THEN 1 ELSE 0 END)::int`,
      designedCount: sql<number>`SUM(CASE WHEN ${control.status} = 'designed' THEN 1 ELSE 0 END)::int`,
    })
    .from(processStep)
    .leftJoin(
      processStepControl,
      eq(processStep.id, processStepControl.processStepId),
    )
    .leftJoin(
      control,
      and(
        eq(control.id, processStepControl.controlId),
        isNull(control.deletedAt),
      ),
    )
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)))
    .groupBy(processStep.id, processStep.bpmnElementId, processStep.name);

  // Process-level control links
  const processLevelControls = await db
    .select({
      controlId: control.id,
      title: control.title,
      status: control.status,
    })
    .from(processControl)
    .innerJoin(
      control,
      and(eq(control.id, processControl.controlId), isNull(control.deletedAt)),
    )
    .where(eq(processControl.processId, id));

  const totalActivities = perStep.length;
  const activitiesWithoutControl = perStep.filter(
    (s) => (s.controlCount ?? 0) === 0,
  ).length;
  const totalControls = perStep.reduce(
    (acc, s) => acc + (s.controlCount ?? 0),
    0,
  );
  const totalEffective = perStep.reduce(
    (acc, s) => acc + (s.effectiveCount ?? 0),
    0,
  );

  return Response.json({
    data: {
      processId: id,
      activities: perStep,
      processLevelControls,
      summary: {
        totalActivities,
        activitiesWithoutControl,
        coveragePct:
          totalActivities === 0
            ? 0
            : Math.round(
                ((totalActivities - activitiesWithoutControl) /
                  totalActivities) *
                  100,
              ),
        totalControls,
        effectiveCount: totalEffective,
        effectivenessAvgPct:
          totalControls === 0
            ? 0
            : Math.round((totalEffective / totalControls) * 100),
      },
    },
  });
}
