import { db, process, processComment, notification, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createCommentSchema } from "@grc/shared";
import { eq, and, isNull, desc, asc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/processes/:id/comments — List comments for process
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

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

  // Parse query filters
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "all"; // all | open | resolved
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");

  // Build conditions
  const conditions = [
    eq(processComment.processId, id),
    eq(processComment.orgId, ctx.orgId),
    isNull(processComment.deletedAt),
    isNull(processComment.parentCommentId), // Only top-level comments
  ];

  if (filter === "open") {
    conditions.push(eq(processComment.isResolved, false));
  } else if (filter === "resolved") {
    conditions.push(eq(processComment.isResolved, true));
  }

  if (entityType) {
    conditions.push(eq(processComment.entityType, entityType));
  }

  if (entityId) {
    conditions.push(eq(processComment.entityId, entityId));
  }

  // Fetch top-level comments with author name
  const topComments = await db
    .select({
      id: processComment.id,
      orgId: processComment.orgId,
      processId: processComment.processId,
      entityType: processComment.entityType,
      entityId: processComment.entityId,
      content: processComment.content,
      isResolved: processComment.isResolved,
      resolvedAt: processComment.resolvedAt,
      resolvedBy: processComment.resolvedBy,
      parentCommentId: processComment.parentCommentId,
      mentionedUserIds: processComment.mentionedUserIds,
      createdAt: processComment.createdAt,
      updatedAt: processComment.updatedAt,
      createdBy: processComment.createdBy,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(processComment)
    .leftJoin(user, eq(processComment.createdBy, user.id))
    .where(and(...conditions))
    .orderBy(desc(processComment.createdAt));

  // Fetch all replies for those comments
  const topIds = topComments.map((c) => c.id);

  let replies: typeof topComments = [];
  if (topIds.length > 0) {
    replies = await db
      .select({
        id: processComment.id,
        orgId: processComment.orgId,
        processId: processComment.processId,
        entityType: processComment.entityType,
        entityId: processComment.entityId,
        content: processComment.content,
        isResolved: processComment.isResolved,
        resolvedAt: processComment.resolvedAt,
        resolvedBy: processComment.resolvedBy,
        parentCommentId: processComment.parentCommentId,
        mentionedUserIds: processComment.mentionedUserIds,
        createdAt: processComment.createdAt,
        updatedAt: processComment.updatedAt,
        createdBy: processComment.createdBy,
        authorName: user.name,
        authorEmail: user.email,
      })
      .from(processComment)
      .leftJoin(user, eq(processComment.createdBy, user.id))
      .where(
        and(
          sql`${processComment.parentCommentId} = ANY(${topIds})`,
          isNull(processComment.deletedAt),
        ),
      )
      .orderBy(asc(processComment.createdAt));
  }

  // Build threaded response
  const threaded = topComments.map((parent) => ({
    ...parent,
    replies: replies.filter((r) => r.parentCommentId === parent.id),
  }));

  return Response.json({ data: threaded });
}

// POST /api/v1/processes/:id/comments — Create comment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "process_owner",
    "risk_manager",
    "auditor",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = createCommentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify processId in body matches route param
  if (body.data.processId !== id) {
    return Response.json(
      { error: "Process ID in body does not match route parameter" },
      { status: 422 },
    );
  }

  // Verify process exists
  const [proc] = await db
    .select({
      id: process.id,
      name: process.name,
      processOwnerId: process.processOwnerId,
    })
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

  // If replying to a parent comment, validate it exists
  if (body.data.parentCommentId) {
    const [parent] = await db
      .select({ id: processComment.id })
      .from(processComment)
      .where(
        and(
          eq(processComment.id, body.data.parentCommentId),
          eq(processComment.processId, id),
          isNull(processComment.deletedAt),
        ),
      );

    if (!parent) {
      return Response.json(
        { error: "Parent comment not found" },
        { status: 404 },
      );
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processComment)
      .values({
        orgId: ctx.orgId,
        processId: id,
        entityType: body.data.entityType,
        entityId: body.data.entityId,
        content: body.data.content,
        parentCommentId: body.data.parentCommentId ?? null,
        mentionedUserIds: body.data.mentionedUserIds ?? [],
        createdBy: ctx.userId,
      })
      .returning();

    // Send notifications to mentioned users
    const mentionedUserIds = body.data.mentionedUserIds ?? [];
    const notifyUserIds = new Set(mentionedUserIds);

    // Also notify process owner if they're not the commenter
    if (proc.processOwnerId && proc.processOwnerId !== ctx.userId) {
      notifyUserIds.add(proc.processOwnerId);
    }

    // Remove the commenter from notification list
    notifyUserIds.delete(ctx.userId);

    if (notifyUserIds.size > 0) {
      const notificationValues = [...notifyUserIds].map((userId) => ({
        userId,
        orgId: ctx.orgId,
        type: "task_assigned" as const,
        entityType: "process_comment",
        entityId: row.id,
        title: mentionedUserIds.includes(userId)
          ? `You were mentioned in a comment on "${proc.name}"`
          : `New comment on process "${proc.name}"`,
        message: body.data.content.substring(0, 200),
        channel: "both" as const,
        templateKey: "process_comment_notification",
        templateData: {
          processId: id,
          processName: proc.name,
          commentId: row.id,
          commentBy: ctx.userId,
        },
        createdBy: ctx.userId,
      }));

      await tx.insert(notification).values(notificationValues);
    }

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
