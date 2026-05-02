// GET  /api/v1/programmes/journeys/[id]/steps/[stepId]/subtasks
// POST /api/v1/programmes/journeys/[id]/steps/[stepId]/subtasks
//
// Liste und Erzeugung von Subtasks pro Journey-Schritt.

import {
  db,
  programmeJourney,
  programmeJourneyStep,
  programmeJourneySubtask,
  programmeJourneyEvent,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull, asc } from "drizzle-orm";
import { z } from "zod";

const createSubtaskSchema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  deliverableType: z.string().max(80).optional(),
  isMandatory: z.boolean().optional(),
});

async function assertJourneyAndStep(
  journeyId: string,
  stepId: string,
  orgId: string,
): Promise<boolean> {
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
  if (!journey) return false;
  const [step] = await db
    .select({ id: programmeJourneyStep.id })
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.id, stepId),
        eq(programmeJourneyStep.journeyId, journeyId),
        eq(programmeJourneyStep.orgId, orgId),
      ),
    )
    .limit(1);
  return !!step;
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
  const ok = await assertJourneyAndStep(id, stepId, ctx.orgId);
  if (!ok) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(programmeJourneySubtask)
    .where(
      and(
        eq(programmeJourneySubtask.journeyStepId, stepId),
        eq(programmeJourneySubtask.orgId, ctx.orgId),
      ),
    )
    .orderBy(asc(programmeJourneySubtask.sequence));

  return Response.json({ data: rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;
  const ok = await assertJourneyAndStep(id, stepId, ctx.orgId);
  if (!ok) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSubtaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const existing = await db
    .select({ sequence: programmeJourneySubtask.sequence })
    .from(programmeJourneySubtask)
    .where(eq(programmeJourneySubtask.journeyStepId, stepId))
    .orderBy(asc(programmeJourneySubtask.sequence));
  const nextSequence =
    existing.length > 0
      ? Math.max(...existing.map((e) => e.sequence)) + 1
      : 1;

  const [created] = await withAuditContext(ctx, async () =>
    db
      .insert(programmeJourneySubtask)
      .values({
        orgId: ctx.orgId,
        journeyStepId: stepId,
        sequence: nextSequence,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        ownerId: parsed.data.ownerId ?? null,
        dueDate: parsed.data.dueDate ?? null,
        deliverableType: parsed.data.deliverableType ?? null,
        isMandatory: parsed.data.isMandatory ?? true,
        updatedBy: ctx.userId,
      })
      .returning(),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    stepId,
    eventType: "subtask.created",
    actorId: ctx.userId,
    payload: { subtaskId: created.id, title: created.title },
  });

  return Response.json({ data: created }, { status: 201 });
}
