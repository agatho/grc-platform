// Sprint 6: Business Continuity Management System (BCMS) Schema (Drizzle ORM)
// 12 entities: biaAssessment, biaProcessImpact, biaSupplierDependency,
// essentialProcess, bcp, bcpProcedure, bcpResource, continuityStrategy,
// crisisScenario, crisisTeamMember, crisisLog, bcExercise, bcExerciseFinding

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  date,
  numeric,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization, user } from "./platform";
import { process } from "./process";
import { asset } from "./asset";
import { finding } from "./control";
import { workItem } from "./work-item";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const biaStatusEnum = pgEnum("bia_status", [
  "draft",
  "in_progress",
  "review",
  "approved",
  "archived",
]);

export const bcpStatusEnum = pgEnum("bcp_status", [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
  "superseded",
]);

export const crisisSeverityEnum = pgEnum("crisis_severity", [
  "level_1_incident",
  "level_2_emergency",
  "level_3_crisis",
  "level_4_catastrophe",
]);

export const crisisStatusEnum = pgEnum("crisis_status", [
  "standby",
  "activated",
  "resolved",
  "post_mortem",
]);

export const exerciseTypeEnum = pgEnum("exercise_type", [
  "tabletop",
  "walkthrough",
  "functional",
  "full_simulation",
]);

export const exerciseStatusEnum = pgEnum("exercise_status", [
  "planned",
  "preparation",
  "executing",
  "evaluation",
  "completed",
  "cancelled",
]);

export const strategyTypeEnum = pgEnum("strategy_type", [
  "active_active",
  "active_passive",
  "cold_standby",
  "manual_workaround",
  "outsource",
  "do_nothing",
]);

export const resourceTypeEnum = pgEnum("resource_type", [
  "people",
  "it_system",
  "facility",
  "supplier",
  "equipment",
  "data",
  "other",
]);

// ──────────────────────────────────────────────────────────────
// 6.1 BIA Assessment — Business Impact Analysis campaign
// ──────────────────────────────────────────────────────────────

export const biaAssessment = pgTable(
  "bia_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    status: biaStatusEnum("status").notNull().default("draft"),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    leadAssessorId: uuid("lead_assessor_id").references(() => user.id),
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
  (table) => [index("bia_org_idx").on(table.orgId)],
);

// ──────────────────────────────────────────────────────────────
// 6.2 BIA Process Impact — Per-process impact assessment
// ──────────────────────────────────────────────────────────────

export const biaProcessImpact = pgTable(
  "bia_process_impact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    biaAssessmentId: uuid("bia_assessment_id")
      .notNull()
      .references(() => biaAssessment.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id),
    // Recovery targets
    mtpdHours: integer("mtpd_hours"),
    rtoHours: integer("rto_hours"),
    rpoHours: integer("rpo_hours"),
    // Financial impact per time tier (EUR)
    impact1h: numeric("impact_1h", { precision: 15, scale: 2 }),
    impact4h: numeric("impact_4h", { precision: 15, scale: 2 }),
    impact24h: numeric("impact_24h", { precision: 15, scale: 2 }),
    impact72h: numeric("impact_72h", { precision: 15, scale: 2 }),
    impact1w: numeric("impact_1w", { precision: 15, scale: 2 }),
    impact1m: numeric("impact_1m", { precision: 15, scale: 2 }),
    // Qualitative impact dimensions (1-5)
    impactReputation: integer("impact_reputation"),
    impactLegal: integer("impact_legal"),
    impactOperational: integer("impact_operational"),
    impactFinancial: integer("impact_financial"),
    impactSafety: integer("impact_safety"),
    // Dependencies
    criticalResources: text("critical_resources"),
    minimumStaff: integer("minimum_staff"),
    alternateLocation: varchar("alternate_location", { length: 500 }),
    peakPeriods: text("peak_periods"),
    dependenciesJson: jsonb("dependencies_json").default({}),
    // Priority
    priorityRanking: integer("priority_ranking"),
    isEssential: boolean("is_essential").notNull().default(false),
    // Assessor
    assessedBy: uuid("assessed_by").references(() => user.id),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bpi_bia_idx").on(table.biaAssessmentId),
    index("bpi_process_idx").on(table.processId),
    uniqueIndex("bpi_unique").on(table.biaAssessmentId, table.processId),
  ],
);

export const biaProcessImpactRelations = relations(
  biaProcessImpact,
  ({ one }) => ({
    biaAssessment: one(biaAssessment, {
      fields: [biaProcessImpact.biaAssessmentId],
      references: [biaAssessment.id],
    }),
    process: one(process, {
      fields: [biaProcessImpact.processId],
      references: [process.id],
    }),
    assessor: one(user, {
      fields: [biaProcessImpact.assessedBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 6.3 BIA Supplier Dependency — Supplier dependencies per impact
// ──────────────────────────────────────────────────────────────

export const biaSupplierDependency = pgTable("bia_supplier_dependency", {
  id: uuid("id").primaryKey().defaultRandom(),
  biaProcessImpactId: uuid("bia_process_impact_id")
    .notNull()
    .references(() => biaProcessImpact.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  supplierName: varchar("supplier_name", { length: 500 }).notNull(),
  vendorId: uuid("vendor_id"), // FK to vendor table if Sprint 9 done
  service: varchar("service", { length: 500 }),
  isCritical: boolean("is_critical").notNull().default(false),
  alternativeAvailable: boolean("alternative_available")
    .notNull()
    .default(false),
  switchoverTimeHours: integer("switchover_time_hours"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ──────────────────────────────────────────────────────────────
// 6.4 Essential Process — BIA result: auto-flagged essential
// ──────────────────────────────────────────────────────────────

export const essentialProcess = pgTable(
  "essential_process",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id),
    biaAssessmentId: uuid("bia_assessment_id").references(
      () => biaAssessment.id,
    ),
    priorityRanking: integer("priority_ranking").notNull(),
    mtpdHours: integer("mtpd_hours").notNull(),
    rtoHours: integer("rto_hours").notNull(),
    justification: text("justification"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ep_unique_process").on(table.orgId, table.processId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 6.5 BCP — Business Continuity Plan (approval workflow)
// ──────────────────────────────────────────────────────────────

export const bcp = pgTable(
  "bcp",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    status: bcpStatusEnum("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    scope: text("scope"),
    // Linked processes
    processIds: uuid("process_ids")
      .array()
      .default(sql`'{}'`),
    // Contacts
    bcManagerId: uuid("bc_manager_id").references(() => user.id),
    deputyManagerId: uuid("deputy_manager_id").references(() => user.id),
    // Activation criteria
    activationCriteria: text("activation_criteria"),
    activationAuthority: varchar("activation_authority", { length: 255 }),
    // Documents
    reportDocumentId: uuid("report_document_id"), // FK to document
    // Lifecycle
    lastTestedDate: date("last_tested_date", { mode: "string" }),
    nextReviewDate: date("next_review_date", { mode: "string" }),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
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
    index("bcp_org_idx").on(table.orgId),
    index("bcp_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 6.6 BCP Procedure — Ordered recovery steps
// ──────────────────────────────────────────────────────────────

export const bcpProcedure = pgTable(
  "bcp_procedure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bcpId: uuid("bcp_id")
      .notNull()
      .references(() => bcp.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    stepNumber: integer("step_number").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    responsibleRole: varchar("responsible_role", { length: 255 }),
    responsibleId: uuid("responsible_id").references(() => user.id),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    requiredResources: text("required_resources"),
    prerequisites: text("prerequisites"),
    successCriteria: text("success_criteria"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bcp_proc_bcp_idx").on(table.bcpId),
    index("bcp_proc_order_idx").on(table.bcpId, table.stepNumber),
  ],
);

// ──────────────────────────────────────────────────────────────
// 6.7 BCP Resource — Typed resources per BCP
// ──────────────────────────────────────────────────────────────

export const bcpResource = pgTable("bcp_resource", {
  id: uuid("id").primaryKey().defaultRandom(),
  bcpId: uuid("bcp_id")
    .notNull()
    .references(() => bcp.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  resourceType: resourceTypeEnum("resource_type").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  quantity: integer("quantity").default(1),
  assetId: uuid("asset_id").references(() => asset.id), // if IT system
  isAvailableOffsite: boolean("is_available_offsite").notNull().default(false),
  alternativeResource: varchar("alternative_resource", { length: 500 }),
  priority: varchar("priority", { length: 20 }).default("required"), // required, nice_to_have
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ──────────────────────────────────────────────────────────────
// 6.8 Continuity Strategy — 6 strategy types with cost/RTO
// ──────────────────────────────────────────────────────────────

export const continuityStrategy = pgTable(
  "continuity_strategy",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id),
    strategyType: strategyTypeEnum("strategy_type").notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    rtoTargetHours: integer("rto_target_hours").notNull(),
    rtoActualHours: integer("rto_actual_hours"),
    estimatedCostEur: numeric("estimated_cost_eur", {
      precision: 15,
      scale: 2,
    }),
    annualCostEur: numeric("annual_cost_eur", { precision: 15, scale: 2 }),
    effortHours: numeric("effort_hours", { precision: 8, scale: 2 }),
    costCurrency: varchar("cost_currency", { length: 3 }).default("EUR"),
    budgetId: uuid("budget_id"),
    costNote: text("cost_note"),
    // Resource requirements
    requiredStaff: integer("required_staff"),
    requiredSystems: text("required_systems"),
    alternateLocation: varchar("alternate_location", { length: 500 }),
    // Status
    isActive: boolean("is_active").notNull().default(false),
    lastTestedDate: date("last_tested_date", { mode: "string" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [index("cs_process_idx").on(table.processId)],
);

// ──────────────────────────────────────────────────────────────
// 6.9 Crisis Scenario — Pre-defined crisis playbooks
// ──────────────────────────────────────────────────────────────

export const crisisScenario = pgTable("crisis_scenario", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(), // cyber_attack, fire, pandemic, supply_chain, natural_disaster, it_outage
  severity: crisisSeverityEnum("severity")
    .notNull()
    .default("level_2_emergency"),
  status: crisisStatusEnum("status").notNull().default("standby"),
  // Escalation
  escalationMatrix: jsonb("escalation_matrix").default([]),
  communicationTemplate: text("communication_template"),
  bcpId: uuid("bcp_id").references(() => bcp.id), // linked BCP
  // Active crisis fields
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  activatedBy: uuid("activated_by").references(() => user.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  postMortemNotes: text("post_mortem_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid("created_by").references(() => user.id),
});

// ──────────────────────────────────────────────────────────────
// 6.10 Crisis Team Member — Crisis response team composition
// ──────────────────────────────────────────────────────────────

export const crisisTeamMember = pgTable("crisis_team_member", {
  id: uuid("id").primaryKey().defaultRandom(),
  crisisScenarioId: uuid("crisis_scenario_id")
    .notNull()
    .references(() => crisisScenario.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  role: varchar("role", { length: 100 }).notNull(), // crisis_lead, communication, technical, logistics, legal
  isPrimary: boolean("is_primary").notNull().default(true),
  deputyUserId: uuid("deputy_user_id").references(() => user.id),
  phoneNumber: varchar("phone_number", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ──────────────────────────────────────────────────────────────
// 6.11 Crisis Log — Immutable crisis event log (append-only)
// ──────────────────────────────────────────────────────────────

export const crisisLog = pgTable("crisis_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  crisisScenarioId: uuid("crisis_scenario_id")
    .notNull()
    .references(() => crisisScenario.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  entryType: varchar("entry_type", { length: 50 }).notNull(), // decision, communication, action, status_change, observation
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  createdBy: uuid("created_by").references(() => user.id),
});

// ──────────────────────────────────────────────────────────────
// 6.12 BC Exercise — Business continuity exercises
// ──────────────────────────────────────────────────────────────

export const bcExercise = pgTable("bc_exercise", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  workItemId: uuid("work_item_id").references(() => workItem.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  exerciseType: exerciseTypeEnum("exercise_type").notNull(),
  status: exerciseStatusEnum("status").notNull().default("planned"),
  // Scope
  crisisScenarioId: uuid("crisis_scenario_id").references(
    () => crisisScenario.id,
  ),
  bcpId: uuid("bcp_id").references(() => bcp.id),
  // Schedule
  plannedDate: date("planned_date", { mode: "string" }).notNull(),
  plannedDurationHours: integer("planned_duration_hours"),
  actualDate: date("actual_date", { mode: "string" }),
  actualDurationHours: integer("actual_duration_hours"),
  // Team
  exerciseLeadId: uuid("exercise_lead_id").references(() => user.id),
  participantIds: uuid("participant_ids")
    .array()
    .default(sql`'{}'`),
  observerIds: uuid("observer_ids")
    .array()
    .default(sql`'{}'`),
  // Results
  objectives: jsonb("objectives").default([]),
  lessonsLearned: text("lessons_learned"),
  overallResult: varchar("overall_result", { length: 50 }), // successful, partially_successful, failed
  reportDocumentId: uuid("report_document_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid("created_by").references(() => user.id),
});

// ──────────────────────────────────────────────────────────────
// 6.13 BC Exercise Finding — Links to Sprint 4 finding entity
// ──────────────────────────────────────────────────────────────

export const bcExerciseFinding = pgTable("bc_exercise_finding", {
  id: uuid("id").primaryKey().defaultRandom(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => bcExercise.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  findingId: uuid("finding_id").references(() => finding.id), // shared Finding entity from Sprint 4
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 20 }).notNull(), // critical, major, minor, observation
  recommendation: text("recommendation"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid("created_by").references(() => user.id),
});
