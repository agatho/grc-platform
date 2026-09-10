import { db, assessmentRiskEval, riskDecisionEnum } from "@grc/db";
import { requireModule } from "@grc/auth";
import { submitRiskEvalSchema } from "@grc/shared";
import { parseQueryParams } from "@/lib/query-schema";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/assessments/[id]/risk-evaluations
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  // #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
  // against a schema instead of being read as `string | null` and cast
  // with `as <enum>`. An unknown filter value used to reach Postgres and
  // surface as a 500 (`invalid input value for enum …`); it is a 422 now,
  // and free-text search terms are length-bounded.
  const riskEvaluationListQuerySchema = z.object({
    decision: z.enum(riskDecisionEnum.enumValues).optional(),
  });

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(riskEvaluationListQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const decisionFilter = q.data.decision ?? null;

  const conditions: ReturnType<typeof eq>[] = [
    eq(assessmentRiskEval.orgId, ctx.orgId),
    eq(assessmentRiskEval.assessmentRunId, id),
  ];
  if (decisionFilter) {
    conditions.push(
      eq(
        assessmentRiskEval.decision,
        decisionFilter as
          "accept" | "mitigate" | "transfer" | "avoid" | "pending",
      ),
    );
  }

  const rows = await db
    .select()
    .from(assessmentRiskEval)
    .where(and(...conditions))
    .orderBy(desc(assessmentRiskEval.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(and(...conditions));

  return paginatedResponse(rows, total, page, limit);
});
// POST /api/v1/isms/assessments/[id]/risk-evaluations
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();

  const parsed = submitRiskEvalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    // Upsert: check if eval for same run+scenario exists
    const [existing] = await tx
      .select()
      .from(assessmentRiskEval)
      .where(
        and(
          eq(assessmentRiskEval.assessmentRunId, id),
          eq(assessmentRiskEval.riskScenarioId, data.riskScenarioId),
          eq(assessmentRiskEval.orgId, ctx.orgId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(assessmentRiskEval)
        .set({
          residualLikelihood: data.residualLikelihood ?? null,
          residualImpact: data.residualImpact ?? null,
          decision: data.decision,
          justification: data.justification ?? null,
          evaluatedBy: ctx.userId,
          evaluatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(assessmentRiskEval.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(assessmentRiskEval)
      .values({
        orgId: ctx.orgId,
        assessmentRunId: id,
        riskScenarioId: data.riskScenarioId,
        residualLikelihood: data.residualLikelihood ?? null,
        residualImpact: data.residualImpact ?? null,
        decision: data.decision,
        justification: data.justification ?? null,
        evaluatedBy: ctx.userId,
        evaluatedAt: new Date(),
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
