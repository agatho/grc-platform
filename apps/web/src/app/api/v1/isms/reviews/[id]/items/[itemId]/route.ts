// PUT/DELETE /api/v1/isms/reviews/[id]/items/[itemId]
//
// Mutationen einzelner Review-Punkte. Abgeschlossene (completed) und
// abgebrochene (cancelled) Reviews sind read-only — 422.

import { db, managementReview, managementReviewItem, workItem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateManagementReviewItemSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

async function loadReviewAndItem(reviewId: string, itemId: string, orgId: string) {
  const reviewRows = await db
    .select({ id: managementReview.id, status: managementReview.status })
    .from(managementReview)
    .where(
      and(
        eq(managementReview.id, reviewId),
        eq(managementReview.orgId, orgId),
      ),
    );
  const review = reviewRows[0] ?? null;
  if (!review) return { review: null, item: null };

  const itemRows = await db
    .select()
    .from(managementReviewItem)
    .where(
      and(
        eq(managementReviewItem.id, itemId),
        eq(managementReviewItem.reviewId, reviewId),
        eq(managementReviewItem.orgId, orgId),
      ),
    );
  return { review, item: itemRows[0] ?? null };
}

function reviewReadOnlyResponse(status: string): Response {
  return Response.json(
    {
      error: "Review is read-only",
      detail: `Review has status '${status}' — items can no longer be modified.`,
    },
    { status: 422 },
  );
}

// PUT /api/v1/isms/reviews/[id]/items/[itemId]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, itemId } = await params;

  const body = await req.json();
  const parsed = updateManagementReviewItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { review, item } = await loadReviewAndItem(id, itemId, ctx.orgId);
  if (!review || !item) {
    return Response.json({ error: "Review item not found" }, { status: 404 });
  }
  if (review.status === "completed" || review.status === "cancelled") {
    return reviewReadOnlyResponse(review.status);
  }

  const data = parsed.data;

  const updated = await withAuditContext(ctx, async (tx) => {
    let actionWorkItemId = item.actionWorkItemId;
    let actionElementId: string | null = null;

    // Nachträglich eine Maßnahme anlegen (nur wenn noch keine verlinkt ist)
    if (data.action && !actionWorkItemId) {
      const [wi] = await tx
        .insert(workItem)
        .values({
          orgId: ctx.orgId,
          typeKey: "management_review_action",
          name: data.action.title,
          status: "draft",
          responsibleId: data.action.responsibleId ?? null,
          dueDate: data.action.dueDate ? new Date(data.action.dueDate) : null,
          grcPerspective: ["isms"],
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();
      actionWorkItemId = wi.id;
      actionElementId = wi.elementId;
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: ctx.userId,
      actionWorkItemId,
    };
    if (data.category !== undefined) updates.category = data.category;
    if (data.content !== undefined) updates.content = data.content;
    if (data.decision !== undefined) updates.decision = data.decision;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;

    const [row] = await tx
      .update(managementReviewItem)
      .set(updates)
      .where(eq(managementReviewItem.id, itemId))
      .returning();

    return { ...row, actionElementId };
  });

  return Response.json({ data: updated });
}

// DELETE /api/v1/isms/reviews/[id]/items/[itemId]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, itemId } = await params;

  const { review, item } = await loadReviewAndItem(id, itemId, ctx.orgId);
  if (!review || !item) {
    return Response.json({ error: "Review item not found" }, { status: 404 });
  }
  if (review.status === "completed" || review.status === "cancelled") {
    return reviewReadOnlyResponse(review.status);
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(managementReviewItem)
      .where(eq(managementReviewItem.id, itemId));
  });

  return Response.json({ data: { id: itemId, deleted: true } });
}
