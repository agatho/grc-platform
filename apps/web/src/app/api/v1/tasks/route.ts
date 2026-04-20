import { db, task, user, userOrganizationRole, notification } from "@grc/db";
import { createTaskSchema } from "@grc/shared";
import {
  eq,
  and,
  isNull,
  count,
  asc,
  lte,
  gte,
  lt,
  inArray,
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/tasks — Create task
export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "dpo",
    "auditor",
    "control_owner",
  );
  if (ctx instanceof Response) return ctx;

  const body = createTaskSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate dueDate is in the future
  if (body.data.dueDate) {
    const due = new Date(body.data.dueDate);
    if (due <= new Date()) {
      return Response.json(
        { error: "dueDate must be in the future" },
        { status: 422 },
      );
    }
  }

  // Validate assignee exists in same org
  if (body.data.assigneeId) {
    const [assignee] = await db
      .select({ id: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, body.data.assigneeId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    if (!assignee) {
      return Response.json(
        { error: "Assignee not found in this organization" },
        { status: 422 },
      );
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(task)
      .values({
        orgId: ctx.orgId,
        title: body.data.title,
        description: body.data.description,
        priority: body.data.priority,
        assigneeId: body.data.assigneeId,
        dueDate: body.data.dueDate ? new Date(body.data.dueDate) : undefined,
        reminderAt: body.data.reminderAt
          ? new Date(body.data.reminderAt)
          : undefined,
        sourceEntityType: body.data.sourceEntityType,
        sourceEntityId: body.data.sourceEntityId,
        tags: body.data.tags,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create in-app notification for assignee
    if (body.data.assigneeId) {
      await tx.insert(notification).values({
        userId: body.data.assigneeId,
        orgId: ctx.orgId,
        type: "task_assigned",
        entityType: "task",
        entityId: row.id,
        title: `New task assigned: ${body.data.title}`,
        message: body.data.description ?? null,
        channel: "both",
        templateKey: "task_assigned",
        templateData: {
          taskId: row.id,
          taskTitle: body.data.title,
          assignedBy: ctx.userId,
        },
        createdBy: ctx.userId,
      });
    }

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/tasks — List tasks
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  // Determine view: admin/risk_manager can see 'all', others forced to 'my'
  const requestedView = searchParams.get("view") ?? "my";

  // Check if user has admin or risk_manager role for 'all' view
  let canViewAll = false;
  if (requestedView === "all") {
    const [adminRole] = await db
      .select({ role: userOrganizationRole.role })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, ctx.userId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          inArray(userOrganizationRole.role, ["admin", "risk_manager"]),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    canViewAll = !!adminRole;
  }

  const view = requestedView === "all" && canViewAll ? "all" : "my";

  const conditions: SQL[] = [eq(task.orgId, ctx.orgId), isNull(task.deletedAt)];

  // 'my' view: filter to assigned tasks
  if (view === "my") {
    conditions.push(eq(task.assigneeId, ctx.userId));
  }

  // Status filter
  const status = searchParams.get("status");
  if (status) {
    conditions.push(
      eq(
        task.status,
        status as "open" | "in_progress" | "done" | "overdue" | "cancelled",
      ),
    );
  }

  // Priority filter
  const priority = searchParams.get("priority");
  if (priority) {
    conditions.push(
      eq(task.priority, priority as "low" | "medium" | "high" | "critical"),
    );
  }

  // Assignee filter
  const assigneeId = searchParams.get("assignee_id");
  if (assigneeId) {
    conditions.push(eq(task.assigneeId, assigneeId));
  }

  // Due date range filters
  const dueBefore = searchParams.get("due_before");
  if (dueBefore) {
    conditions.push(lte(task.dueDate, new Date(dueBefore)));
  }

  const dueAfter = searchParams.get("due_after");
  if (dueAfter) {
    conditions.push(gte(task.dueDate, new Date(dueAfter)));
  }

  // Overdue filter
  if (searchParams.get("overdue") === "true") {
    conditions.push(lt(task.dueDate, new Date()));
    conditions.push(sql`${task.status} NOT IN ('done', 'cancelled')`);
  }

  // Source entity filters
  const sourceEntityType = searchParams.get("source_entity_type");
  if (sourceEntityType) {
    conditions.push(eq(task.sourceEntityType, sourceEntityType));
  }

  const sourceEntityId = searchParams.get("source_entity_id");
  if (sourceEntityId) {
    conditions.push(eq(task.sourceEntityId, sourceEntityId));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(task)
      .where(where)
      .orderBy(asc(task.dueDate))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(task).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
