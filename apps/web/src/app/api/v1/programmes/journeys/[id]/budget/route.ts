// GET /api/v1/programmes/journeys/[id]/budget
//
// Aggregat-Sicht der Cost- und Effort-Daten einer Journey:
// - Total cost_estimate / cost_actual (über Steps + Subtasks)
// - Pro Phase: Aggregate
// - Pro Step: Aggregate (eigene + alle Subtasks)
// - Currency: assumed-uniform per journey (default EUR)

import {
  db,
  programmeJourney,
  programmeJourneyPhase,
  programmeJourneyStep,
  programmeJourneySubtask,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [journey] = await db
    .select({ id: programmeJourney.id, name: programmeJourney.name })
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, id),
        eq(programmeJourney.orgId, ctx.orgId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .limit(1);
  if (!journey) {
    return Response.json({ error: "Journey not found" }, { status: 404 });
  }

  const phases = await db
    .select()
    .from(programmeJourneyPhase)
    .where(eq(programmeJourneyPhase.journeyId, id))
    .orderBy(asc(programmeJourneyPhase.sequence));

  const steps = await db
    .select({
      id: programmeJourneyStep.id,
      phaseId: programmeJourneyStep.phaseId,
      code: programmeJourneyStep.code,
      name: programmeJourneyStep.name,
      costEstimate: programmeJourneyStep.costEstimate,
      costActual: programmeJourneyStep.costActual,
      costCurrency: programmeJourneyStep.costCurrency,
      effortHours: programmeJourneyStep.effortHours,
    })
    .from(programmeJourneyStep)
    .where(eq(programmeJourneyStep.journeyId, id))
    .orderBy(asc(programmeJourneyStep.sequence));

  const stepIds = steps.map((s) => s.id);
  const subs = stepIds.length
    ? await db
        .select({
          id: programmeJourneySubtask.id,
          journeyStepId: programmeJourneySubtask.journeyStepId,
          costEstimate: programmeJourneySubtask.costEstimate,
          costActual: programmeJourneySubtask.costActual,
          effortHours: programmeJourneySubtask.effortHours,
        })
        .from(programmeJourneySubtask)
        .where(inArray(programmeJourneySubtask.journeyStepId, stepIds))
    : [];

  // Aggregation
  const num = (v: unknown): number =>
    typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;

  const subsByStep = new Map<
    string,
    Array<{ costEstimate: unknown; costActual: unknown; effortHours: number | null }>
  >();
  for (const s of subs) {
    const list = subsByStep.get(s.journeyStepId) ?? [];
    list.push(s);
    subsByStep.set(s.journeyStepId, list);
  }

  const stepAggregates = steps.map((s) => {
    const stepSubs = subsByStep.get(s.id) ?? [];
    const subEstimate = stepSubs.reduce(
      (a, x) => a + num(x.costEstimate),
      0,
    );
    const subActual = stepSubs.reduce((a, x) => a + num(x.costActual), 0);
    const subEffort = stepSubs.reduce(
      (a, x) => a + (x.effortHours ?? 0),
      0,
    );
    return {
      id: s.id,
      phaseId: s.phaseId,
      code: s.code,
      name: s.name,
      stepEstimate: num(s.costEstimate),
      stepActual: num(s.costActual),
      stepEffort: s.effortHours ?? 0,
      subtaskEstimate: subEstimate,
      subtaskActual: subActual,
      subtaskEffort: subEffort,
      totalEstimate: num(s.costEstimate) + subEstimate,
      totalActual: num(s.costActual) + subActual,
      totalEffort: (s.effortHours ?? 0) + subEffort,
    };
  });

  const phaseAggregates = phases.map((p) => {
    const phaseSteps = stepAggregates.filter((s) => s.phaseId === p.id);
    return {
      id: p.id,
      name: p.name,
      totalEstimate: phaseSteps.reduce((a, s) => a + s.totalEstimate, 0),
      totalActual: phaseSteps.reduce((a, s) => a + s.totalActual, 0),
      totalEffort: phaseSteps.reduce((a, s) => a + s.totalEffort, 0),
      stepCount: phaseSteps.length,
    };
  });

  const totals = {
    estimate: stepAggregates.reduce((a, s) => a + s.totalEstimate, 0),
    actual: stepAggregates.reduce((a, s) => a + s.totalActual, 0),
    effort: stepAggregates.reduce((a, s) => a + s.totalEffort, 0),
    burnPercent: 0,
  };
  totals.burnPercent =
    totals.estimate > 0
      ? Math.round((totals.actual / totals.estimate) * 1000) / 10
      : 0;

  return Response.json({
    data: {
      journey: { id: journey.id, name: journey.name },
      currency: steps[0]?.costCurrency ?? "EUR",
      totals,
      phases: phaseAggregates,
      steps: stepAggregates,
    },
  });
}
