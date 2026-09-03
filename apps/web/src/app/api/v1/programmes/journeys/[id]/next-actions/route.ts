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
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

export const GET = withErrorHandler(async function GET(
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
    // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-174] `reason: message` gab den
    // rohen Treibertext an den Aufrufer zurueck — genau der Befund, den
    // E2E-TRIAGE-2026-09-02 in der Schwesterroute `journeys/route.ts`
    // (POST) behoben hat: ein fehlschlagendes Statement liefert dort den
    // vollstaendigen SQL-Text samt gebundener Werte (`org_id`, `owner_id`,
    // `created_by`), also Schema- und Bezeichnerpreisgabe an jeden, der
    // einen 500er provozieren kann. Die Behebung hat diese Datei nicht
    // erfasst. Der Grund gehoert in den Serverlog, nicht in die Antwort.
    log.error("[programmes/next-actions/GET] failed", { err });
    return Response.json(
      {
        error: "Failed to compute next actions",
        detail:
          "The next best actions could not be computed. The cause was logged server-side.",
      },
      { status: 500 },
    );
  }
});
