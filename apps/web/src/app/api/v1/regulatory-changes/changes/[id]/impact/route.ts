import { db, regulatoryImpactAssessment } from "@grc/db";
import {
  createImpactAssessmentSchema,
  updateImpactAssessmentSchema,
  impactAssessmentQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/regulatory-changes/changes/:id/impact — Create impact assessment
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id: changeId } = await params;
  const body = createImpactAssessmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(regulatoryImpactAssessment)
      .values({
        changeId,
        orgId: ctx.orgId,
        impactLevel: body.data.impactLevel,
        impactAreas: body.data.impactAreas ?? [],
        requiredActions: body.data.requiredActions ?? [],
        estimatedEffort: body.data.estimatedEffort,
        complianceDeadline: body.data.complianceDeadline,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
// GET /api/v1/regulatory-changes/changes/:id/impact — List assessments for change
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { id: changeId } = await params;

  const assessments = await db
    .select()
    .from(regulatoryImpactAssessment)
    .where(
      and(
        eq(regulatoryImpactAssessment.changeId, changeId),
        eq(regulatoryImpactAssessment.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(regulatoryImpactAssessment.createdAt));

  return Response.json({ data: assessments });
});
