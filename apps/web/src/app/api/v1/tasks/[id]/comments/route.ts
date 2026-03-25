import { db, task, taskComment, user } from "@grc/db";
import { eq, and, isNull, asc, count } from "drizzle-orm";
import { z } from "zod";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

// POST /api/v1/tasks/:id/comments — Add comment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Verify task exists in this org
  const [existing] = await db
    .select({ id: task.id })
    .from(task)
    .where(
      and(
        eq(task.id, id),
        eq(task.orgId, ctx.orgId),
        isNull(task.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const body = createCommentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(taskComment)
      .values({
        taskId: id,
        orgId: ctx.orgId,
        content: body.data.content,
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/tasks/:id/comments — List comments
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Verify task exists in this org
  const [existing] = await db
    .select({ id: task.id })
    .from(task)
    .where(
      and(
        eq(task.id, id),
        eq(task.orgId, ctx.orgId),
        isNull(task.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const { page, limit, offset } = paginate(req);

  const conditions = and(
    eq(taskComment.taskId, id),
    eq(taskComment.orgId, ctx.orgId),
    isNull(taskComment.deletedAt),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: taskComment.id,
        taskId: taskComment.taskId,
        orgId: taskComment.orgId,
        content: taskComment.content,
        createdAt: taskComment.createdAt,
        updatedAt: taskComment.updatedAt,
        createdBy: taskComment.createdBy,
        commenterName: user.name,
        commenterEmail: user.email,
      })
      .from(taskComment)
      .leftJoin(user, eq(taskComment.createdBy, user.id))
      .where(conditions)
      .orderBy(asc(taskComment.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(taskComment).where(conditions),
  ]);

  return paginatedResponse(items, total, page, limit);
}
