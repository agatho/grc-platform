import { db, task, notification } from "@grc/db";
import { eq, and, isNull, gte, count } from "drizzle-orm";
import { z } from "zod";
import { withAuth, withAuditContext } from "@/lib/api";

const manualNotifySchema = z.object({
  message: z.string().max(5000).optional(),
  template: z.enum(["reminder", "escalation", "custom"]).default("reminder"),
});

const TEMPLATE_KEY_MAP: Record<string, string> = {
  reminder: "task_reminder",
  escalation: "task_escalation",
  custom: "task_custom",
};

const NOTIFICATION_TYPE_MAP: Record<string, "deadline_approaching" | "escalation" | "task_assigned"> = {
  reminder: "deadline_approaching",
  escalation: "escalation",
  custom: "task_assigned",
};

// POST /api/v1/tasks/:id/notify — Manual email trigger (admin only)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Fetch task
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
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (!existing.assigneeId) {
    return Response.json(
      { error: "Task has no assignee to notify" },
      { status: 422 },
    );
  }

  // Rate limit: max 3 per task per 24h
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [{ value: recentCount }] = await db
    .select({ value: count() })
    .from(notification)
    .where(
      and(
        eq(notification.entityType, "task"),
        eq(notification.entityId, id),
        eq(notification.channel, "email"),
        gte(notification.createdAt, twentyFourHoursAgo),
        isNull(notification.deletedAt),
      ),
    );

  if (recentCount >= 3) {
    return Response.json(
      {
        error: "Rate limit exceeded: maximum 3 email notifications per task per 24 hours",
      },
      { status: 429 },
    );
  }

  const body = manualNotifySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const templateKey = TEMPLATE_KEY_MAP[body.data.template];
  const notificationType = NOTIFICATION_TYPE_MAP[body.data.template];

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(notification)
      .values({
        userId: existing.assigneeId!,
        orgId: ctx.orgId,
        type: notificationType,
        entityType: "task",
        entityId: id,
        title: `${body.data.template === "escalation" ? "Escalation" : "Reminder"}: ${existing.title}`,
        message:
          body.data.message ??
          `You have a ${body.data.template} for task "${existing.title}".`,
        channel: "email",
        templateKey,
        templateData: {
          taskId: id,
          taskTitle: existing.title,
          template: body.data.template,
          customMessage: body.data.message,
          triggeredBy: ctx.userId,
        },
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: { id: created.id } });
}
