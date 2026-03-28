import { db, regulatoryImpactAssessment } from "@grc/db";
import { createImpactAssessmentSchema, updateImpactAssessmentSchema, impactAssessmentQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/regulatory-changes/changes/:id/impact — Create impact assessment
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id: changeId } = await params;
  const body = createImpactAssessmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(regulatoryImpactAssessment)
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
}

// GET /api/v1/regulatory-changes/changes/:id/impact — List assessments for change
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "dpo", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { id: changeId } = await params;

  const assessments = await db.select().from(regulatoryImpactAssessment)
    .where(and(
      eq(regulatoryImpactAssessment.changeId, changeId),
      eq(regulatoryImpactAssessment.orgId, ctx.orgId),
    ))
    .orderBy(desc(regulatoryImpactAssessment.createdAt));

  return Response.json({ data: assessments });
}
