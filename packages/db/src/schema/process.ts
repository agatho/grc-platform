// Sprint 3: BPMN Process Modeling Schema (Drizzle ORM)
// 5 entities: process, process_version, process_step, process_control, process_step_control

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  date,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { asset } from "./asset";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const processNotationEnum = pgEnum("process_notation", [
  "bpmn",
  "value_chain",
  "epc",
]);

export const processStatusEnum = pgEnum("process_status", [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
]);

export const stepTypeEnum = pgEnum("step_type", [
  "task",
  "gateway",
  "event",
  "subprocess",
  "call_activity",
]);

// ──────────────────────────────────────────────────────────────
// 3.1 Process — Core process entity (Sprint 3, BPM)
// ──────────────────────────────────────────────────────────────

export const process = pgTable(
  "process",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    parentProcessId: uuid("parent_process_id").references(
      (): AnyPgColumn => process.id,
    ),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    level: integer("level").notNull().default(1),
    notation: processNotationEnum("notation").notNull().default("bpmn"),
    status: processStatusEnum("status").notNull().default("draft"),
    processOwnerId: uuid("process_owner_id").references(() => user.id),
    reviewerId: uuid("reviewer_id").references(() => user.id),
    department: varchar("department", { length: 255 }),
    currentVersion: integer("current_version").notNull().default(1),
    isEssential: boolean("is_essential").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Gallery thumbnail (Sprint 3b)
    galleryThumbnailPath: varchar("gallery_thumbnail_path", { length: 1000 }),
    // Review cycle (Gap 2)
    reviewDate: timestamp("review_date", { withTimezone: true }),
    reviewCycleDays: integer("review_cycle_days"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    lastReviewedBy: uuid("last_reviewed_by").references(() => user.id),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("process_org_idx").on(table.orgId),
    index("process_parent_idx").on(table.parentProcessId),
    index("process_owner_idx").on(table.processOwnerId),
    index("process_status_idx").on(table.orgId, table.status),
    index("process_level_idx").on(table.orgId, table.level),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.2 ProcessVersion — BPMN XML version records (Sprint 3, BPM)
// ──────────────────────────────────────────────────────────────

export const processVersion = pgTable(
  "process_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    versionNumber: integer("version_number").notNull(),
    bpmnXml: text("bpmn_xml"),
    diagramJson: jsonb("diagram_json"),
    changeSummary: text("change_summary"),
    diffSummaryJson: jsonb("diff_summary_json"),
    isCurrent: boolean("is_current").notNull().default(false),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("process_version_process_idx").on(table.processId),
    index("process_version_org_idx").on(table.orgId),
    uniqueIndex("process_version_unique").on(
      table.processId,
      table.versionNumber,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.3 ProcessStep — BPMN shapes synced from XML (Sprint 3, BPM)
// ──────────────────────────────────────────────────────────────

export const processStep = pgTable(
  "process_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    bpmnElementId: varchar("bpmn_element_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 500 }),
    description: text("description"),
    stepType: stepTypeEnum("step_type").notNull().default("task"),
    responsibleRole: varchar("responsible_role", { length: 255 }),
    sequenceOrder: integer("sequence_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("process_step_process_idx").on(table.processId),
    index("process_step_org_idx").on(table.orgId),
    uniqueIndex("process_step_unique").on(
      table.processId,
      table.bpmnElementId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.4 ProcessControl — Process ↔ Control join (Sprint 4 placeholder)
// ──────────────────────────────────────────────────────────────

export const processControl = pgTable(
  "process_control",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    controlId: uuid("control_id").notNull(), // FK → control added in Sprint 4
    controlContext: text("control_context"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("process_control_process_idx").on(table.processId),
    index("process_control_control_idx").on(table.controlId),
    index("process_control_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.5 ProcessStepControl — ProcessStep ↔ Control join (Sprint 4 placeholder)
// ──────────────────────────────────────────────────────────────

export const processStepControl = pgTable(
  "process_step_control",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processStepId: uuid("process_step_id")
      .notNull()
      .references(() => processStep.id, { onDelete: "cascade" }),
    controlId: uuid("control_id").notNull(), // FK → control added in Sprint 4
    controlContext: text("control_context"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("process_step_control_step_idx").on(table.processStepId),
    index("process_step_control_control_idx").on(table.controlId),
    index("process_step_control_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.6 ProcessAsset — Process ↔ Asset join (Gap 1)
// ──────────────────────────────────────────────────────────────

export const processAsset = pgTable(
  "process_asset",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("process_asset_process_idx").on(table.processId),
    index("process_asset_asset_idx").on(table.assetId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.7 ProcessStepAsset — ProcessStep ↔ Asset join (Gap 1)
// ──────────────────────────────────────────────────────────────

export const processStepAsset = pgTable(
  "process_step_asset",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processStepId: uuid("process_step_id")
      .notNull()
      .references(() => processStep.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("process_step_asset_step_idx").on(table.processStepId),
    index("process_step_asset_asset_idx").on(table.assetId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.9 ProcessReviewSchedule — Review cycle governance (Sprint 3b)
// ──────────────────────────────────────────────────────────────

export const processReviewSchedule = pgTable(
  "process_review_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    reviewIntervalMonths: integer("review_interval_months").notNull().default(12),
    nextReviewDate: date("next_review_date").notNull(),
    lastReminderSentAt: timestamp("last_reminder_sent_at", { withTimezone: true }),
    assignedReviewerId: uuid("assigned_reviewer_id").references(() => user.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("prs_org_idx").on(table.orgId),
    index("prs_next_review_idx").on(table.nextReviewDate),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.10 ProcessComment — Threaded comments on processes (Sprint 3b)
// ──────────────────────────────────────────────────────────────

export const processComment = pgTable(
  "process_comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 }).notNull().default("process"),
    entityId: uuid("entity_id").notNull(),
    content: text("content").notNull(),
    isResolved: boolean("is_resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => user.id),
    parentCommentId: uuid("parent_comment_id"),
    mentionedUserIds: text("mentioned_user_ids").array().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("pcmt_org_idx").on(table.orgId),
    index("pc_process_idx").on(table.processId),
    index("pc_entity_idx").on(table.entityType, table.entityId),
    index("pc_parent_idx").on(table.parentCommentId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.11 ProcessDocument — Process ↔ Document link (Gap 4, Sprint 4 DMS hook)
// ──────────────────────────────────────────────────────────────

export const processDocument = pgTable(
  "process_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull(), // No FK yet — Sprint 4 adds it
    documentType: varchar("document_type", { length: 50 }), // 'policy', 'procedure', 'guideline', 'sop', 'form'
    linkContext: text("link_context"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("process_document_process_idx").on(table.processId),
    index("process_document_document_idx").on(table.documentId),
  ],
);
