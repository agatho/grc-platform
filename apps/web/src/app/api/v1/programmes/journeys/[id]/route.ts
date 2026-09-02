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
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

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

export const GET = withErrorHandler(async function GET(
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
});
export const PATCH = withErrorHandler(async function PATCH(
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
});
export const DELETE = withErrorHandler(async function DELETE(
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
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
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
});
