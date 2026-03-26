import { db, assessmentRiskEval } from "@grc/db";
import { requireModule } from "@grc/auth";
import { submitRiskEvalSchema } from "@grc/shared";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/isms/assessments/[id]/risk-evaluations
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
  const decisionFilter = searchParams.get("decision");

  const conditions: ReturnType<typeof eq>[] = [
    eq(assessmentRiskEval.orgId, ctx.orgId),
    eq(assessmentRiskEval.assessmentRunId, id),
  ];
  if (decisionFilter) {
    conditions.push(eq(assessmentRiskEval.decision, decisionFilter as "accept" | "mitigate" | "transfer" | "avoid" | "pending"));
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
}

// POST /api/v1/isms/assessments/[id]/risk-evaluations
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

  const parsed = submitRiskEvalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
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
}
