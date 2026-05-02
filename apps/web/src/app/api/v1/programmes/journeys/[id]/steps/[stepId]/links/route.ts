// GET  /api/v1/programmes/journeys/[id]/steps/[stepId]/links
// POST /api/v1/programmes/journeys/[id]/steps/[stepId]/links
//
// Verknüpfungen vom Schritt zu Risiken / Kontrollen / Dokumenten / Assets etc.

import {
  db,
  programmeStepLink,
  programmeJourney,
  programmeJourneyStep,
  programmeJourneyEvent,
  PROGRAMME_LINK_KIND_VALUES,
  PROGRAMME_LINK_TYPE_VALUES,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull, desc } from "drizzle-orm";
import { z } from "zod";

const createLinkSchema = z
  .object({
    targetKind: z.enum(PROGRAMME_LINK_KIND_VALUES),
    targetId: z.string().uuid().optional(),
    targetLabel: z.string().min(1).max(300),
    targetUrl: z.string().max(1000).optional(),
    linkType: z.enum(PROGRAMME_LINK_TYPE_VALUES).default("related"),
    notes: z.string().max(5000).optional(),
  })
  .refine(
    (d) => (d.targetKind === "url" ? !!d.targetUrl : true),
    { message: "targetUrl required when targetKind is 'url'" },
  );

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
    .from(programmeStepLink)
    .where(
      and(
        eq(programmeStepLink.journeyStepId, stepId),
        eq(programmeStepLink.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(programmeStepLink.createdAt));

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
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [created] = await withAuditContext(ctx, async () =>
    db
      .insert(programmeStepLink)
      .values({
        orgId: ctx.orgId,
        journeyStepId: stepId,
        targetKind: parsed.data.targetKind,
        targetId: parsed.data.targetId ?? null,
        targetLabel: parsed.data.targetLabel,
        targetUrl: parsed.data.targetUrl ?? null,
        linkType: parsed.data.linkType,
        notes: parsed.data.notes ?? null,
        createdBy: ctx.userId,
      })
      .returning(),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    stepId,
    eventType: "link.created",
    actorId: ctx.userId,
    payload: {
      linkId: created.id,
      targetKind: created.targetKind,
      targetLabel: created.targetLabel,
    },
  });

  return Response.json({ data: created }, { status: 201 });
}
