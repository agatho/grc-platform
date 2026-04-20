// Sprint 1.2: Task Management Schema (Drizzle ORM)
// Entities: task, task_comment

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "in_progress",
  "done",
  "overdue",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

// ──────────────────────────────────────────────────────────────
// 2.1 Task — Task management (Sprint 1.2)
// ──────────────────────────────────────────────────────────────

export const task = pgTable(
  "task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("open"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    assigneeId: uuid("assignee_id").references(() => user.id),
    assigneeRole: varchar("assignee_role", { length: 50 }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    reminderAt: timestamp("reminder_at", { withTimezone: true }),
    escalationAt: timestamp("escalation_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => user.id),
    sourceEntityType: varchar("source_entity_type", { length: 50 }),
    sourceEntityId: uuid("source_entity_id"),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`),
    metadata: jsonb("metadata").default({}),
    // Sprint 1.4: link to work_item (FK added in migration SQL)
    workItemId: uuid("work_item_id"),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: uuid("updated_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => user.id),
  },
  (table) => [
    index("task_org_id_idx")
      .on(table.orgId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("task_assignee_idx")
      .on(table.assigneeId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("task_due_date_idx")
      .on(table.dueDate)
      .where(
        sql`${table.deletedAt} IS NULL AND ${table.status} NOT IN ('done', 'cancelled')`,
      ),
    index("task_source_entity_idx").on(
      table.sourceEntityType,
      table.sourceEntityId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.2 TaskComment — Comments on tasks (Sprint 1.2)
// ──────────────────────────────────────────────────────────────

export const taskComment = pgTable(
  "task_comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("tc_task_idx").on(table.taskId),
    index("tc_org_idx").on(table.orgId),
  ],
);
