// GET /api/v1/programmes/journeys/[id]/next-actions
// Liefert die priorisierten nächsten Aktionen für die Journey.

import {
  db,
  programmeJourney,
  programmeJourneyPhase,
  programmeJourneyStep,
  programmeTemplateStep,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { computeNextBestActions, type StepCandidate } from "@grc/shared";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  try {
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

  // Prerequisite-Codes aus Template laden über typsicheren Drizzle-Join.
  const prereqByCode = new Map<string, string[]>();
  if (stepRows.length > 0) {
    const tplPrereqs = await db
      .select({
        stepCode: programmeJourneyStep.code,
        prerequisiteStepCodes: programmeTemplateStep.prerequisiteStepCodes,
      })
      .from(programmeJourneyStep)
      .innerJoin(
        programmeTemplateStep,
        eq(programmeTemplateStep.id, programmeJourneyStep.templateStepId),
      )
      .where(
        inArray(
          programmeJourneyStep.id,
          stepRows.map((s) => s.id),
        ),
      );
    for (const row of tplPrereqs) {
      const arr = Array.isArray(row.prerequisiteStepCodes)
        ? (row.prerequisiteStepCodes as string[])
        : [];
      prereqByCode.set(row.stepCode, arr);
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[programmes/next-actions/GET] failed:", message, err);
    return Response.json(
      { error: "Failed to compute next actions", reason: message },
      { status: 500 },
    );
  }
}
