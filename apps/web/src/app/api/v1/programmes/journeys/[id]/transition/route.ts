// POST /api/v1/programmes/journeys/[id]/transition
// Manueller Status-Übergang einer Journey (planned/active/archived/completed).

import { db, programmeJourney, programmeJourneyEvent } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull } from "drizzle-orm";
import {
  journeyTransitionSchema,
  validateJourneyTransition,
  type ProgrammeJourneyStatus,
} from "@grc/shared";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = journeyTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

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

  const from = journey.status as ProgrammeJourneyStatus;
  const to = parsed.data.to;
  const trans = validateJourneyTransition({ from, to });
  if (!trans.ok) {
    return Response.json(
      { error: "Invalid transition", reason: trans.reason, from, to },
      { status: 422 },
    );
  }

  const updateValues: Record<string, unknown> = {
    status: to,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };
  if (to === "active" && !journey.startedAt) {
    updateValues.startedAt = new Date().toISOString().slice(0, 10);
  }
  if (to === "completed") {
    updateValues.actualCompletionDate = new Date().toISOString().slice(0, 10);
  }
  if (to === "archived") {
    updateValues.archivedAt = new Date();
  }

  const [updated] = await withAuditContext(ctx, async () =>
    db
      .update(programmeJourney)
      .set(updateValues)
      .where(eq(programmeJourney.id, id))
      .returning(),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    eventType: "journey.transition",
    actorId: ctx.userId,
    payload: { from, to, reason: parsed.data.reason ?? null },
  });

  return Response.json({ data: updated });
}
