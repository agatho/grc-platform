// B2 (Release-Cycle): multi-stage approval chain per process version.
//
// process_approval_step — one row per step in the definable approval
// chain of a process version (default chain: 1 reviewer → 1 approver →
// acknowledgment list). Acknowledgment steps double as the
// "Kenntnisnahme" records after publication.

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  date,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { process } from "./process";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const processApprovalStepTypeEnum = pgEnum(
  "process_approval_step_type",
  ["review", "approval", "acknowledgment"],
);

export const processApprovalStepStatusEnum = pgEnum(
  "process_approval_step_status",
  ["pending", "in_progress", "completed", "rejected", "skipped"],
);

// ──────────────────────────────────────────────────────────────
// process_approval_step  (migration 0349a)
// ──────────────────────────────────────────────────────────────

export const processApprovalStep = pgTable(
  "process_approval_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    stepOrder: integer("step_order").notNull(),
    stepType: processApprovalStepTypeEnum("step_type").notNull(),
    // Either a concrete user or a role key (system role, e.g. 'auditor')
    assigneeUserId: uuid("assignee_user_id").references(() => user.id),
    assigneeRole: varchar("assignee_role", { length: 80 }),
    status: processApprovalStepStatusEnum("status")
      .notNull()
      .default("pending"),
    decision: varchar("decision", { length: 20 }), // 'approve' | 'reject' | 'acknowledge'
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => user.id),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    index("pas_org_idx").on(t.orgId),
    index("pas_process_idx").on(t.processId),
    index("pas_process_version_idx").on(t.processId, t.versionNumber),
    index("pas_assignee_idx").on(t.assigneeUserId, t.status),
    uniqueIndex("pas_process_version_order_uniq").on(
      t.processId,
      t.versionNumber,
      t.stepOrder,
    ),
  ],
);
