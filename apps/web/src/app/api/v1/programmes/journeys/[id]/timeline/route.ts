// GET /api/v1/programmes/journeys/[id]/timeline
// Daten für eine Gantt-Darstellung (Phasen + Milestones).

import {
  db,
  programmeJourney,
  programmeJourneyPhase,
  programmeJourneyStep,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, asc } from "drizzle-orm";

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

  const phases = await db
    .select()
    .from(programmeJourneyPhase)
    .where(eq(programmeJourneyPhase.journeyId, id))
    .orderBy(asc(programmeJourneyPhase.sequence));

  const steps = await db
    .select()
    .from(programmeJourneyStep)
    .where(eq(programmeJourneyStep.journeyId, id))
    .orderBy(asc(programmeJourneyStep.sequence));

  const milestones = steps.filter((s) => s.isMilestone);

  return Response.json({
    data: {
      journey: {
        id: journey.id,
        name: journey.name,
        startedAt: journey.startedAt,
        targetCompletionDate: journey.targetCompletionDate,
        status: journey.status,
        progressPercent: journey.progressPercent,
      },
      phases: phases.map((p) => ({
        id: p.id,
        code: p.code,
        sequence: p.sequence,
        name: p.name,
        pdcaPhase: p.pdcaPhase,
        status: p.status,
        progressPercent: p.progressPercent,
        plannedStart: p.plannedStartDate,
        plannedEnd: p.plannedEndDate,
        actualStart: p.actualStartDate,
        actualEnd: p.actualEndDate,
      })),
      milestones: milestones.map((s) => ({
        id: s.id,
        phaseId: s.phaseId,
        code: s.code,
        name: s.name,
        status: s.status,
        dueDate: s.dueDate,
        completedAt: s.completedAt,
        isoClause: s.isoClause,
      })),
    },
  });
}
