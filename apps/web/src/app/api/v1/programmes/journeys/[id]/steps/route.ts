// GET  /api/v1/programmes/journeys/[id]/steps  — Liste aller Schritte
// POST /api/v1/programmes/journeys/[id]/steps  — Custom-Step hinzufügen (Org-Anpassung)

import {
  db,
  programmeJourneyStep,
  programmeJourney,
  programmeJourneyPhase,
  programmeJourneyEvent,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { z } from "zod";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

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

  const url = new URL(req.url);
  const phaseFilter = url.searchParams.get("phaseId");
  const statusFilter = url.searchParams.get("status");

  const conditions = [
    eq(programmeJourneyStep.journeyId, id),
    eq(programmeJourneyStep.orgId, ctx.orgId),
  ];
  if (phaseFilter) {
    conditions.push(eq(programmeJourneyStep.phaseId, phaseFilter));
  }
  if (statusFilter) {
    conditions.push(eq(programmeJourneyStep.status, statusFilter as never));
  }

  const rows = await db
    .select()
    .from(programmeJourneyStep)
    .where(and(...conditions))
    .orderBy(asc(programmeJourneyStep.sequence));

  return Response.json({ data: rows });
}

const createCustomStepSchema = z.object({
  phaseId: z.string().uuid(),
  name: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),
  isoClause: z.string().max(50).optional(),
  defaultOwnerRole: z.string().max(50).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  isMilestone: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  requiredEvidenceCount: z.number().int().min(0).max(20).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [journey] = await db
    .select({ id: programmeJourney.id, templateId: programmeJourney.templateId })
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createCustomStepSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Validate phase belongs to journey
  const [phase] = await db
    .select({ id: programmeJourneyPhase.id })
    .from(programmeJourneyPhase)
    .where(
      and(
        eq(programmeJourneyPhase.id, parsed.data.phaseId),
        eq(programmeJourneyPhase.journeyId, id),
      ),
    )
    .limit(1);
  if (!phase) {
    return Response.json({ error: "Phase not in this journey" }, {
      status: 422,
    });
  }

  // Compute next sequence + unique custom code
  const [{ maxSeq }] = await db
    .select({
      maxSeq: sql<number>`coalesce(max(${programmeJourneyStep.sequence}), 0)::int`,
    })
    .from(programmeJourneyStep)
    .where(eq(programmeJourneyStep.journeyId, id));
  const nextSeq = (maxSeq ?? 0) + 1;
  const customCode = `CUSTOM-${Date.now().toString(36).toUpperCase()}`;

  // Find any existing template_step_id we can use as required FK target.
  // Custom steps have no template — but the column is NOT NULL. We pick the
  // first template_step_id from the journey's template as a sentinel.
  const [anyTemplateStep] = await db
    .select({ id: programmeJourneyStep.templateStepId })
    .from(programmeJourneyStep)
    .where(eq(programmeJourneyStep.journeyId, id))
    .limit(1);
  const templateStepIdSentinel = anyTemplateStep?.id;
  if (!templateStepIdSentinel) {
    return Response.json(
      { error: "Journey has no template steps to use as sentinel FK" },
      { status: 500 },
    );
  }

  const [created] = await withAuditContext(ctx, async () =>
    db
      .insert(programmeJourneyStep)
      .values({
        orgId: ctx.orgId,
        journeyId: id,
        phaseId: parsed.data.phaseId,
        templateStepId: templateStepIdSentinel,
        code: customCode,
        sequence: nextSeq,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        isoClause: parsed.data.isoClause ?? null,
        status: "pending",
        ownerId: parsed.data.ownerId ?? null,
        dueDate: parsed.data.dueDate ?? null,
        evidenceLinks: [],
        targetModuleLink: {},
        requiredEvidenceCount: parsed.data.requiredEvidenceCount ?? 0,
        isMilestone: parsed.data.isMilestone ?? false,
        isMandatory: parsed.data.isMandatory ?? false,
        metadata: { custom: true, addedByUserId: ctx.userId },
        updatedBy: ctx.userId,
      })
      .returning(),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    stepId: created.id,
    eventType: "step.custom_added",
    actorId: ctx.userId,
    payload: { name: created.name, phaseId: parsed.data.phaseId },
  });

  return Response.json({ data: created }, { status: 201 });
}
