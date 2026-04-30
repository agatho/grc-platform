// GET /api/v1/programmes/journeys/[id]/next-actions
// Liefert die priorisierten nächsten Aktionen für die Journey.

import {
  db,
  programmeJourney,
  programmeJourneyPhase,
  programmeJourneyStep,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, sql } from "drizzle-orm";
import { computeNextBestActions, type StepCandidate } from "@grc/shared";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, Math.min(50, Number(limitRaw))) : 5;

  const [journey] = await db
    .select({ id: programmeJourney.id })
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
    .select({
      id: programmeJourneyPhase.id,
      sequence: programmeJourneyPhase.sequence,
    })
    .from(programmeJourneyPhase)
    .where(eq(programmeJourneyPhase.journeyId, id));

  const phaseSeqById = new Map<string, number>();
  for (const p of phases) phaseSeqById.set(p.id, p.sequence);

  const stepRows = await db
    .select({
      id: programmeJourneyStep.id,
      code: programmeJourneyStep.code,
      name: programmeJourneyStep.name,
      phaseId: programmeJourneyStep.phaseId,
      sequence: programmeJourneyStep.sequence,
      status: programmeJourneyStep.status,
      ownerId: programmeJourneyStep.ownerId,
      dueDate: programmeJourneyStep.dueDate,
      isMandatory: programmeJourneyStep.isMandatory,
    })
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.journeyId, id),
        eq(programmeJourneyStep.orgId, ctx.orgId),
      ),
    );

  // Prerequisite-Codes aus Template laden (raw SQL für Join-Optimierung)
  const prereqByCode = new Map<string, string[]>();
  if (stepRows.length > 0) {
    const stepIds = stepRows.map((s) => s.id);
    const tplPrereqs = (await db.execute(sql`
      SELECT pjs.code AS step_code, pts.prerequisite_step_codes
      FROM programme_journey_step pjs
      JOIN programme_template_step pts ON pts.id = pjs.template_step_id
      WHERE pjs.id = ANY(${stepIds}::uuid[])
    `)) as unknown as Array<{
      step_code: string;
      prerequisite_step_codes: unknown;
    }>;
    for (const row of tplPrereqs) {
      const arr = Array.isArray(row.prerequisite_step_codes)
        ? (row.prerequisite_step_codes as string[])
        : [];
      prereqByCode.set(row.step_code, arr);
    }
  }

  const candidates: StepCandidate[] = stepRows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    phaseSequence: phaseSeqById.get(s.phaseId) ?? 0,
    sequence: s.sequence,
    status: s.status,
    ownerId: s.ownerId,
    dueDate: s.dueDate,
    isMandatory: s.isMandatory,
    prerequisiteStepCodes: prereqByCode.get(s.code) ?? [],
  }));

  const actions = computeNextBestActions({
    steps: candidates,
    today: new Date().toISOString().slice(0, 10),
    limit,
  });

  return Response.json({ data: actions });
}
