// Sprint 8: Audit Management Schema (Drizzle ORM)
// 8 entities: audit_universe_entry, audit_plan, audit_plan_item, audit,
// audit_activity, audit_checklist, audit_checklist_item, audit_evidence

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { workItem } from "./work-item";
import { control } from "./control";
import { evidence } from "./control";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const auditTypeEnum = pgEnum("audit_type", [
  "internal",
  "external",
  "certification",
  "surveillance",
  "follow_up",
]);

export const auditStatusEnum = pgEnum("audit_status", [
  "planned",
  "preparation",
  "fieldwork",
  "reporting",
  "review",
  "completed",
  "cancelled",
]);

export const auditPlanStatusEnum = pgEnum("audit_plan_status", [
  "draft",
  "approved",
  "active",
  "completed",
]);

export const checklistResultEnum = pgEnum("checklist_result", [
  "conforming",
  "nonconforming",
  "observation",
  "not_applicable",
]);

export const auditConclusionEnum = pgEnum("audit_conclusion", [
  "conforming",
  "minor_nonconformity",
  "major_nonconformity",
  "not_applicable",
]);

export const universeEntityTypeEnum = pgEnum("universe_entity_type", [
  "process",
  "department",
  "it_system",
  "vendor",
  "custom",
]);

export const checklistSourceTypeEnum = pgEnum("checklist_source_type", [
  "auto_controls",
  "template",
  "custom",
]);

// ──────────────────────────────────────────────────────────────
// 8.1 AuditUniverseEntry — Auditable entities registry
// ──────────────────────────────────────────────────────────────

export const auditUniverseEntry = pgTable(
  "audit_universe_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    entityType: universeEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id"),
    riskScore: integer("risk_score"),
    lastAuditDate: date("last_audit_date", { mode: "string" }),
    auditCycleMonths: integer("audit_cycle_months").default(12),
    nextAuditDue: date("next_audit_due", { mode: "string" }),
    priority: integer("priority"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("aue_org_idx").on(table.orgId),
    index("aue_entity_type_idx").on(table.orgId, table.entityType),
    index("aue_next_due_idx").on(table.orgId, table.nextAuditDue),
  ],
);

// ──────────────────────────────────────────────────────────────
// 8.2 AuditPlan — Annual / periodic audit plans
// ──────────────────────────────────────────────────────────────

export const auditPlan = pgTable(
  "audit_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    year: integer("year").notNull(),
    description: text("description"),
    status: auditPlanStatusEnum("status").notNull().default("draft"),
    totalPlannedDays: integer("total_planned_days"),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("ap_org_year_idx").on(table.orgId, table.year),
    index("ap_org_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 8.3 AuditPlanItem — Individual items within an audit plan
// ──────────────────────────────────────────────────────────────

export const auditPlanItem = pgTable(
  "audit_plan_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    auditPlanId: uuid("audit_plan_id")
      .notNull()
      .references(() => auditPlan.id, { onDelete: "cascade" }),
    universeEntryId: uuid("universe_entry_id").references(
      () => auditUniverseEntry.id,
    ),
    title: varchar("title", { length: 500 }).notNull(),
    scopeDescription: text("scope_description"),
    plannedStart: date("planned_start", { mode: "string" }),
    plannedEnd: date("planned_end", { mode: "string" }),
    estimatedDays: integer("estimated_days"),
    leadAuditorId: uuid("lead_auditor_id").references(() => user.id),
    status: varchar("status", { length: 50 }).notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_plan_idx").on(table.auditPlanId),
    index("api_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 8.4 Audit — Core audit execution entity
// ──────────────────────────────────────────────────────────────

export const audit = pgTable(
  "audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    auditPlanItemId: uuid("audit_plan_item_id").references(
      () => auditPlanItem.id,
    ),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    auditType: auditTypeEnum("audit_type").notNull().default("internal"),
    status: auditStatusEnum("status").notNull().default("planned"),
    scopeDescription: text("scope_description"),
    scopeProcesses: text("scope_processes").array(),
    scopeDepartments: text("scope_departments").array(),
    scopeFrameworks: text("scope_frameworks").array(),
    leadAuditorId: uuid("lead_auditor_id").references(() => user.id),
    auditorIds: uuid("auditor_ids").array(),
    auditeeId: uuid("auditee_id").references(() => user.id),
    plannedStart: date("planned_start", { mode: "string" }),
    plannedEnd: date("planned_end", { mode: "string" }),
    actualStart: date("actual_start", { mode: "string" }),
    actualEnd: date("actual_end", { mode: "string" }),
    findingCount: integer("finding_count").default(0),
    conclusion: auditConclusionEnum("conclusion"),
    reportDocumentId: uuid("report_document_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("audit_org_status_idx").on(table.orgId, table.status),
    index("audit_org_type_idx").on(table.orgId, table.auditType),
    index("audit_lead_idx").on(table.leadAuditorId),
    index("audit_plan_item_idx").on(table.auditPlanItemId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 8.5 AuditActivity — Activity log per audit
// ──────────────────────────────────────────────────────────────

export const auditActivity = pgTable(
  "audit_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audit.id, { onDelete: "cascade" }),
    activityType: varchar("activity_type", { length: 100 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    performedBy: uuid("performed_by").references(() => user.id),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    duration: integer("duration"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("aa_audit_idx").on(table.auditId),
    index("aa_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 8.6 AuditChecklist — Checklist containers per audit
// ──────────────────────────────────────────────────────────────

export const auditChecklist = pgTable(
  "audit_checklist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audit.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 500 }).notNull(),
    sourceType: checklistSourceTypeEnum("source_type"),
    totalItems: integer("total_items").default(0),
    completedItems: integer("completed_items").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("acl_audit_idx").on(table.auditId),
    index("acl_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 8.7 AuditChecklistItem — Individual checklist questions
// ──────────────────────────────────────────────────────────────

export const auditChecklistItem = pgTable(
  "audit_checklist_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => auditChecklist.id, { onDelete: "cascade" }),
    controlId: uuid("control_id").references(() => control.id),
    question: text("question").notNull(),
    expectedEvidence: text("expected_evidence"),
    result: checklistResultEnum("result"),
    notes: text("notes"),
    evidenceIds: uuid("evidence_ids").array(),
    sortOrder: integer("sort_order").default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("aci_checklist_idx").on(table.checklistId),
    index("aci_org_idx").on(table.orgId),
    index("aci_control_idx").on(table.controlId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 8.8 AuditEvidence — Evidence linked to audits
// ──────────────────────────────────────────────────────────────

export const auditEvidence = pgTable(
  "audit_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audit.id),
    evidenceId: uuid("evidence_id").references(() => evidence.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    filePath: varchar("file_path", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("ae_audit_idx").on(table.auditId),
    index("aev_org_idx").on(table.orgId),
  ],
);
