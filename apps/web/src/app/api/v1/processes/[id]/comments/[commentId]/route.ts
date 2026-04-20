import { db, process, processComment, userOrganizationRole } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateCommentSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

/** Check if user is the comment author or has admin role */
async function isAuthorOrAdmin(
  userId: string,
  orgId: string,
  commentCreatedBy: string,
): Promise<boolean> {
  if (userId === commentCreatedBy) return true;

  const [role] = await db
    .select({ role: userOrganizationRole.role })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, userId),
        eq(userOrganizationRole.orgId, orgId),
        eq(userOrganizationRole.role, "admin"),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  return !!role;
}

// PUT /api/v1/processes/:id/comments/:commentId — Update comment content
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, commentId } = await params;

  // Verify process exists
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Fetch comment
  const [existing] = await db
    .select({
      id: processComment.id,
      createdBy: processComment.createdBy,
    })
    .from(processComment)
    .where(
      and(
        eq(processComment.id, commentId),
        eq(processComment.processId, id),
        eq(processComment.orgId, ctx.orgId),
        isNull(processComment.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only author or admin can edit
  const allowed = await isAuthorOrAdmin(
    ctx.userId,
    ctx.orgId,
    existing.createdBy,
  );
  if (!allowed) {
    return Response.json(
      { error: "Only the comment author or admin can edit this comment" },
      { status: 403 },
    );
  }

  const body = updateCommentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(processComment)
      .set({
        content: body.data.content,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processComment.id, commentId),
          eq(processComment.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}

// DELETE /api/v1/processes/:id/comments/:commentId — Soft delete comment
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, commentId } = await params;

  // Verify process exists
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Fetch comment
  const [existing] = await db
    .select({
      id: processComment.id,
      createdBy: processComment.createdBy,
    })
    .from(processComment)
    .where(
      and(
        eq(processComment.id, commentId),
        eq(processComment.processId, id),
        eq(processComment.orgId, ctx.orgId),
        isNull(processComment.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only author or admin can delete
  const allowed = await isAuthorOrAdmin(
    ctx.userId,
    ctx.orgId,
    existing.createdBy,
  );
  if (!allowed) {
    return Response.json(
      { error: "Only the comment author or admin can delete this comment" },
      { status: 403 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(processComment)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processComment.id, commentId),
          eq(processComment.orgId, ctx.orgId),
        ),
      );
  });

  return Response.json({ data: { id: commentId, deleted: true } });
}
