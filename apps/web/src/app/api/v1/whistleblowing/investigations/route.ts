import { db, wbInvestigation, wbInvestigationLog } from "@grc/db";
import { createInvestigationSchema, advanceInvestigationPhaseSchema, isValidInvestigationTransition } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/whistleblowing/investigations
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("whistleblowing", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const { limit, offset } = paginate(url.searchParams);
  const phase = url.searchParams.get("phase");

  const conditions = [eq(wbInvestigation.orgId, ctx.orgId)];
  if (phase) conditions.push(eq(wbInvestigation.phase, phase));

  const rows = await db.select().from(wbInvestigation)
    .where(and(...conditions))
    .orderBy(desc(wbInvestigation.createdAt))
    .limit(limit).offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
}

// POST /api/v1/whistleblowing/investigations — Start investigation from case
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("whistleblowing", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createInvestigationSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const created = await withAuditContext(ctx, async (tx) => {
    const [investigation] = await tx.insert(wbInvestigation).values({
      orgId: ctx.orgId,
      caseId: body.data.caseId,
      priority: body.data.priority,
    }).returning();

    // Log investigation creation
    await tx.insert(wbInvestigationLog).values({
      investigationId: investigation.id,
      activityType: "status_changed",
      description: "Investigation created in intake phase",
      performedBy: ctx.userId,
    });

    return investigation;
  });

  return Response.json({ data: created }, { status: 201 });
}

// PATCH /api/v1/whistleblowing/investigations — Advance phase
export async function PATCH(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("whistleblowing", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const investigationId = url.searchParams.get("id");
  if (!investigationId) return Response.json({ error: "id required" }, { status: 400 });

  const body = advanceInvestigationPhaseSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const [current] = await db.select().from(wbInvestigation)
    .where(and(eq(wbInvestigation.id, investigationId), eq(wbInvestigation.orgId, ctx.orgId)));
  if (!current) return Response.json({ error: "Investigation not found" }, { status: 404 });

  if (!isValidInvestigationTransition(current.phase, body.data.newPhase)) {
    return Response.json({ error: `Invalid transition from ${current.phase} to ${body.data.newPhase}` }, { status: 400 });
  }

  const phaseTimestamps: Record<string, Record<string, Date>> = {
    triage: { triageDate: new Date() },
    investigation: { investigationStart: new Date() },
    decision: { decisionDate: new Date() },
    resolution: { resolutionDate: new Date() },
    closed: { closedDate: new Date() },
  };

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx.update(wbInvestigation)
      .set({ phase: body.data.newPhase, ...phaseTimestamps[body.data.newPhase], updatedAt: new Date() })
      .where(eq(wbInvestigation.id, investigationId))
      .returning();

    await tx.insert(wbInvestigationLog).values({
      investigationId: investigationId,
      activityType: "status_changed",
      description: `Phase advanced from ${current.phase} to ${body.data.newPhase}. ${body.data.justification || ""}`,
      performedBy: ctx.userId,
    });

    return row;
  });

  return Response.json({ data: updated });
}
