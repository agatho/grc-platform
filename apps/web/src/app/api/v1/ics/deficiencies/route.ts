import { db, controlDeficiency } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";
import { createDeficiencySchema, updateDeficiencyStatusSchema, isValidDeficiencyTransition } from "@grc/shared";

// GET /api/v1/ics/deficiencies — List deficiencies
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const conditions = [eq(controlDeficiency.orgId, ctx.orgId)];
  const status = searchParams.get("status");
  if (status) conditions.push(eq(controlDeficiency.remediationStatus, status));
  const classification = searchParams.get("classification");
  if (classification) conditions.push(eq(controlDeficiency.classification, classification));

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(controlDeficiency).where(where)
      .orderBy(desc(controlDeficiency.createdAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(controlDeficiency).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/ics/deficiencies — Create deficiency
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createDeficiencySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [item] = await tx.insert(controlDeficiency).values({
      orgId: ctx.orgId,
      createdBy: ctx.userId,
      ...body.data,
    }).returning();
    return item;
  });

  return Response.json({ data: created }, { status: 201 });
}

// PATCH /api/v1/ics/deficiencies — Update deficiency status (state machine)
export async function PATCH(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, ...statusData } = await req.json();
  const body = updateDeficiencyStatusSchema.safeParse(statusData);
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Fetch current deficiency
  const [current] = await db.select().from(controlDeficiency)
    .where(and(eq(controlDeficiency.id, id), eq(controlDeficiency.orgId, ctx.orgId)));
  if (!current) {
    return Response.json({ error: "Deficiency not found" }, { status: 404 });
  }

  // Validate state transition
  if (!isValidDeficiencyTransition(current.remediationStatus, body.data.remediationStatus)) {
    return Response.json({
      error: `Invalid transition from '${current.remediationStatus}' to '${body.data.remediationStatus}'`,
    }, { status: 422 });
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateData: Record<string, unknown> = {
      remediationStatus: body.data.remediationStatus,
      updatedAt: new Date(),
    };
    if (body.data.remediationStatus === "closed") updateData.closedAt = new Date();
    if (body.data.retestDate) updateData.retestDate = body.data.retestDate;
    if (body.data.retestResult) {
      updateData.retestResult = body.data.retestResult;
      updateData.retestBy = ctx.userId;
    }
    const [item] = await tx.update(controlDeficiency).set(updateData)
      .where(eq(controlDeficiency.id, id)).returning();
    return item;
  });

  return Response.json({ data: updated });
}
