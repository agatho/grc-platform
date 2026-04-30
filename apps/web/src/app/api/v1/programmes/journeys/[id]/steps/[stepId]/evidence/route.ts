// POST   /api/v1/programmes/journeys/[id]/steps/[stepId]/evidence
// DELETE /api/v1/programmes/journeys/[id]/steps/[stepId]/evidence?index=N
//
// Evidence-Links eines Schritts verwalten (Append-Only mit Index-basiertem Remove).

import {
  db,
  programmeJourney,
  programmeJourneyEvent,
  programmeJourneyStep,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull } from "drizzle-orm";
import { addEvidenceSchema, removeEvidenceSchema } from "@grc/shared";

async function loadJourneyAndStep(
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
  const [step] = await db
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
  return step ?? null;
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
  const step = await loadJourneyAndStep(id, stepId, ctx.orgId);
  if (!step) return Response.json({ error: "Step not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = addEvidenceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const links = Array.isArray(step.evidenceLinks)
    ? (step.evidenceLinks as Array<Record<string, unknown>>)
    : [];
  const newLinks = [...links, parsed.data];

  const [updated] = await withAuditContext(ctx, async () =>
    db
      .update(programmeJourneyStep)
      .set({
        evidenceLinks: newLinks,
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
    eventType: "step.evidence_added",
    actorId: ctx.userId,
    payload: { evidenceType: parsed.data.type },
  });

  return Response.json({ data: updated }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;
  const step = await loadJourneyAndStep(id, stepId, ctx.orgId);
  if (!step) return Response.json({ error: "Step not found" }, { status: 404 });

  const url = new URL(req.url);
  const indexRaw = url.searchParams.get("index");
  const parsed = removeEvidenceSchema.safeParse({
    index: indexRaw != null ? Number(indexRaw) : -1,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Index parameter required" },
      { status: 422 },
    );
  }

  const links = Array.isArray(step.evidenceLinks)
    ? (step.evidenceLinks as Array<Record<string, unknown>>)
    : [];
  if (parsed.data.index >= links.length) {
    return Response.json(
      { error: "Index out of range" },
      { status: 422 },
    );
  }
  const newLinks = links.filter((_, i) => i !== parsed.data.index);

  const [updated] = await withAuditContext(ctx, async () =>
    db
      .update(programmeJourneyStep)
      .set({
        evidenceLinks: newLinks,
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
    eventType: "step.evidence_removed",
    actorId: ctx.userId,
    payload: { index: parsed.data.index },
  });

  return Response.json({ data: updated });
}
