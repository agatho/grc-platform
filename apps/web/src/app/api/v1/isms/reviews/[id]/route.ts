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
    .where(
      and(eq(managementReview.id, id), eq(managementReview.orgId, ctx.orgId)),
    );

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
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const [existing] = await db
    .select()
    .from(managementReview)
    .where(
      and(eq(managementReview.id, id), eq(managementReview.orgId, ctx.orgId)),
    );

  if (!existing) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  const data = parsed.data;

  // Cockpit (0369): Status-Übergänge server-seitig erzwingen.
  // planned → in_progress → completed; cancelled aus planned/in_progress.
  // completed/cancelled sind terminal — das Review ist dann read-only.
  const VALID_TRANSITIONS: Record<string, string[]> = {
    planned: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  if (existing.status === "completed" || existing.status === "cancelled") {
    return Response.json(
      {
        error: "Review is read-only",
        detail: `Review has status '${existing.status}' and can no longer be modified.`,
      },
      { status: 422 },
    );
  }

  if (data.status !== undefined && data.status !== existing.status) {
    const allowed = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(data.status)) {
      return Response.json(
        {
          error: "Invalid status transition",
          from: existing.status,
          to: data.status,
          allowed,
        },
        { status: 422 },
      );
    }
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.reviewDate !== undefined) updates.reviewDate = data.reviewDate;
    if (data.status !== undefined) updates.status = data.status;
    if (data.chairId !== undefined) updates.chairId = data.chairId;
    if (data.participantIds !== undefined)
      updates.participantIds = data.participantIds;
    if (data.changesInContext !== undefined)
      updates.changesInContext = data.changesInContext;
    if (data.performanceFeedback !== undefined)
      updates.performanceFeedback = data.performanceFeedback;
    if (data.riskAssessmentResults !== undefined)
      updates.riskAssessmentResults = data.riskAssessmentResults;
    if (data.auditResults !== undefined)
      updates.auditResults = data.auditResults;
    if (data.improvementOpportunities !== undefined)
      updates.improvementOpportunities = data.improvementOpportunities;
    if (data.decisions !== undefined) updates.decisions = data.decisions;
    if (data.actionItems !== undefined) updates.actionItems = data.actionItems;
    if (data.minutes !== undefined) updates.minutes = data.minutes;
    if (data.nextReviewDate !== undefined)
      updates.nextReviewDate = data.nextReviewDate;
    if (data.periodStart !== undefined) updates.periodStart = data.periodStart;
    if (data.periodEnd !== undefined) updates.periodEnd = data.periodEnd;

    // Abschluss-Zeitstempel beim Übergang → completed
    if (data.status === "completed" && existing.status !== "completed") {
      updates.completedAt = new Date();
    }

    const [updated] = await tx
      .update(managementReview)
      .set(updates)
      .where(eq(managementReview.id, id))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
}
