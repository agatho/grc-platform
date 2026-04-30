// POST /api/v1/programmes/journeys/[id]/steps/[stepId]/transition
//
// Validierter Status-Übergang für einen Schritt. Erzwingt:
//   - Server-side state-machine
//   - Prerequisites bei pending → in_progress
//   - Evidence-Count bei in_progress → review
//   - Skip / Block: Pflicht-Reason
//
// Triggert Health-Recompute der Journey.

import {
  db,
  programmeJourney,
  programmeJourneyEvent,
  programmeJourneyStep,
  programmeTemplateStep,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull, inArray } from "drizzle-orm";
import {
  validateStepTransition,
  assertCanStartStep,
  assertCanReviewStep,
  type ProgrammeStepStatus,
} from "@grc/shared";
import { stepTransitionSchema } from "@grc/shared";
import { recomputeJourneyHealth } from "@/lib/programme/health";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = stepTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Journey + Step laden
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

  const [step] = await db
    .select()
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.id, stepId),
        eq(programmeJourneyStep.journeyId, id),
        eq(programmeJourneyStep.orgId, ctx.orgId),
      ),
    )
    .limit(1);
  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  const from = step.status as ProgrammeStepStatus;
  const to = parsed.data.to;

  // 1) Generic state-machine validation (incl. reason for skip/block)
  const trans = validateStepTransition({
    from,
    to,
    reason: parsed.data.reason,
  });
  if (!trans.ok) {
    return Response.json(
      { error: "Invalid transition", reason: trans.reason, from, to },
      { status: 422 },
    );
  }

  // 2) pending → in_progress: prerequisites müssen erfüllt sein
  if (from === "pending" && to === "in_progress") {
    const [tplStep] = await db
      .select({
        prerequisiteStepCodes: programmeTemplateStep.prerequisiteStepCodes,
      })
      .from(programmeTemplateStep)
      .where(eq(programmeTemplateStep.id, step.templateStepId))
      .limit(1);
    const prereqs = Array.isArray(tplStep?.prerequisiteStepCodes)
      ? (tplStep!.prerequisiteStepCodes as string[])
      : [];
    if (prereqs.length > 0) {
      const prereqSteps = await db
        .select({
          code: programmeJourneyStep.code,
          status: programmeJourneyStep.status,
        })
        .from(programmeJourneyStep)
        .where(
          and(
            eq(programmeJourneyStep.journeyId, id),
            eq(programmeJourneyStep.orgId, ctx.orgId),
            inArray(programmeJourneyStep.code, prereqs),
          ),
        );
      const stateMap: Record<string, ProgrammeStepStatus> = {};
      for (const r of prereqSteps) {
        stateMap[r.code] = r.status as ProgrammeStepStatus;
      }
      const check = assertCanStartStep({
        prerequisiteStepCodes: prereqs,
        prerequisiteStepStates: stateMap,
      });
      if (!check.ok) {
        return Response.json(
          {
            error: "Prerequisites not met",
            reason: check.reason,
            unmetPrerequisites: check.unmetPrerequisites,
          },
          { status: 422 },
        );
      }
    }
  }

  // 3) in_progress → review: evidence count erfüllt?
  if (from === "in_progress" && to === "review") {
    const evidenceLinks = Array.isArray(step.evidenceLinks)
      ? (step.evidenceLinks as Array<{ type: string; id: string }>)
      : [];
    const check = assertCanReviewStep({
      requiredEvidenceCount: step.requiredEvidenceCount,
      evidenceLinks,
    });
    if (!check.ok) {
      return Response.json(
        {
          error: "Evidence requirement not met",
          reason: check.reason,
          evidenceProvided: check.evidenceProvided,
          evidenceRequired: check.evidenceRequired,
        },
        { status: 422 },
      );
    }
  }

  // Update durchführen
  const updateValues: Record<string, unknown> = {
    status: to,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };
  const now = new Date();
  if (to === "in_progress" && !step.startedAt) updateValues.startedAt = now;
  if (to === "completed") updateValues.completedAt = now;
  if (to === "skipped") {
    updateValues.skipReason = parsed.data.reason ?? null;
    updateValues.completedAt = now;
  }
  if (to === "blocked") updateValues.blockReason = parsed.data.reason ?? null;
  if (parsed.data.completionNotes) {
    updateValues.completionNotes = parsed.data.completionNotes;
  }

  const [updated] = await withAuditContext(ctx, async () =>
    db
      .update(programmeJourneyStep)
      .set(updateValues)
      .where(eq(programmeJourneyStep.id, stepId))
      .returning(),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    stepId,
    eventType: "step.transition",
    actorId: ctx.userId,
    payload: { from, to, reason: parsed.data.reason ?? null },
  });

  // Health-Recompute
  await recomputeJourneyHealth({
    orgId: ctx.orgId,
    journeyId: id,
    persist: true,
  });

  return Response.json({ data: updated });
}
