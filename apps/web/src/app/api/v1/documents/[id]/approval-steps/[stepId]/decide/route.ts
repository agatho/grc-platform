import {
  db,
  document,
  documentApprovalStep,
  workItem,
  notification,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { decideDocumentApprovalStepSchema } from "@grc/shared";
import { eq, and, isNull, ne } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/documents/:id/approval-steps/:stepId/decide — Record a
// review/approval decision (D2). Only the step assignee (or an admin)
// may decide. All steps completed → document auto-approved; any
// rejection → document back to draft + notification.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "dpo",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;

  const [doc] = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const [step] = await db
    .select()
    .from(documentApprovalStep)
    .where(
      and(
        eq(documentApprovalStep.id, stepId),
        eq(documentApprovalStep.documentId, id),
        eq(documentApprovalStep.orgId, ctx.orgId),
      ),
    );

  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  if (step.status !== "pending") {
    return Response.json(
      { error: "Step has already been decided" },
      { status: 422 },
    );
  }

  // Only the assignee may decide their step (admins may unblock)
  const isAdmin = !!ctx.session.user.roles?.some(
    (r) => r.orgId === ctx.orgId && r.role === "admin",
  );
  if (step.assigneeUserId !== ctx.userId && !isAdmin) {
    return Response.json(
      { error: "Only the assigned user can decide this step" },
      { status: 403 },
    );
  }

  const body = decideDocumentApprovalStepSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const decision = body.data.decision;
  const now = new Date();

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [updatedStep] = await tx
        .update(documentApprovalStep)
        .set({
          status: decision === "approved" ? "completed" : "rejected",
          decision,
          comment: body.data.comment ?? null,
          decidedAt: now,
          updatedBy: ctx.userId,
          updatedAt: now,
        })
        .where(eq(documentApprovalStep.id, stepId))
        .returning();

      let documentStatus = doc.status;

      if (decision === "rejected") {
        // Rejection sends the document back to draft
        if (doc.status !== "draft") {
          documentStatus = "draft";
          await tx
            .update(document)
            .set({ status: "draft", updatedBy: ctx.userId, updatedAt: now })
            .where(and(eq(document.id, id), eq(document.orgId, ctx.orgId)));
          if (doc.workItemId) {
            await tx
              .update(workItem)
              .set({ status: "draft", updatedBy: ctx.userId, updatedAt: now })
              .where(eq(workItem.id, doc.workItemId));
          }
        }
        if (doc.ownerId && doc.ownerId !== ctx.userId) {
          await tx.insert(notification).values({
            userId: doc.ownerId,
            orgId: ctx.orgId,
            type: "status_change",
            entityType: "document",
            entityId: id,
            title: `Document rejected in approval workflow: ${doc.title}`,
            message: `Step ${step.stepOrder} (${step.stepType}) was rejected${body.data.comment ? `: ${body.data.comment}` : "."} The document is back in draft.`,
            channel: "both",
            templateKey: "document_approval_rejected",
            templateData: {
              documentId: id,
              documentTitle: doc.title,
              stepOrder: step.stepOrder,
              comment: body.data.comment ?? null,
            },
            createdBy: ctx.userId,
          });
        }
      } else {
        // Check whether any other step is still open
        const [openStep] = await tx
          .select({ id: documentApprovalStep.id })
          .from(documentApprovalStep)
          .where(
            and(
              eq(documentApprovalStep.documentId, id),
              eq(documentApprovalStep.orgId, ctx.orgId),
              ne(documentApprovalStep.id, stepId),
              eq(documentApprovalStep.status, "pending"),
            ),
          )
          .limit(1);

        if (
          !openStep &&
          (doc.status === "in_review" || doc.status === "draft")
        ) {
          // All steps completed → document automatically approved
          documentStatus = "approved";
          await tx
            .update(document)
            .set({ status: "approved", updatedBy: ctx.userId, updatedAt: now })
            .where(and(eq(document.id, id), eq(document.orgId, ctx.orgId)));
          if (doc.workItemId) {
            await tx
              .update(workItem)
              .set({
                status: "in_approval",
                updatedBy: ctx.userId,
                updatedAt: now,
              })
              .where(eq(workItem.id, doc.workItemId));
          }
          if (doc.ownerId && doc.ownerId !== ctx.userId) {
            await tx.insert(notification).values({
              userId: doc.ownerId,
              orgId: ctx.orgId,
              type: "status_change",
              entityType: "document",
              entityId: id,
              title: `Document approved: ${doc.title}`,
              message: `All approval steps are completed. The document '${doc.title}' is now approved.`,
              channel: "both",
              templateKey: "document_approval_completed",
              templateData: { documentId: id, documentTitle: doc.title },
              createdBy: ctx.userId,
            });
          }
        }
      }

      return { step: updatedStep, documentStatus };
    },
    {
      actionDetail: `approval_step_${decision}:step_${step.stepOrder}`,
      reason: body.data.comment ?? "",
    },
  );

  return Response.json({ data: result });
}
