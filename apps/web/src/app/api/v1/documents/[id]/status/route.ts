import {
  db,
  document,
  workItem,
  notification,
} from "@grc/db";
import { documentStatusTransitionSchema, VALID_DOCUMENT_TRANSITIONS } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// Map document status to work item status
const DOCUMENT_TO_WORK_ITEM_STATUS: Record<string, string> = {
  draft: "draft",
  in_review: "in_review",
  approved: "in_approval",
  published: "active",
  archived: "obsolete",
  expired: "obsolete",
};

// PUT /api/v1/documents/:id/status — Lifecycle transition
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = documentStatusTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const targetStatus = body.data.status;
  const currentStatus = existing.status;

  // Validate transition
  const allowed = VALID_DOCUMENT_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    return Response.json(
      {
        error: `Invalid transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${(allowed ?? []).join(", ")}`,
      },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      status: targetStatus,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    // Set publishedAt when publishing
    if (targetStatus === "published") {
      updateValues.publishedAt = new Date();
    }

    const [row] = await tx
      .update(document)
      .set(updateValues)
      .where(
        and(
          eq(document.id, id),
          eq(document.orgId, ctx.orgId),
          isNull(document.deletedAt),
        ),
      )
      .returning();

    // Sync work item status
    if (existing.workItemId) {
      const wiStatus = DOCUMENT_TO_WORK_ITEM_STATUS[targetStatus];
      if (wiStatus) {
        await tx
          .update(workItem)
          .set({
            status: wiStatus as typeof workItem.$inferSelect.status,
            updatedBy: ctx.userId,
            updatedAt: new Date(),
          })
          .where(eq(workItem.id, existing.workItemId));
      }
    }

    // Notify owner
    if (existing.ownerId && existing.ownerId !== ctx.userId) {
      await tx.insert(notification).values({
        userId: existing.ownerId,
        orgId: ctx.orgId,
        type: "status_change",
        entityType: "document",
        entityId: id,
        title: `Document status changed: ${existing.title}`,
        message: `Status changed from '${currentStatus}' to '${targetStatus}'.`,
        channel: "both",
        templateKey: "document_status_changed",
        templateData: {
          documentId: id,
          documentTitle: existing.title,
          fromStatus: currentStatus,
          toStatus: targetStatus,
        },
        createdBy: ctx.userId,
      });
    }

    // Notify reviewer when moving to in_review
    if (targetStatus === "in_review" && existing.reviewerId && existing.reviewerId !== ctx.userId) {
      await tx.insert(notification).values({
        userId: existing.reviewerId,
        orgId: ctx.orgId,
        type: "task_assigned",
        entityType: "document",
        entityId: id,
        title: `Document awaiting your review: ${existing.title}`,
        message: `The document '${existing.title}' has been submitted for review.`,
        channel: "both",
        templateKey: "document_review_requested",
        templateData: {
          documentId: id,
          documentTitle: existing.title,
          submittedBy: ctx.userId,
        },
        createdBy: ctx.userId,
      });
    }

    // Notify approver when moving to approved
    if (targetStatus === "approved" && existing.approverId && existing.approverId !== ctx.userId) {
      await tx.insert(notification).values({
        userId: existing.approverId,
        orgId: ctx.orgId,
        type: "task_assigned",
        entityType: "document",
        entityId: id,
        title: `Document approved: ${existing.title}`,
        message: `The document '${existing.title}' has been approved and is ready for publishing.`,
        channel: "both",
        templateKey: "document_approved",
        templateData: {
          documentId: id,
          documentTitle: existing.title,
          approvedBy: ctx.userId,
        },
        createdBy: ctx.userId,
      });
    }

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
