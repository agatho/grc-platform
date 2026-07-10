import { db, document, workItem, user, retentionPolicy } from "@grc/db";
import { updateDocumentSchema, computeRetentionUntil } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { createDocumentVersion } from "@/lib/document-versioning";

// GET /api/v1/documents/:id — Document detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: document.id,
      orgId: document.orgId,
      workItemId: document.workItemId,
      elementId: workItem.elementId,
      workItemStatus: workItem.status,
      title: document.title,
      content: document.content,
      category: document.category,
      status: document.status,
      currentVersion: document.currentVersion,
      requiresAcknowledgment: document.requiresAcknowledgment,
      tags: document.tags,
      ownerId: document.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      reviewerId: document.reviewerId,
      approverId: document.approverId,
      publishedAt: document.publishedAt,
      expiresAt: document.expiresAt,
      reviewDate: document.reviewDate,
      fileName: document.fileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      fileSha256: document.fileSha256,
      retentionPolicyId: document.retentionPolicyId,
      retentionUntil: document.retentionUntil,
      legalHold: document.legalHold,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      createdBy: document.createdBy,
      updatedBy: document.updatedBy,
    })
    .from(document)
    .leftJoin(workItem, eq(document.workItemId, workItem.id))
    .leftJoin(user, eq(document.ownerId, user.id))
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/documents/:id — Update document (auto-version on content change)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const body = updateDocumentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // D3: validate retention policy belongs to this org before assigning
  let assignedPolicy: typeof retentionPolicy.$inferSelect | null = null;
  if (body.data.retentionPolicyId) {
    const [policy] = await db
      .select()
      .from(retentionPolicy)
      .where(
        and(
          eq(retentionPolicy.id, body.data.retentionPolicyId),
          eq(retentionPolicy.orgId, ctx.orgId),
          isNull(retentionPolicy.deletedAt),
        ),
      );
    if (!policy) {
      return Response.json(
        { error: "Retention policy not found in this organization" },
        { status: 422 },
      );
    }
    assignedPolicy = policy;
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    let contentChanged = false;

    if (body.data.title !== undefined) updateValues.title = body.data.title;
    if (body.data.content !== undefined) {
      updateValues.content = body.data.content;
      contentChanged = body.data.content !== existing.content;
    }
    if (body.data.category !== undefined)
      updateValues.category = body.data.category;
    if (body.data.requiresAcknowledgment !== undefined)
      updateValues.requiresAcknowledgment = body.data.requiresAcknowledgment;
    if (body.data.tags !== undefined) updateValues.tags = body.data.tags;
    if (body.data.ownerId !== undefined)
      updateValues.ownerId = body.data.ownerId;
    if (body.data.reviewerId !== undefined)
      updateValues.reviewerId = body.data.reviewerId;
    if (body.data.approverId !== undefined)
      updateValues.approverId = body.data.approverId;
    if (body.data.expiresAt !== undefined)
      updateValues.expiresAt = body.data.expiresAt
        ? new Date(body.data.expiresAt)
        : null;
    if (body.data.reviewDate !== undefined)
      updateValues.reviewDate = body.data.reviewDate
        ? new Date(body.data.reviewDate)
        : null;

    // D3: retention assignment + legal hold
    if (body.data.legalHold !== undefined)
      updateValues.legalHold = body.data.legalHold;
    if (body.data.retentionPolicyId !== undefined) {
      updateValues.retentionPolicyId = body.data.retentionPolicyId;
      if (assignedPolicy) {
        updateValues.retentionUntil = computeRetentionUntil({
          basis: assignedPolicy.basis,
          retentionYears: assignedPolicy.retentionYears,
          createdAt: existing.createdAt,
          publishedAt: existing.publishedAt,
          expiresAt:
            body.data.expiresAt !== undefined
              ? body.data.expiresAt
              : existing.expiresAt,
        });
      } else {
        updateValues.retentionUntil = null;
      }
    }

    // D1: auto-version on content change — minor bump (draft edit).
    // Major bumps happen exclusively on the publish transition in
    // [id]/status/route.ts via the same helper.
    if (contentChanged) {
      const created = await createDocumentVersion(tx, {
        documentId: id,
        orgId: ctx.orgId,
        userId: ctx.userId,
        bump: "minor",
        content: body.data.content ?? null,
        changeSummary: `Updated content (version ${existing.currentVersion + 1})`,
        file: {
          fileName: existing.fileName,
          filePath: existing.filePath,
          fileSize: existing.fileSize,
          mimeType: existing.mimeType,
          fileSha256: existing.fileSha256,
        },
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

    // Sync work item name if title changed
    if (body.data.title !== undefined && existing.workItemId) {
      await tx
        .update(workItem)
        .set({
          name: body.data.title,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(workItem.id, existing.workItemId));
    }

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/documents/:id — Soft delete
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(document)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(document.id, id),
          eq(document.orgId, ctx.orgId),
          isNull(document.deletedAt),
        ),
      )
      .returning({ id: document.id, workItemId: document.workItemId });

    if (row?.workItemId) {
      await tx
        .update(workItem)
        .set({
          deletedAt: new Date(),
          deletedBy: ctx.userId,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(workItem.id, row.workItemId));
    }

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id, deleted: true } });
}
