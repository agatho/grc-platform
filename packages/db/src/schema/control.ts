// Sprint 4: Internal Control System (ICS) Schema (Drizzle ORM)
// 5 entities: control, control_test_campaign, control_test, evidence, finding

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  integer,
  bigint,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";
import { risk } from "./risk";
import { workItem } from "./work-item";
import { task } from "./task";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const controlTypeEnum = pgEnum("control_type", [
  "preventive",
  "detective",
  "corrective",
]);

export const controlFreqEnum = pgEnum("control_freq", [
  "event_driven",
  "continuous",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annually",
  "ad_hoc",
]);

export const automationLevelEnum = pgEnum("automation_level", [
  "manual",
  "semi_automated",
  "fully_automated",
]);

export const controlStatusEnum = pgEnum("control_status", [
  "designed",
  "implemented",
  "effective",
  "ineffective",
  "retired",
]);

export const controlAssertionEnum = pgEnum("control_assertion", [
  "completeness",
  "accuracy",
  "obligations_and_rights",
  "fraud_prevention",
  "existence",
  "valuation",
  "presentation",
  "safeguarding_of_assets",
]);

export const testTypeEnum = pgEnum("test_type", [
  "design_effectiveness",
  "operating_effectiveness",
]);

export const testResultEnum = pgEnum("test_result", [
  "effective",
  "ineffective",
  "partially_effective",
  "not_tested",
]);

export const testStatusEnum = pgEnum("test_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "completed",
  "cancelled",
]);

export const findingSeverityEnum = pgEnum("finding_severity", [
  "observation",
  "recommendation",
  "improvement_requirement",
  "insignificant_nonconformity",
  "significant_nonconformity",
]);

export const findingStatusEnum = pgEnum("finding_status", [
  "identified",
  "in_remediation",
  "remediated",
  "verified",
  "accepted",
  "closed",
]);

export const findingSourceEnum = pgEnum("finding_source", [
  "control_test",
  "audit",
  "incident",
  "self_assessment",
  "external",
]);

export const evidenceCategoryEnum = pgEnum("evidence_category", [
  "screenshot",
  "document",
  "log_export",
  "email",
  "certificate",
  "report",
  "photo",
  "config_export",
  "other",
]);

// ──────────────────────────────────────────────────────────────
// 4.1 Control — Core control entity (Sprint 4, ICS)
// ──────────────────────────────────────────────────────────────

export const control = pgTable(
  "control",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id")
      .references(() => workItem.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    controlType: controlTypeEnum("control_type").notNull(),
    frequency: controlFreqEnum("frequency").notNull().default("event_driven"),
    automationLevel: automationLevelEnum("automation_level").notNull().default("manual"),
    status: controlStatusEnum("status").notNull().default("designed"),
    assertions: text("assertions")
      .array()
      .default(sql`'{}'::text[]`),
    ownerId: uuid("owner_id")
      .references(() => user.id),
    department: varchar("department", { length: 255 }),
    objective: text("objective"),
    testInstructions: text("test_instructions"),
    reviewDate: date("review_date"),
    // Catalog & Framework Layer hook (Sprint 4b)
    // FK to control_catalog_entry added via migration SQL
    catalogEntryId: uuid("catalog_entry_id"),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("control_org_status_idx").on(table.orgId, table.status),
    index("control_owner_idx").on(table.ownerId),
    index("control_type_idx").on(table.orgId, table.controlType),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4.2 ControlTestCampaign — Testing campaigns (Sprint 4, ICS)
// ──────────────────────────────────────────────────────────────

export const controlTestCampaign = pgTable(
  "control_test_campaign",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    status: campaignStatusEnum("status").notNull().default("draft"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    responsibleId: uuid("responsible_id")
      .references(() => user.id),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("ctc_org_status_idx").on(table.orgId, table.status),
    index("ctc_period_idx").on(table.periodStart, table.periodEnd),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4.3 ControlTest — Individual test executions (Sprint 4, ICS)
// ──────────────────────────────────────────────────────────────

export const controlTest = pgTable(
  "control_test",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id")
      .notNull()
      .references(() => control.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .references(() => controlTestCampaign.id),
    taskId: uuid("task_id")
      .references(() => task.id),
    testType: testTypeEnum("test_type").notNull(),
    status: testStatusEnum("status").notNull().default("planned"),
    todResult: testResultEnum("tod_result"),
    toeResult: testResultEnum("toe_result"),
    testerId: uuid("tester_id")
      .references(() => user.id),
    testDate: date("test_date"),
    sampleSize: integer("sample_size"),
    sampleDescription: text("sample_description"),
    conclusion: text("conclusion"),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("ct_org_idx").on(table.orgId),
    index("ct_control_idx").on(table.controlId),
    index("ct_campaign_idx").on(table.campaignId),
    index("ct_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4.4 Evidence — Polymorphic evidence attachments (Sprint 4)
// ──────────────────────────────────────────────────────────────

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    category: evidenceCategoryEnum("category").notNull().default("other"),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    filePath: varchar("file_path", { length: 1000 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 255 }),
    description: text("description"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("evidence_org_idx").on(table.orgId),
    index("evidence_entity_idx").on(table.entityType, table.entityId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4.5 Finding — Control findings/deficiencies (Sprint 4, ICS)
// ──────────────────────────────────────────────────────────────

export const finding = pgTable(
  "finding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id")
      .references(() => workItem.id),
    controlId: uuid("control_id")
      .references(() => control.id),
    controlTestId: uuid("control_test_id")
      .references(() => controlTest.id),
    riskId: uuid("risk_id")
      .references(() => risk.id),
    taskId: uuid("task_id")
      .references(() => task.id),
    // Sprint 8: FK to audit table (added via migration SQL, no import to avoid circular dep)
    auditId: uuid("audit_id"),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    severity: findingSeverityEnum("severity").notNull(),
    status: findingStatusEnum("status").notNull().default("identified"),
    source: findingSourceEnum("source").notNull().default("control_test"),
    ownerId: uuid("owner_id")
      .references(() => user.id),
    remediationPlan: text("remediation_plan"),
    remediationDueDate: date("remediation_due_date"),
    remediatedAt: timestamp("remediated_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by")
      .references(() => user.id),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("finding_org_status_idx").on(table.orgId, table.status),
    index("finding_control_idx").on(table.controlId),
    index("finding_test_idx").on(table.controlTestId),
    index("finding_risk_idx").on(table.riskId),
    index("finding_owner_idx").on(table.ownerId),
    index("finding_severity_idx").on(table.orgId, table.severity),
  ],
);
