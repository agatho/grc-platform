// GET /api/v1/programmes/journeys/[id]/dashboard
// Aggregierte Daten für die Cockpit-Oberfläche.

import {
  db,
  programmeJourney,
  programmeJourneyPhase,
  programmeJourneyStep,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, asc } from "drizzle-orm";
import { recomputeJourneyHealth } from "@/lib/programme/health";

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

  const health = await recomputeJourneyHealth({
    orgId: ctx.orgId,
    journeyId: id,
    persist: true,
  });

  const phases = await db
    .select()
    .from(programmeJourneyPhase)
    .where(eq(programmeJourneyPhase.journeyId, id))
    .orderBy(asc(programmeJourneyPhase.sequence));

  const milestones = await db
    .select()
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.journeyId, id),
        eq(programmeJourneyStep.isMilestone, true),
      ),
    )
    .orderBy(asc(programmeJourneyStep.sequence));

  return Response.json({
    data: {
      journey: {
        ...journey,
        // health-recompute hat ggf. neue Werte gesetzt — re-fetch wäre teuer,
        // wir liefern die vom recomputeJourneyHealth zurückgegebenen Werte.
        status: health?.derivedStatus ?? journey.status,
        healthReason: health?.reason ?? journey.healthReason,
        progressPercent:
          health?.progressPercent != null
            ? health.progressPercent.toFixed(2)
            : journey.progressPercent,
      },
      health: health
        ? {
            derivedStatus: health.derivedStatus,
            reason: health.reason,
            healthScore: health.healthScore,
            signals: health.signals,
            aggregates: health.aggregates,
          }
        : null,
      phases,
      milestones,
    },
  });
}
