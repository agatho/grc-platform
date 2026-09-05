import { db, assessmentControlEval } from "@grc/db";
import { requireModule } from "@grc/auth";
import { submitControlEvalSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/assessments/[id]/evaluations/[evalId]
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; evalId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, evalId } = await params;

  const [row] = await db
    .select()
    .from(assessmentControlEval)
    .where(
      and(
        eq(assessmentControlEval.id, evalId),
        eq(assessmentControlEval.assessmentRunId, id),
        eq(assessmentControlEval.orgId, ctx.orgId),
      ),
    );

  if (!row) {
    return Response.json({ error: "Evaluation not found" }, { status: 404 });
  }

  return Response.json({ data: row });
});
// PUT /api/v1/isms/assessments/[id]/evaluations/[evalId]
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; evalId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, evalId } = await params;
  const body = await req.json();

  const parsed = submitControlEvalSchema.partial().safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const [existing] = await db
    .select()
    .from(assessmentControlEval)
    .where(
      and(
        eq(assessmentControlEval.id, evalId),
        eq(assessmentControlEval.assessmentRunId, id),
        eq(assessmentControlEval.orgId, ctx.orgId),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Evaluation not found" }, { status: 404 });
  }

  const data = parsed.data;
  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      assessedBy: ctx.userId,
      assessedAt: new Date(),
    };
    if (data.result !== undefined) updates.result = data.result;
    if (data.evidence !== undefined) updates.evidence = data.evidence;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.evidenceDocumentIds !== undefined)
      updates.evidenceDocumentIds = data.evidenceDocumentIds;
    if (data.currentMaturity !== undefined)
      updates.currentMaturity = data.currentMaturity;
    if (data.targetMaturity !== undefined)
      updates.targetMaturity = data.targetMaturity;

    const [updated] = await tx
      .update(assessmentControlEval)
      .set(updates)
      .where(eq(assessmentControlEval.id, evalId))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
});
