// GET /api/v1/programmes/journeys/[id]/predictive
//
// Predictive Completion Date + What-if-Simulator.
//
// Aktuell statistisch (kein ML): berechnet Velocity aus den letzten 60 Tagen
// (completed Steps + Subtasks pro Tag), extrapoliert auf restliches Backlog.
// Liefert auch What-if-Variante: "wenn die kritische Phase X um N Tage
// verschoben wird, wann ist Cert?".

import {
  db,
  programmeJourney,
  programmeJourneyStep,
  programmeJourneySubtask,
  programmeJourneyEvent,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, gte, sql } from "drizzle-orm";

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
    .select()
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

  const url = new URL(req.url);
  const shiftDaysParam = url.searchParams.get("shiftDays");
  const shiftDays = shiftDaysParam ? parseInt(shiftDaysParam, 10) : 0;

  // Velocity: count Step+Subtask completions in last 60 days
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);

  const [stepStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`,
      completedRecently: sql<number>`count(*) filter (where status = 'completed' and completed_at >= ${sixtyDaysAgo})::int`,
    })
    .from(programmeJourneyStep)
    .where(eq(programmeJourneyStep.journeyId, id));

  const [subStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`,
      completedRecently: sql<number>`count(*) filter (where status = 'completed' and completed_at >= ${sixtyDaysAgo})::int`,
    })
    .from(programmeJourneySubtask)
    .where(eq(programmeJourneySubtask.orgId, ctx.orgId))
    .where(
      sql`${programmeJourneySubtask.journeyStepId} in (
        select id from programme_journey_step where journey_id = ${id}
      )`,
    );

  // Items per day velocity (over 60-day window)
  const totalCompletedRecently =
    stepStats.completedRecently + subStats.completedRecently;
  const velocityPerDay = totalCompletedRecently / 60;

  const totalRemaining =
    stepStats.total -
    stepStats.completed +
    (subStats.total - subStats.completed);

  // Predicted days to complete remaining at current velocity
  const predictedDaysRemaining =
    velocityPerDay > 0 ? Math.ceil(totalRemaining / velocityPerDay) : null;

  const today = new Date();
  const predictedCompletion =
    predictedDaysRemaining !== null
      ? new Date(today.getTime() + predictedDaysRemaining * 86_400_000)
      : null;

  // Apply what-if shift
  const shiftedCompletion = predictedCompletion
    ? new Date(predictedCompletion.getTime() + shiftDays * 86_400_000)
    : null;

  // Probability of meeting target (very simple: ratio of buffer-days)
  let probabilityOfHittingTarget: number | null = null;
  if (journey.targetCompletionDate && predictedCompletion) {
    const target = new Date(journey.targetCompletionDate + "T00:00:00Z");
    const bufferDays = Math.floor(
      (target.getTime() - predictedCompletion.getTime()) / 86_400_000,
    );
    // Sigmoid: 50% at zero buffer, +100% at +60d buffer
    probabilityOfHittingTarget = Math.round(
      (1 / (1 + Math.exp(-bufferDays / 15))) * 100,
    );
  }

  // Velocity health
  const velocityHealth =
    velocityPerDay >= 0.5
      ? "healthy"
      : velocityPerDay >= 0.2
        ? "slow"
        : velocityPerDay > 0
          ? "very_slow"
          : "stalled";

  return Response.json({
    data: {
      journey: {
        id: journey.id,
        name: journey.name,
        targetCompletionDate: journey.targetCompletionDate,
      },
      velocity: {
        completedItemsLast60d: totalCompletedRecently,
        itemsPerDay: Math.round(velocityPerDay * 100) / 100,
        health: velocityHealth,
      },
      backlog: {
        remainingSteps: stepStats.total - stepStats.completed,
        remainingSubtasks: subStats.total - subStats.completed,
        totalRemaining,
      },
      prediction: {
        predictedDaysRemaining,
        predictedCompletionDate: predictedCompletion?.toISOString().slice(0, 10) ?? null,
        probabilityOfHittingTarget,
      },
      whatIf: {
        shiftDays,
        shiftedCompletionDate:
          shiftedCompletion?.toISOString().slice(0, 10) ?? null,
        impactDays: shiftDays,
      },
      generatedAt: new Date().toISOString(),
    },
  });
}
