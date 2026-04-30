// GET   /api/v1/programmes/journeys/[id]/steps/[stepId]
// PATCH /api/v1/programmes/journeys/[id]/steps/[stepId]
//
// Detail eines Schritts und Update von Owner / Due-Date / Notes.

import {
  db,
  programmeJourney,
  programmeJourneyEvent,
  programmeJourneyStep,
  programmeTemplateStep,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull } from "drizzle-orm";
import { updateStepSchema } from "@grc/shared";

async function loadStep(
  journeyId: string,
  stepId: string,
  orgId: string,
) {
  const [journey] = await db
    .select({ id: programmeJourney.id })
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, journeyId),
        eq(programmeJourney.orgId, orgId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .limit(1);
  if (!journey) return null;
  const [row] = await db
    .select()
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.id, stepId),
        eq(programmeJourneyStep.journeyId, journeyId),
        eq(programmeJourneyStep.orgId, orgId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;
  const step = await loadStep(id, stepId, ctx.orgId);
  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  // Template-Daten ergänzen
  const [tplStep] = await db
    .select()
    .from(programmeTemplateStep)
    .where(eq(programmeTemplateStep.id, step.templateStepId))
    .limit(1);

  return Response.json({
    data: {
      step,
      template: tplStep ?? null,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;
  const step = await loadStep(id, stepId, ctx.orgId);
  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateStepSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await withAuditContext(ctx, async () =>
    db
      .update(programmeJourneyStep)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(programmeJourneyStep.id, stepId))
      .returning(),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    stepId,
    eventType: "step.updated",
    actorId: ctx.userId,
    payload: { fields: Object.keys(parsed.data) },
  });

  return Response.json({ data: updated });
}
