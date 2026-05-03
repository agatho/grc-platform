// GET /api/v1/programmes/portfolio
//
// Cross-Programme aggregate view für Steering. Liefert pro aktiver Journey
// die wichtigsten KPIs + Aggregate über alle Journeys hinweg.

import {
  db,
  programmeJourney,
  programmeJourneyStep,
  programmeJourneySubtask,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const journeys = await db
    .select()
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.orgId, ctx.orgId),
        isNull(programmeJourney.deletedAt),
        sql`${programmeJourney.status} != 'archived'`,
      ),
    );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const next30 = new Date(today);
  next30.setUTCDate(next30.getUTCDate() + 30);
  const next30Str = next30.toISOString().slice(0, 10);

  const items = await Promise.all(
    journeys.map(async (j) => {
      const stepStats = await db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where status = 'completed')::int`,
          blocked: sql<number>`count(*) filter (where status = 'blocked')::int`,
          overdue: sql<number>`count(*) filter (where due_date < ${todayStr} and status not in ('completed','skipped','cancelled'))::int`,
          milestoneIn30d: sql<number>`count(*) filter (where is_milestone = true and due_date >= ${todayStr} and due_date < ${next30Str})::int`,
        })
        .from(programmeJourneyStep)
        .where(
          and(
            eq(programmeJourneyStep.journeyId, j.id),
            eq(programmeJourneyStep.orgId, ctx.orgId),
          ),
        );
      const subStats = await db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where status = 'completed')::int`,
        })
        .from(programmeJourneySubtask)
        .where(eq(programmeJourneySubtask.orgId, ctx.orgId))
        .where(
          sql`${programmeJourneySubtask.journeyStepId} in (
            select id from programme_journey_step where journey_id = ${j.id}
          )`,
        );
      return {
        id: j.id,
        name: j.name,
        msType: j.msType,
        templateCode: j.templateCode,
        templateVersion: j.templateVersion,
        status: j.status,
        progressPercent: parseFloat(j.progressPercent.toString()),
        startedAt: j.startedAt,
        targetCompletionDate: j.targetCompletionDate,
        steps: stepStats[0],
        subtasks: subStats[0],
      };
    }),
  );

  const totals = items.reduce(
    (acc, it) => {
      acc.totalSteps += it.steps.total;
      acc.completedSteps += it.steps.completed;
      acc.blockedSteps += it.steps.blocked;
      acc.overdueSteps += it.steps.overdue;
      acc.milestonesNext30d += it.steps.milestoneIn30d;
      acc.totalSubtasks += it.subtasks.total;
      acc.completedSubtasks += it.subtasks.completed;
      return acc;
    },
    {
      totalSteps: 0,
      completedSteps: 0,
      blockedSteps: 0,
      overdueSteps: 0,
      milestonesNext30d: 0,
      totalSubtasks: 0,
      completedSubtasks: 0,
    },
  );

  return Response.json({
    data: {
      journeyCount: items.length,
      totals,
      journeys: items,
    },
  });
}
