import {
  db,
  document,
  documentVersion,
  workItem,
  user,
} from "@grc/db";
import { updateDocumentSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

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
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "dpo", "process_owner");
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
    if (body.data.category !== undefined) updateValues.category = body.data.category;
    if (body.data.requiresAcknowledgment !== undefined) updateValues.requiresAcknowledgment = body.data.requiresAcknowledgment;
    if (body.data.tags !== undefined) updateValues.tags = body.data.tags;
    if (body.data.ownerId !== undefined) updateValues.ownerId = body.data.ownerId;
    if (body.data.reviewerId !== undefined) updateValues.reviewerId = body.data.reviewerId;
    if (body.data.approverId !== undefined) updateValues.approverId = body.data.approverId;
    if (body.data.expiresAt !== undefined) updateValues.expiresAt = body.data.expiresAt ? new Date(body.data.expiresAt) : null;
    if (body.data.reviewDate !== undefined) updateValues.reviewDate = body.data.reviewDate ? new Date(body.data.reviewDate) : null;

    // Auto-version on content change
    if (contentChanged) {
      const newVersion = existing.currentVersion + 1;
      updateValues.currentVersion = newVersion;

      // Mark old version as not current
      await tx
        .update(documentVersion)
        .set({ isCurrent: false })
        .where(
          and(
            eq(documentVersion.documentId, id),
            eq(documentVersion.isCurrent, true),
          ),
        );

      // Create new version
      await tx
        .insert(documentVersion)
        .values({
          documentId: id,
          orgId: ctx.orgId,
          versionNumber: newVersion,
          content: body.data.content,
          changeSummary: `Updated content (version ${newVersion})`,
          isCurrent: true,
          createdBy: ctx.userId,
        });
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
