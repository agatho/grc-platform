import { db, task, user } from "@grc/db";
import { updateTaskSchema } from "@grc/shared";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/tasks/:id — Task detail with assignee info
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [row] = await db
    .select({
      id: task.id,
      orgId: task.orgId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assigneeRole: task.assigneeRole,
      dueDate: task.dueDate,
      reminderAt: task.reminderAt,
      escalationAt: task.escalationAt,
      completedAt: task.completedAt,
      completedBy: task.completedBy,
      sourceEntityType: task.sourceEntityType,
      sourceEntityId: task.sourceEntityId,
      tags: task.tags,
      metadata: task.metadata,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      createdBy: task.createdBy,
      updatedBy: task.updatedBy,
      assigneeName: user.name,
      assigneeEmail: user.email,
    })
    .from(task)
    .leftJoin(user, eq(task.assigneeId, user.id))
    .where(
      and(
        eq(task.id, id),
        eq(task.orgId, ctx.orgId),
        isNull(task.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/tasks/:id — Update task (admin or assignee)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Fetch existing task to check permissions
  const [existing] = await db
    .select()
    .from(task)
    .where(
      and(
        eq(task.id, id),
        eq(task.orgId, ctx.orgId),
        isNull(task.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Check role: admin or assignee
  const isAssignee = existing.assigneeId === ctx.userId;

  // Check for admin role
  const adminCheck = await withAuth("admin");
  const isAdmin = !(adminCheck instanceof Response);

  if (!isAdmin && !isAssignee) {
    return Response.json(
      { error: "Forbidden: only admin or assignee can update this task" },
      { status: 403 },
    );
  }

  const body = updateTaskSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate dueDate is in the future if provided
  if (body.data.dueDate) {
    const due = new Date(body.data.dueDate);
    if (due <= new Date()) {
      return Response.json(
        { error: "dueDate must be in the future" },
        { status: 422 },
      );
    }
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    if (body.data.title !== undefined) updateValues.title = body.data.title;
    if (body.data.description !== undefined)
      updateValues.description = body.data.description;
    if (body.data.priority !== undefined)
      updateValues.priority = body.data.priority;
    if (body.data.assigneeId !== undefined)
      updateValues.assigneeId = body.data.assigneeId;
    if (body.data.dueDate !== undefined)
      updateValues.dueDate = new Date(body.data.dueDate);
    if (body.data.reminderAt !== undefined)
      updateValues.reminderAt = new Date(body.data.reminderAt);
    if (body.data.sourceEntityType !== undefined)
      updateValues.sourceEntityType = body.data.sourceEntityType;
    if (body.data.sourceEntityId !== undefined)
      updateValues.sourceEntityId = body.data.sourceEntityId;
    if (body.data.tags !== undefined) updateValues.tags = body.data.tags;

    const [row] = await tx
      .update(task)
      .set(updateValues)
      .where(
        and(
          eq(task.id, id),
          eq(task.orgId, ctx.orgId),
          isNull(task.deletedAt),
        ),
      )
      .returning();

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/tasks/:id — Soft delete (admin only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(task)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(task.id, id),
          eq(task.orgId, ctx.orgId),
          isNull(task.deletedAt),
        ),
      )
      .returning({ id: task.id });

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id, deleted: true } });
}
