import { db, maturityAssessment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createMaturityAssessmentSchema,
  listMaturityAssessmentsQuerySchema,
} from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/maturity/assessments
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listMaturityAssessmentsQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions = [eq(maturityAssessment.orgId, ctx.orgId)];
  if (query.moduleKey)
    conditions.push(eq(maturityAssessment.moduleKey, query.moduleKey));
  if (query.status)
    conditions.push(eq(maturityAssessment.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(maturityAssessment)
      .where(and(...conditions))
      .orderBy(desc(maturityAssessment.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(maturityAssessment)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
});
// POST /api/v1/maturity/assessments
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createMaturityAssessmentSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(maturityAssessment)
      .values({
        orgId: ctx.orgId,
        moduleKey: body.moduleKey,
        assessorId: ctx.userId,
        periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
        criteriaScores: body.criteriaScores,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
