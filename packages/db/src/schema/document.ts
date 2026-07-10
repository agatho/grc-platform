// Sprint 4: Document Management System (DMS) Schema (Drizzle ORM)
// 4 entities: document, document_version, acknowledgment, document_entity_link
// DMS Overhaul (D1–D4): effective dating + major/minor versioning,
// document_approval_step (multi-stage sign-off), retention_policy,
// document_file (multi-file attachments), SHA-256 integrity columns.
// Note: document.search_vector (GENERATED tsvector, migration 0356) is
// intentionally NOT modeled here — Drizzle must never write it; queries
// use raw sql`search_vector` fragments.

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";
import { workItem } from "./work-item";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const documentCategoryEnum = pgEnum("document_category", [
  "policy",
  "procedure",
  "guideline",
  "template",
  "record",
  "tom",
  "dpa",
  "bcp",
  "soa",
  "risk_assessment",
  "audit_report",
  "contract",
  "training_material",
  "process_description",
  "evidence",
  "meeting_minutes",
  "management_review",
  "certificate",
  "regulation",
  "other",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
  "expired",
]);

export const documentApprovalStepTypeEnum = pgEnum(
  "document_approval_step_type",
  ["review", "approval"],
);

export const documentApprovalStepStatusEnum = pgEnum(
  "document_approval_step_status",
  ["pending", "completed", "rejected"],
);

export const documentApprovalDecisionEnum = pgEnum(
  "document_approval_decision",
  ["approved", "rejected"],
);

export const retentionBasisEnum = pgEnum("retention_basis", [
  "created",
  "published",
  "expired",
]);

// ──────────────────────────────────────────────────────────────
// 4.6 Document — Core document entity (Sprint 4, DMS)
// ──────────────────────────────────────────────────────────────

export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content"),
    category: documentCategoryEnum("category").notNull().default("other"),
    status: documentStatusEnum("status").notNull().default("draft"),
    currentVersion: integer("current_version").notNull().default(1),
    requiresAcknowledgment: boolean("requires_acknowledgment")
      .notNull()
      .default(false),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`),
    ownerId: uuid("owner_id").references(() => user.id),
    reviewerId: uuid("reviewer_id").references(() => user.id),
    approverId: uuid("approver_id").references(() => user.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reviewDate: timestamp("review_date", { withTimezone: true }),
    // File storage (legacy inline fields — mirror the newest document_file)
    fileName: varchar("file_name", { length: 500 }),
    filePath: varchar("file_path", { length: 1000 }),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 255 }),
    fileSha256: varchar("file_sha256", { length: 64 }),
    // D2: staged review reminders (30/14/7/0 days, worker cron)
    lastReminderSentAt: timestamp("last_reminder_sent_at", {
      withTimezone: true,
    }),
    // D3: retention + legal hold
    retentionPolicyId: uuid("retention_policy_id").references(
      () => retentionPolicy.id,
      { onDelete: "set null" },
    ),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    legalHold: boolean("legal_hold").notNull().default(false),
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
    index("document_org_status_idx").on(table.orgId, table.status),
    index("document_category_idx").on(table.orgId, table.category),
    index("document_owner_idx").on(table.ownerId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4.7 DocumentVersion — Version snapshots (Sprint 4, DMS)
// ──────────────────────────────────────────────────────────────

export const documentVersion = pgTable(
  "document_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    versionNumber: integer("version_number").notNull(),
    content: text("content"),
    changeSummary: text("change_summary"),
    fileName: varchar("file_name", { length: 500 }),
    filePath: varchar("file_path", { length: 1000 }),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 255 }),
    fileSha256: varchar("file_sha256", { length: 64 }),
    isCurrent: boolean("is_current").notNull().default(false),
    // D1: effective dating — the window in which this version was the
    // governing document text (validUntil NULL = still open).
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    // D1: major/minor versioning ("2.1"). Minor bump on draft content
    // edit, major bump on publish.
    versionLabel: varchar("version_label", { length: 20 }),
    versionMajor: integer("version_major"),
    versionMinor: integer("version_minor"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("dv_document_idx").on(table.documentId),
    index("dv_org_idx").on(table.orgId),
    index("dv_document_valid_from_idx").on(table.documentId, table.validFrom),
    unique("dv_document_version_unique").on(
      table.documentId,
      table.versionNumber,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4.8 Acknowledgment — User document acknowledgments (Sprint 4, DMS)
// ──────────────────────────────────────────────────────────────

export const acknowledgment = pgTable(
  "acknowledgment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    versionAcknowledged: integer("version_acknowledged").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ack_org_idx").on(table.orgId),
    index("ack_document_idx").on(table.documentId),
    index("ack_user_idx").on(table.userId),
    unique("ack_document_user_unique").on(table.documentId, table.userId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4.9 DocumentEntityLink — Polymorphic document links (Sprint 4, DMS)
// ──────────────────────────────────────────────────────────────

export const documentEntityLink = pgTable(
  "document_entity_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    linkDescription: text("link_description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("del_org_idx_doc").on(table.orgId),
    index("del_document_idx").on(table.documentId),
    index("del_entity_idx").on(table.entityType, table.entityId),
  ],
);

// ──────────────────────────────────────────────────────────────
// D2: DocumentApprovalStep — multi-stage review/approval workflow
// ──────────────────────────────────────────────────────────────

export const documentApprovalStep = pgTable(
  "document_approval_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").references(() => documentVersion.id, {
      onDelete: "set null",
    }),
    stepOrder: integer("step_order").notNull(),
    stepType: documentApprovalStepTypeEnum("step_type")
      .notNull()
      .default("review"),
    assigneeUserId: uuid("assignee_user_id")
      .notNull()
      .references(() => user.id),
    status: documentApprovalStepStatusEnum("status")
      .notNull()
      .default("pending"),
    decision: documentApprovalDecisionEnum("decision"),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("das_org_idx").on(table.orgId),
    index("das_document_idx").on(table.documentId, table.stepOrder),
    index("das_assignee_status_idx").on(table.assigneeUserId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// D3: RetentionPolicy — document retention rules (GoBD/GDPR)
// ──────────────────────────────────────────────────────────────

export const retentionPolicy = pgTable(
  "retention_policy",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    retentionYears: integer("retention_years").notNull(),
    basis: retentionBasisEnum("basis").notNull().default("created"),
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
  (table) => [index("retention_policy_org_idx").on(table.orgId)],
);

// ──────────────────────────────────────────────────────────────
// D4: DocumentFile — multiple attachments per document
// ──────────────────────────────────────────────────────────────

export const documentFile = pgTable(
  "document_file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    // Snapshot: which document_version this file belonged to when it
    // was uploaded (NULL for legacy rows; backfilled on next version).
    versionId: uuid("version_id").references(() => documentVersion.id, {
      onDelete: "set null",
    }),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    filePath: varchar("file_path", { length: 1000 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 255 }),
    sha256: varchar("sha256", { length: 64 }),
    uploadedBy: uuid("uploaded_by").references(() => user.id),
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
    index("df_org_idx").on(table.orgId),
    index("df_document_idx").on(table.documentId),
    index("df_version_idx").on(table.versionId),
  ],
);
