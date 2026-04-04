// Sprint 43: Audit Advanced — Working Papers, Resource Planning,
// Continuous Auditing, QA Review, External Auditor Portal

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { audit } from "./audit-mgmt";
import { finding } from "./control";

// ──────────────────────────────────────────────────────────────
// 43.1 audit_wp_folder — Self-referencing hierarchy per audit
// ──────────────────────────────────────────────────────────────

export const auditWpFolder = pgTable(
  "audit_wp_folder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audit.id, { onDelete: "cascade" }),
    parentFolderId: uuid("parent_folder_id").references(
      (): any => auditWpFolder.id,
    ),
    code: varchar("code", { length: 20 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("awf_audit_idx").on(table.auditId),
    index("awf_parent_idx").on(table.parentFolderId),
    uniqueIndex("awf_unique_code_idx").on(table.auditId, table.code),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.2 audit_working_paper — Core WP entity with 5 content sections
// ──────────────────────────────────────────────────────────────

export const auditWorkingPaper = pgTable(
  "audit_working_paper",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audit.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => auditWpFolder.id),
    reference: varchar("reference", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    objective: text("objective"),
    scope: text("scope"),
    procedurePerformed: text("procedure_performed"),
    results: text("results"),
    conclusion: text("conclusion"),
    evidenceDocumentIds: uuid("evidence_document_ids").array().default([]),
    crossReferenceWpIds: uuid("cross_reference_wp_ids").array().default([]),
    crossReferenceFindingIds: uuid("cross_reference_finding_ids")
      .array()
      .default([]),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    preparedBy: uuid("prepared_by").references(() => user.id),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("awp_audit_idx").on(table.auditId),
    index("awp_folder_idx").on(table.folderId),
    uniqueIndex("awp_unique_ref_idx").on(table.auditId, table.reference),
    index("awp_status_idx").on(table.auditId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.3 audit_wp_review_note — Inline review comments per section
// ──────────────────────────────────────────────────────────────

export const auditWpReviewNote = pgTable(
  "audit_wp_review_note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workingPaperId: uuid("working_paper_id")
      .notNull()
      .references(() => auditWorkingPaper.id, { onDelete: "cascade" }),
    section: varchar("section", { length: 30 }).notNull(),
    noteText: text("note_text").notNull(),
    severity: varchar("severity", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedBy: uuid("resolved_by").references(() => user.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("awrn_wp_idx").on(table.workingPaperId),
    index("awrn_status_idx").on(table.workingPaperId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.4 audit_wp_review_note_reply — Threaded replies
// ──────────────────────────────────────────────────────────────

export const auditWpReviewNoteReply = pgTable(
  "audit_wp_review_note_reply",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewNoteId: uuid("review_note_id")
      .notNull()
      .references(() => auditWpReviewNote.id, { onDelete: "cascade" }),
    replyText: text("reply_text").notNull(),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// ──────────────────────────────────────────────────────────────
// 43.5 auditor_profile — Skills, certs, capacity, hourly rate
// ──────────────────────────────────────────────────────────────

export const auditorProfile = pgTable(
  "auditor_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    seniority: varchar("seniority", { length: 20 }).notNull(),
    certifications: jsonb("certifications").default("[]"),
    skills: text("skills").array().default([]),
    availableHoursYear: integer("available_hours_year").notNull().default(1600),
    hourlyRate: numeric("hourly_rate", { precision: 8, scale: 2 }),
    team: varchar("team", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("aap_org_idx").on(table.orgId),
    uniqueIndex("ap_user_idx").on(table.userId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.6 audit_resource_allocation — Auditor-to-audit assignment
// ──────────────────────────────────────────────────────────────

export const auditResourceAllocation = pgTable(
  "audit_resource_allocation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audit.id, { onDelete: "cascade" }),
    auditorId: uuid("auditor_id")
      .notNull()
      .references(() => auditorProfile.id),
    role: varchar("role", { length: 20 }).notNull(),
    plannedHours: numeric("planned_hours", { precision: 8, scale: 2 }).notNull(),
    actualHours: numeric("actual_hours", { precision: 8, scale: 2 }).default(
      "0",
    ),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
  },
  (table) => [
    index("ara_audit_idx").on(table.auditId),
    index("ara_auditor_idx").on(table.auditorId),
    uniqueIndex("ara_unique_idx").on(table.auditId, table.auditorId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.7 audit_time_entry — Daily time logging (self-service)
// ──────────────────────────────────────────────────────────────

export const auditTimeEntry = pgTable(
  "audit_time_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    auditorId: uuid("auditor_id")
      .notNull()
      .references(() => auditorProfile.id),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audit.id),
    workDate: date("work_date", { mode: "string" }).notNull(),
    hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
    description: text("description"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ate_auditor_date_idx").on(table.auditorId, table.workDate),
    index("ate_audit_idx").on(table.auditId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.8 continuous_audit_rule — Rule definitions
// ──────────────────────────────────────────────────────────────

export const continuousAuditRule = pgTable(
  "continuous_audit_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    ruleType: varchar("rule_type", { length: 20 }).notNull(),
    dataSource: jsonb("data_source").notNull(),
    condition: jsonb("condition").notNull(),
    schedule: varchar("schedule", { length: 20 }).notNull().default("daily"),
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    riskArea: varchar("risk_area", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("car_org_idx").on(table.orgId),
    index("car_active_idx").on(table.orgId, table.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.9 continuous_audit_result — IMMUTABLE execution log
// ──────────────────────────────────────────────────────────────

export const continuousAuditResult = pgTable(
  "continuous_audit_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => continuousAuditRule.id),
    orgId: uuid("org_id").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resultStatus: varchar("result_status", { length: 20 }).notNull(),
    exceptionCount: integer("exception_count").notNull().default(0),
    executionTimeMs: integer("execution_time_ms"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("caresult_rule_idx").on(table.ruleId, table.executedAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.10 continuous_audit_exception — Exception lifecycle
// ──────────────────────────────────────────────────────────────

export const continuousAuditException = pgTable(
  "continuous_audit_exception",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => continuousAuditResult.id),
    ruleId: uuid("rule_id").notNull(),
    orgId: uuid("org_id").notNull(),
    description: text("description").notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    detail: jsonb("detail").default("{}"),
    status: varchar("status", { length: 20 }).notNull().default("new"),
    acknowledgedBy: uuid("acknowledged_by").references(() => user.id),
    acknowledgmentJustification: text("acknowledgment_justification"),
    escalatedFindingId: uuid("escalated_finding_id"),
    falsePositiveApprovedBy: uuid("false_positive_approved_by").references(
      () => user.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cae_result_idx").on(table.resultId),
    index("cae_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.11 audit_qa_review — One per audit engagement
// ──────────────────────────────────────────────────────────────

export const auditQaReview = pgTable(
  "audit_qa_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audit.id),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("assigned"),
    overallScore: integer("overall_score"),
    rating: varchar("rating", { length: 10 }),
    observations: text("observations"),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("aqr_audit_idx").on(table.auditId),
    index("aqr_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.12 audit_qa_checklist_item — 25 items across 5 sections
// ──────────────────────────────────────────────────────────────

export const auditQaChecklistItem = pgTable(
  "audit_qa_checklist_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    qaReviewId: uuid("qa_review_id")
      .notNull()
      .references(() => auditQaReview.id, { onDelete: "cascade" }),
    section: varchar("section", { length: 30 }).notNull(),
    itemNumber: integer("item_number").notNull(),
    itemText: text("item_text").notNull(),
    compliance: varchar("compliance", { length: 30 }),
    weight: integer("weight").notNull().default(3),
    reviewerComment: text("reviewer_comment"),
  },
  (table) => [index("aqci_review_idx").on(table.qaReviewId)],
);

// ──────────────────────────────────────────────────────────────
// 43.13 external_auditor_share — Entity-level sharing
// ──────────────────────────────────────────────────────────────

export const externalAuditorShare = pgTable(
  "external_auditor_share",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    externalUserId: uuid("external_user_id")
      .notNull()
      .references(() => user.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    accessLevel: varchar("access_level", { length: 20 })
      .notNull()
      .default("read_only"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sharedBy: uuid("shared_by").references(() => user.id),
    sharedAt: timestamp("shared_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("eas_external_idx").on(table.externalUserId),
    index("eas_entity_idx").on(table.entityType, table.entityId),
    index("eas_expiry_idx").on(table.expiresAt, table.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 43.14 external_auditor_activity — IMMUTABLE activity log
// ──────────────────────────────────────────────────────────────

export const externalAuditorActivity = pgTable(
  "external_auditor_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    externalUserId: uuid("external_user_id").notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    detail: jsonb("detail").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);
