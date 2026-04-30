// GET    /api/v1/programmes/journeys/[id]
// PATCH  /api/v1/programmes/journeys/[id]
// DELETE /api/v1/programmes/journeys/[id]   (soft delete, admin only)

import {
  db,
  programmeJourney,
  programmeJourneyEvent,
  programmeJourneyPhase,
  programmeJourneyStep,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, asc, isNull } from "drizzle-orm";
import { updateJourneySchema } from "@grc/shared";

async function loadJourney(id: string, orgId: string) {
  const [row] = await db
    .select()
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, id),
        eq(programmeJourney.orgId, orgId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const journey = await loadJourney(id, ctx.orgId);
  if (!journey) {
    return Response.json({ error: "Journey not found" }, { status: 404 });
  }

  const [phases, steps] = await Promise.all([
    db
      .select()
      .from(programmeJourneyPhase)
      .where(eq(programmeJourneyPhase.journeyId, id))
      .orderBy(asc(programmeJourneyPhase.sequence)),
    db
      .select()
      .from(programmeJourneyStep)
      .where(eq(programmeJourneyStep.journeyId, id))
      .orderBy(asc(programmeJourneyStep.sequence)),
  ]);

  return Response.json({
    data: { journey, phases, steps },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const journey = await loadJourney(id, ctx.orgId);
  if (!journey) {
    return Response.json({ error: "Journey not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateJourneySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const updateData: Record<string, unknown> = {
    ...parsed.data,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  const [updated] = await withAuditContext(ctx, async () =>
    db
      .update(programmeJourney)
      .set(updateData)
      .where(eq(programmeJourney.id, id))
      .returning(),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    eventType: "journey.updated",
    actorId: ctx.userId,
    payload: { fields: Object.keys(parsed.data) },
  });

  return Response.json({ data: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const journey = await loadJourney(id, ctx.orgId);
  if (!journey) {
    return Response.json({ error: "Journey not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async () =>
    db
      .update(programmeJourney)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: ctx.userId })
      .where(eq(programmeJourney.id, id)),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    eventType: "journey.deleted",
    actorId: ctx.userId,
    payload: {},
  });

  return Response.json({ data: { id, deleted: true } });
}
