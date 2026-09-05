// Cron Job: Overdue Task Processing
// Finds tasks past their due date and marks them overdue,
// then creates notifications for assignees and task creators.

import { db, task, notification, user } from "@grc/db";
import { eq, and, lt, isNull, notInArray, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { insertNotification } from "../lib/notify";
import { withOrgContext, reportJobError } from "../lib/job-runtime";

interface OverdueTaskResult {
  processed: number;
  errors: string[];
  ok: boolean;
}

export const processOverdueTasks = withCronInstrumentation(
  "overdue-tasks",
  async (): Promise<OverdueTaskResult> => {
    const errors: string[] = [];
    let processed = 0;
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
      return { processed: 0, errors: [], ok: true };
    }

    // ── [WP9 · S10-13] Atomicity ────────────────────────────────────
    //
    // The bulk status change and the notification loop used to be two
    // unconnected operations. The audit's scenario: 5.000 overdue tasks,
    // the worker is stopped between them (deploy, OOM, container restart —
    // a realistic window at that size). All 5.000 are already `overdue`,
    // some have no notification, and the next run cannot find them again
    // because the selection excludes `status = 'overdue'`. The
    // notification is permanently lost and the state is not reconstructible
    // from the data model.
    //
    // Now: one transaction per task. The task flips to `overdue` in the
    // SAME transaction that writes its notifications, so a task is either
    // marked and notified or neither. A guarded UPDATE (`AND status <> …`)
    // makes it idempotent, and `RETURNING` tells us whether we actually won
    // the row — a concurrent run cannot double-notify.
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

        await withOrgContext(overdueTask.orgId, async (tx) => {
          const claimed = await tx
            .update(task)
            .set({ status: "overdue", updatedAt: now })
            .where(
              and(
                eq(task.id, overdueTask.id),
                notInArray(task.status, ["done", "cancelled", "overdue"]),
                isNull(task.deletedAt),
              ),
            )
            .returning({ id: task.id });
          if (claimed.length === 0) return; // another run got there first

          // Notify the assignee (if one exists)
          if (overdueTask.assigneeId) {
            await insertNotification(
              { ...notificationBase, userId: overdueTask.assigneeId },
              { job: "overdue-tasks", tx },
            );
          }

          // Notify the task creator (if different from the assignee)
          if (
            overdueTask.createdBy &&
            overdueTask.createdBy !== overdueTask.assigneeId
          ) {
            await insertNotification(
              { ...notificationBase, userId: overdueTask.createdBy },
              { job: "overdue-tasks", tx },
            );
          }
          processed++;
        });
      } catch (err) {
        reportJobError(
          { job: "overdue-tasks", scope: `task ${overdueTask.id}` },
          err,
        );
        errors.push(
          `Task ${overdueTask.id}: ${err instanceof Error ? err.constructor.name : "Error"}`,
        );
      }
    }

    return { processed, errors, ok: errors.length === 0 };
  },
);
