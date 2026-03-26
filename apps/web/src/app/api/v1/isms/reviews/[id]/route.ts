import { db, managementReview } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateManagementReviewSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/isms/reviews/[id]
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
    .from(managementReview)
    .where(and(eq(managementReview.id, id), eq(managementReview.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/isms/reviews/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();

  const parsed = updateManagementReviewSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(managementReview)
    .where(and(eq(managementReview.id, id), eq(managementReview.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  const data = parsed.data;
  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.reviewDate !== undefined) updates.reviewDate = data.reviewDate;
    if (data.status !== undefined) updates.status = data.status;
    if (data.chairId !== undefined) updates.chairId = data.chairId;
    if (data.participantIds !== undefined) updates.participantIds = data.participantIds;
    if (data.changesInContext !== undefined) updates.changesInContext = data.changesInContext;
    if (data.performanceFeedback !== undefined) updates.performanceFeedback = data.performanceFeedback;
    if (data.riskAssessmentResults !== undefined) updates.riskAssessmentResults = data.riskAssessmentResults;
    if (data.auditResults !== undefined) updates.auditResults = data.auditResults;
    if (data.improvementOpportunities !== undefined) updates.improvementOpportunities = data.improvementOpportunities;
    if (data.decisions !== undefined) updates.decisions = data.decisions;
    if (data.actionItems !== undefined) updates.actionItems = data.actionItems;
    if (data.minutes !== undefined) updates.minutes = data.minutes;
    if (data.nextReviewDate !== undefined) updates.nextReviewDate = data.nextReviewDate;

    const [updated] = await tx
      .update(managementReview)
      .set(updates)
      .where(eq(managementReview.id, id))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
}
