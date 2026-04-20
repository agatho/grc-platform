import { db, assessmentRun } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const updateAssessmentSchema = z.object({
  name: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.string().max(30).optional(),
  scopeType: z.string().max(50).optional(),
  scopeFilter: z.record(z.string(), z.unknown()).optional(),
  leadAssessorId: z.string().uuid().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

const VALID_ASSESSMENT_TRANSITIONS: Record<string, string[]> = {
  planning: ["in_progress", "cancelled"],
  in_progress: ["review", "cancelled"],
  review: ["completed", "in_progress"],
  completed: [],
  cancelled: ["planning"],
};

// GET /api/v1/isms/assessments/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(assessmentRun)
    .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Assessment not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/isms/assessments/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const parsed = updateAssessmentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const body = parsed.data;

  const [existing] = await db
    .select()
    .from(assessmentRun)
    .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Validate status transition if status is changing
  if (body.status && body.status !== existing.status) {
    const allowed = VALID_ASSESSMENT_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(body.status)) {
      return Response.json(
        {
          error: `Invalid transition from '${existing.status}' to '${body.status}'`,
        },
        { status: 400 },
      );
    }
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "completed") updates.completedAt = new Date();
    }
    if (body.scopeType !== undefined) updates.scopeType = body.scopeType;
    if (body.scopeFilter !== undefined) updates.scopeFilter = body.scopeFilter;
    if (body.leadAssessorId !== undefined)
      updates.leadAssessorId = body.leadAssessorId;
    if (body.periodStart !== undefined) updates.periodStart = body.periodStart;
    if (body.periodEnd !== undefined) updates.periodEnd = body.periodEnd;

    const [updated] = await tx
      .update(assessmentRun)
      .set(updates)
      .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
}

// DELETE /api/v1/isms/assessments/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(assessmentRun)
    .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Assessment not found" }, { status: 404 });
  }

  if (existing.status === "completed") {
    return Response.json(
      { error: "Cannot delete a completed assessment" },
      { status: 400 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(assessmentRun)
      .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));
  });

  return Response.json({ success: true });
}
