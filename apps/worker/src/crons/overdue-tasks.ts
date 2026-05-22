// Cron Job: Overdue Task Processing
// Finds tasks past their due date and marks them overdue,
// then creates notifications for assignees and task creators.

import { db, task, notification, user } from "@grc/db";
import { eq, and, lt, isNull, notInArray, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface OverdueTaskResult {
  processed: number;
  errors: string[];
}

export const processOverdueTasks = withCronInstrumentation(
  "overdue-tasks",
  async (): Promise<OverdueTaskResult> => {
    const errors: string[] = [];
    const now = new Date();

    // Find all tasks where due_date < NOW() and status is not terminal/overdue
    const overdueTasks = await db
      .select({
        id: task.id,
        orgId: task.orgId,
        title: task.title,
        dueDate: task.dueDate,
        assigneeId: task.assigneeId,
        createdBy: task.createdBy,
        priority: task.priority,
      })
      .from(task)
      .where(
        and(
          lt(task.dueDate, sql`NOW()`),
          notInArray(task.status, ["done", "cancelled", "overdue"]),
          isNull(task.deletedAt),
        ),
      );

    if (overdueTasks.length === 0) {
      return { processed: 0, errors: [] };
    }

    // Batch update all found tasks to status='overdue'
    const taskIds = overdueTasks.map((t) => t.id);

    try {
      await db
        .update(task)
        .set({
          status: "overdue",
          updatedAt: now,
        })
        .where(
          and(
            sql`${task.id} = ANY(${taskIds}::uuid[])`,
            isNull(task.deletedAt),
          ),
        );
    } catch (err) {
      // In-result error counter kept for downstream callers; the wrapper
      // also logs a structured 'error' phase entry.
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Batch status update failed: ${message}`);
      return { processed: 0, errors };
    }

    // Create notifications for each overdue task
    for (const overdueTask of overdueTasks) {
      try {
        const daysOverdue = overdueTask.dueDate
          ? Math.floor(
              (now.getTime() - overdueTask.dueDate.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0;

        const notificationBase = {
          orgId: overdueTask.orgId,
          type: "deadline_approaching" as const,
          entityType: "task",
          entityId: overdueTask.id,
          title: `Task overdue: ${overdueTask.title}`,
          message: `Task "${overdueTask.title}" is ${daysOverdue} day(s) overdue.`,
          channel: "both" as const,
          templateKey: "task_overdue",
          templateData: {
            taskTitle: overdueTask.title,
            dueDate: overdueTask.dueDate?.toISOString() ?? "",
            daysOverdue,
            priority: overdueTask.priority,
          },
          createdAt: now,
          updatedAt: now,
        };

        // Notify the assignee (if one exists)
        if (overdueTask.assigneeId) {
          await db.insert(notification).values({
            ...notificationBase,
            userId: overdueTask.assigneeId,
          });
        }

        // Notify the task creator (if different from assignee)
        if (
          overdueTask.createdBy &&
          overdueTask.createdBy !== overdueTask.assigneeId
        ) {
          await db.insert(notification).values({
            ...notificationBase,
            userId: overdueTask.createdBy,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Notification for task ${overdueTask.id}: ${message}`);
      }
    }

    return { processed: overdueTasks.length, errors };
  },
);
