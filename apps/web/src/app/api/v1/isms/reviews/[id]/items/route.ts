// GET/POST /api/v1/isms/reviews/[id]/items
//
// Protokoll-Punkte des Management-Review-Cockpits (ISO 27001 9.3.3):
// Kategorie + Feststellung + Beschluss + optionale Maßnahme. Eine
// Maßnahme legt ein work_item (typeKey management_review_action) an
// und verlinkt es — der Maßnahmen-Status ist damit im nächsten Review
// als 9.3.2 (a)-Input nachverfolgbar.
//
// Abgeschlossene Reviews (status completed, sowie cancelled) sind
// read-only: jede Item-Mutation liefert 422.

import { db, managementReview, managementReviewItem, workItem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createManagementReviewItemSchema } from "@grc/shared";
import { eq, and, asc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type ReviewRow = { id: string; status: string };

async function loadReview(
  reviewId: string,
  orgId: string,
): Promise<ReviewRow | null> {
  const rows = await db
    .select({ id: managementReview.id, status: managementReview.status })
    .from(managementReview)
    .where(
      and(eq(managementReview.id, reviewId), eq(managementReview.orgId, orgId)),
    );
  return rows[0] ?? null;
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

// GET /api/v1/isms/reviews/[id]/items
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const review = await loadReview(id, ctx.orgId);
  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  const items = await db
    .select({
      id: managementReviewItem.id,
      orgId: managementReviewItem.orgId,
      reviewId: managementReviewItem.reviewId,
      category: managementReviewItem.category,
      content: managementReviewItem.content,
      decision: managementReviewItem.decision,
      actionWorkItemId: managementReviewItem.actionWorkItemId,
      sortOrder: managementReviewItem.sortOrder,
      createdAt: managementReviewItem.createdAt,
      updatedAt: managementReviewItem.updatedAt,
      actionElementId: workItem.elementId,
      actionName: workItem.name,
      actionStatus: workItem.status,
      actionDueDate: workItem.dueDate,
    })
    .from(managementReviewItem)
    .leftJoin(workItem, eq(managementReviewItem.actionWorkItemId, workItem.id))
    .where(
      and(
        eq(managementReviewItem.orgId, ctx.orgId),
        eq(managementReviewItem.reviewId, id),
      ),
    )
    .orderBy(
      asc(managementReviewItem.sortOrder),
      asc(managementReviewItem.createdAt),
    );

  return Response.json({ data: items });
}

// POST /api/v1/isms/reviews/[id]/items
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
  const parsed = createManagementReviewItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const review = await loadReview(id, ctx.orgId);
  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }
  if (review.status === "completed" || review.status === "cancelled") {
    return reviewReadOnlyResponse(review.status);
  }

  const data = parsed.data;

  const created = await withAuditContext(ctx, async (tx) => {
    let actionWorkItemId: string | null = null;
    let actionElementId: string | null = null;

    if (data.action) {
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

    // Default-sortOrder: ans Ende der Liste
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxRows = await tx
        .select({
          max: sql<number>`coalesce(max(${managementReviewItem.sortOrder}), -1)::int`,
        })
        .from(managementReviewItem)
        .where(
          and(
            eq(managementReviewItem.orgId, ctx.orgId),
            eq(managementReviewItem.reviewId, id),
          ),
        );
      sortOrder = (maxRows[0]?.max ?? -1) + 1;
    }

    const [row] = await tx
      .insert(managementReviewItem)
      .values({
        orgId: ctx.orgId,
        reviewId: id,
        category: data.category,
        content: data.content,
        decision: data.decision ?? null,
        actionWorkItemId,
        sortOrder,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return { ...row, actionElementId };
  });

  return Response.json({ data: created }, { status: 201 });
}
