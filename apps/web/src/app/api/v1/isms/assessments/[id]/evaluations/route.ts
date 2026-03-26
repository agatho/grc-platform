import { db, assessmentControlEval, assessmentRun } from "@grc/db";
import { requireModule } from "@grc/auth";
import { submitControlEvalSchema } from "@grc/shared";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/isms/assessments/[id]/evaluations
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const { page, limit, offset, searchParams } = paginate(req);
  const resultFilter = searchParams.get("result");
  const assetId = searchParams.get("assetId");
  const controlId = searchParams.get("controlId");

  const conditions: ReturnType<typeof eq>[] = [
    eq(assessmentControlEval.orgId, ctx.orgId),
    eq(assessmentControlEval.assessmentRunId, id),
  ];
  if (resultFilter) {
    conditions.push(eq(assessmentControlEval.result, resultFilter as "effective" | "partially_effective" | "ineffective" | "not_applicable" | "not_evaluated"));
  }
  if (assetId) {
    conditions.push(eq(assessmentControlEval.assetId, assetId));
  }
  if (controlId) {
    conditions.push(eq(assessmentControlEval.controlId, controlId));
  }

  const rows = await db
    .select()
    .from(assessmentControlEval)
    .where(and(...conditions))
    .orderBy(desc(assessmentControlEval.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(assessmentControlEval)
    .where(and(...conditions));

  return paginatedResponse(rows, total, page, limit);
}

// POST /api/v1/isms/assessments/[id]/evaluations — single or bulk submit
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();

  // Support bulk: if body is array, validate each; else single
  const items = Array.isArray(body) ? body : [body];
  if (items.length > 100) {
    return Response.json({ error: "Maximum 100 evaluations per request" }, { status: 400 });
  }

  const parsed = items.map((item) => submitControlEvalSchema.safeParse(item));
  const errors = parsed
    .map((p, i) => (p.success ? null : { index: i, error: p.error.flatten() }))
    .filter(Boolean);
  if (errors.length > 0) {
    return Response.json({ error: "Validation failed", details: errors }, { status: 400 });
  }

  const validData = parsed
    .filter((p): p is { success: true; data: { controlId: string; assetId?: string; result: "effective" | "partially_effective" | "ineffective" | "not_applicable" | "not_evaluated"; evidence?: string; notes?: string; evidenceDocumentIds: string[]; currentMaturity?: number; targetMaturity?: number } } => p.success)
    .map((p) => p.data);

  const result = await withAuditContext(ctx, async (tx) => {
    const created = [];
    for (const data of validData) {
      // Upsert: if eval for same run+control+asset exists, update it
      const existingConditions = [
        eq(assessmentControlEval.assessmentRunId, id),
        eq(assessmentControlEval.controlId, data.controlId),
        eq(assessmentControlEval.orgId, ctx.orgId),
      ];

      const [existing] = await tx
        .select()
        .from(assessmentControlEval)
        .where(and(...existingConditions))
        .limit(1);

      if (existing && (!data.assetId || existing.assetId === data.assetId)) {
        const [updated] = await tx
          .update(assessmentControlEval)
          .set({
            result: data.result,
            evidence: data.evidence ?? null,
            notes: data.notes ?? null,
            evidenceDocumentIds: data.evidenceDocumentIds,
            currentMaturity: data.currentMaturity ?? null,
            targetMaturity: data.targetMaturity ?? null,
            assessedBy: ctx.userId,
            assessedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(assessmentControlEval.id, existing.id))
          .returning();
        created.push(updated);
      } else {
        const [inserted] = await tx
          .insert(assessmentControlEval)
          .values({
            orgId: ctx.orgId,
            assessmentRunId: id,
            controlId: data.controlId,
            assetId: data.assetId ?? null,
            result: data.result,
            evidence: data.evidence ?? null,
            notes: data.notes ?? null,
            evidenceDocumentIds: data.evidenceDocumentIds,
            currentMaturity: data.currentMaturity ?? null,
            targetMaturity: data.targetMaturity ?? null,
            assessedBy: ctx.userId,
            assessedAt: new Date(),
          })
          .returning();
        created.push(inserted);
      }
    }

    // Update completion stats on assessment run
    const [stats] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where result != 'not_evaluated')::int`,
      })
      .from(assessmentControlEval)
      .where(and(
        eq(assessmentControlEval.assessmentRunId, id),
        eq(assessmentControlEval.orgId, ctx.orgId),
      ));

    const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    await tx
      .update(assessmentRun)
      .set({
        completedEvaluations: stats.completed,
        totalEvaluations: stats.total,
        completionPercentage: pct,
        updatedAt: new Date(),
      })
      .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));

    return created;
  });

  return Response.json({ data: Array.isArray(body) ? result : result[0] }, { status: 201 });
}
