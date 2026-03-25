import { db, task, notification } from "@grc/db";
import { taskStatusTransitionSchema } from "@grc/shared";
import type { TaskStatus } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// Valid status transitions
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ["in_progress", "done", "cancelled"],
  in_progress: ["done", "cancelled"],
  overdue: ["in_progress", "done", "cancelled"],
  done: [],
  cancelled: [],
};

// PUT /api/v1/tasks/:id/status — Transition task status
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Fetch existing task
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
  const adminCheck = await withAuth("admin");
  const isAdmin = !(adminCheck instanceof Response);

  if (!isAdmin && !isAssignee) {
    return Response.json(
      { error: "Forbidden: only admin or assignee can change task status" },
      { status: 403 },
    );
  }

  const body = taskStatusTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const newStatus = body.data.status;
  const currentStatus = existing.status as TaskStatus;

  // Validate transition
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  if (!allowedTransitions || allowedTransitions.length === 0) {
    return Response.json(
      {
        error: `Cannot transition from '${currentStatus}': no transitions allowed`,
      },
      { status: 400 },
    );
  }

  if (!allowedTransitions.includes(newStatus)) {
    return Response.json(
      {
        error: `Invalid transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowedTransitions.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      status: newStatus,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    // Set completedAt/completedBy when transitioning to 'done'
    if (newStatus === "done") {
      updateValues.completedAt = new Date();
      updateValues.completedBy = ctx.userId;
    }

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

    // Notify task creator when marked 'done'
    if (newStatus === "done" && existing.createdBy !== ctx.userId) {
      await tx.insert(notification).values({
        userId: existing.createdBy,
        orgId: ctx.orgId,
        type: "status_change",
        entityType: "task",
        entityId: id,
        title: `Task completed: ${existing.title}`,
        message: `Task "${existing.title}" has been marked as done.`,
        channel: "both",
        templateKey: "task_completed",
        templateData: {
          taskId: id,
          taskTitle: existing.title,
          completedBy: ctx.userId,
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
