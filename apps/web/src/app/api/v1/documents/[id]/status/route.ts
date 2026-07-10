import { db, document, documentVersion, workItem, notification } from "@grc/db";
import {
  documentStatusTransitionSchema,
  VALID_DOCUMENT_TRANSITIONS,
  checkFourEyes,
} from "@grc/shared";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { createDocumentVersion } from "@/lib/document-versioning";

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

  // D2: four-eyes enforcement — in_review→approved and
  // approved→published must not be performed by the creator / last
  // content editor of the current version. UI maps the `code` to the
  // i18n keys documents.errors.fourEyesApprove / fourEyesPublish.
  const [currentVersionRow] = await db
    .select({
      createdBy: documentVersion.createdBy,
    })
    .from(documentVersion)
    .where(
      and(
        eq(documentVersion.documentId, id),
        eq(documentVersion.orgId, ctx.orgId),
        eq(documentVersion.isCurrent, true),
      ),
    )
    .orderBy(desc(documentVersion.versionNumber))
    .limit(1);

  const fourEyes = checkFourEyes({
    currentStatus,
    targetStatus,
    actorId: ctx.userId,
    currentVersionCreatedBy: currentVersionRow?.createdBy ?? null,
    documentCreatedBy: existing.createdBy,
    documentUpdatedBy: existing.updatedBy,
  });
  if (fourEyes.violation) {
    return Response.json(
      {
        error:
          fourEyes.guardedTransition === "approve"
            ? "Four-eyes principle: the author or last content editor of a document must not approve it. Ask another authorized user to approve."
            : "Four-eyes principle: the author or last content editor of a document must not publish it. Ask another authorized user to publish.",
        code:
          fourEyes.guardedTransition === "approve"
            ? "four_eyes_approve"
            : "four_eyes_publish",
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

    // Set publishedAt when publishing; D1: the published content
    // becomes a new MAJOR version (validFrom = now); the predecessor
    // window is closed (validUntil = now) inside the helper.
    if (targetStatus === "published") {
      const publishedAt = new Date();
      updateValues.publishedAt = publishedAt;
      const created = await createDocumentVersion(tx, {
        documentId: id,
        orgId: ctx.orgId,
        userId: ctx.userId,
        bump: "major",
        content: existing.content,
        changeSummary: "Published as new major version",
        file: {
          fileName: existing.fileName,
          filePath: existing.filePath,
          fileSize: existing.fileSize,
          mimeType: existing.mimeType,
          fileSha256: existing.fileSha256,
        },
        now: publishedAt,
      });
      updateValues.currentVersion = created.versionNumber;
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
    if (
      targetStatus === "in_review" &&
      existing.reviewerId &&
      existing.reviewerId !== ctx.userId
    ) {
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
    if (
      targetStatus === "approved" &&
      existing.approverId &&
      existing.approverId !== ctx.userId
    ) {
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
