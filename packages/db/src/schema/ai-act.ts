// Sprint 73: EU AI Act Governance Module
// Tables: ai_system, ai_conformity_assessment, ai_human_oversight_log,
//         ai_transparency_entry, ai_fria, ai_framework_mapping

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 73.1 AI System — AI System Inventory
// ──────────────────────────────────────────────────────────────

export const aiSystem = pgTable(
  "ai_system",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    systemCode: varchar("system_code", { length: 30 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    purpose: text("purpose"),
    aiTechnique: varchar("ai_technique", { length: 100 }), // machine_learning | deep_learning | nlp | computer_vision | expert_system | generative_ai
    riskClassification: varchar("risk_classification", { length: 20 }).notNull(), // unacceptable | high | limited | minimal
    riskJustification: text("risk_justification"),
    annexCategory: varchar("annex_category", { length: 50 }), // annex_i | annex_ii | annex_iii | annex_iv | none
    providerOrDeployer: varchar("provider_or_deployer", { length: 20 }).notNull(), // provider | deployer | both
    providerName: varchar("provider_name", { length: 500 }),
    providerJurisdiction: varchar("provider_jurisdiction", { length: 100 }),
    deploymentDate: date("deployment_date"),
    trainingData: jsonb("training_data").default("{}"), // {description, dataSource, biasAssessment, personalData}
    inputData: jsonb("input_data").default("{}"),
    outputData: jsonb("output_data").default("{}"),
    affectedPersons: jsonb("affected_persons").default("[]"), // [{category, count, vulnerableGroup}]
    technicalDocumentation: jsonb("technical_documentation").default("{}"),
    humanOversightRequired: boolean("human_oversight_required").notNull().default(false),
    transparencyObligations: jsonb("transparency_obligations").default("[]"),
    ownerId: uuid("owner_id").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | registered | under_review | compliant | non_compliant | decommissioned
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index("ai_sys_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("ai_sys_code_idx").on(table.orgId, table.systemCode),
    riskIdx: index("ai_sys_risk_idx").on(table.orgId, table.riskClassification),
    statusIdx: index("ai_sys_status_idx").on(table.orgId, table.status),
    ownerIdx: index("ai_sys_owner_idx").on(table.ownerId),
  }),
);

export const aiSystemRelations = relations(aiSystem, ({ one, many }) => ({
  organization: one(organization, {
    fields: [aiSystem.orgId],
    references: [organization.id],
  }),
  owner: one(user, {
    fields: [aiSystem.ownerId],
    references: [user.id],
  }),
  conformityAssessments: many(aiConformityAssessment),
  oversightLogs: many(aiHumanOversightLog),
  frias: many(aiFria),
}));

// ──────────────────────────────────────────────────────────────
// 73.2 AI Conformity Assessment
// ──────────────────────────────────────────────────────────────

export const aiConformityAssessment = pgTable(
  "ai_conformity_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    aiSystemId: uuid("ai_system_id")
      .notNull()
      .references(() => aiSystem.id, { onDelete: "cascade" }),
    assessmentCode: varchar("assessment_code", { length: 30 }).notNull(),
    assessmentType: varchar("assessment_type", { length: 50 }).notNull(), // self_assessment | third_party | notified_body
    assessorName: varchar("assessor_name", { length: 500 }),
    requirements: jsonb("requirements").default("[]"), // [{requirementId, description, status, evidence, notes}]
    overallResult: varchar("overall_result", { length: 20 }), // pass | fail | conditional | pending
    findings: jsonb("findings").default("[]"), // [{severity, description, recommendation}]
    certificateReference: varchar("certificate_reference", { length: 200 }),
    validFrom: date("valid_from"),
    validUntil: date("valid_until"),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | in_progress | completed | expired
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ai_ca_org_idx").on(table.orgId),
    systemIdx: index("ai_ca_system_idx").on(table.aiSystemId),
    codeIdx: uniqueIndex("ai_ca_code_idx").on(table.orgId, table.assessmentCode),
    resultIdx: index("ai_ca_result_idx").on(table.orgId, table.overallResult),
    statusIdx: index("ai_ca_status_idx").on(table.orgId, table.status),
  }),
);

export const aiConformityAssessmentRelations = relations(aiConformityAssessment, ({ one }) => ({
  organization: one(organization, {
    fields: [aiConformityAssessment.orgId],
    references: [organization.id],
  }),
  aiSystem: one(aiSystem, {
    fields: [aiConformityAssessment.aiSystemId],
    references: [aiSystem.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 73.3 AI Human Oversight Log
// ──────────────────────────────────────────────────────────────

export const aiHumanOversightLog = pgTable(
  "ai_human_oversight_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    aiSystemId: uuid("ai_system_id")
      .notNull()
      .references(() => aiSystem.id, { onDelete: "cascade" }),
    logType: varchar("log_type", { length: 50 }).notNull(), // decision_override | intervention | monitoring_check | bias_review | performance_review
    description: text("description"),
    riskLevel: varchar("risk_level", { length: 20 }), // low | medium | high | critical
    actionTaken: text("action_taken"),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ai_hol_org_idx").on(table.orgId),
    systemIdx: index("ai_hol_system_idx").on(table.aiSystemId),
    typeIdx: index("ai_hol_type_idx").on(table.orgId, table.logType),
    dateIdx: index("ai_hol_date_idx").on(table.orgId, table.reviewedAt),
  }),
);

export const aiHumanOversightLogRelations = relations(aiHumanOversightLog, ({ one }) => ({
  organization: one(organization, {
    fields: [aiHumanOversightLog.orgId],
    references: [organization.id],
  }),
  aiSystem: one(aiSystem, {
    fields: [aiHumanOversightLog.aiSystemId],
    references: [aiSystem.id],
  }),
  reviewer: one(user, {
    fields: [aiHumanOversightLog.reviewedBy],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 73.4 AI Transparency Register
// ──────────────────────────────────────────────────────────────

export const aiTransparencyEntry = pgTable(
  "ai_transparency_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    aiSystemId: uuid("ai_system_id")
      .notNull()
      .references(() => aiSystem.id, { onDelete: "cascade" }),
    entryType: varchar("entry_type", { length: 50 }).notNull(), // eu_database_registration | public_disclosure | user_notification | marking_labeling
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(),
    publicUrl: varchar("public_url", { length: 2000 }),
    registrationRef: varchar("registration_ref", { length: 200 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | published | updated | withdrawn
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ai_te_org_idx").on(table.orgId),
    systemIdx: index("ai_te_system_idx").on(table.aiSystemId),
    typeIdx: index("ai_te_type_idx").on(table.orgId, table.entryType),
    statusIdx: index("ai_te_status_idx").on(table.orgId, table.status),
  }),
);

export const aiTransparencyEntryRelations = relations(aiTransparencyEntry, ({ one }) => ({
  organization: one(organization, {
    fields: [aiTransparencyEntry.orgId],
    references: [organization.id],
  }),
  aiSystem: one(aiSystem, {
    fields: [aiTransparencyEntry.aiSystemId],
    references: [aiSystem.id],
  }),
  publisher: one(user, {
    fields: [aiTransparencyEntry.publishedBy],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 73.5 AI FRIA — Fundamental Rights Impact Assessment
// ──────────────────────────────────────────────────────────────

export const aiFria = pgTable(
  "ai_fria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    aiSystemId: uuid("ai_system_id")
      .notNull()
      .references(() => aiSystem.id, { onDelete: "cascade" }),
    assessmentCode: varchar("assessment_code", { length: 30 }).notNull(),
    rightsAssessed: jsonb("rights_assessed").default("[]"), // [{right, impact, mitigation, residualRisk}]
    discriminationRisk: jsonb("discrimination_risk").default("{}"), // {identifiedBiases, mitigationMeasures, monitoringPlan}
    dataProtectionImpact: jsonb("data_protection_impact").default("{}"),
    accessToJustice: jsonb("access_to_justice").default("{}"),
    overallImpact: varchar("overall_impact", { length: 20 }).notNull(), // high | medium | low | negligible
    mitigationMeasures: text("mitigation_measures"),
    nextReviewDate: date("next_review_date"),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | in_progress | completed | approved
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ai_fria_org_idx").on(table.orgId),
    systemIdx: index("ai_fria_system_idx").on(table.aiSystemId),
    codeIdx: uniqueIndex("ai_fria_code_idx").on(table.orgId, table.assessmentCode),
    impactIdx: index("ai_fria_impact_idx").on(table.orgId, table.overallImpact),
    statusIdx: index("ai_fria_status_idx").on(table.orgId, table.status),
  }),
);

export const aiFriaRelations = relations(aiFria, ({ one }) => ({
  organization: one(organization, {
    fields: [aiFria.orgId],
    references: [organization.id],
  }),
  aiSystem: one(aiSystem, {
    fields: [aiFria.aiSystemId],
    references: [aiSystem.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 73.6 AI Framework Mapping — ISO 42001 / NIST AI RMF
// ──────────────────────────────────────────────────────────────

export const aiFrameworkMapping = pgTable(
  "ai_framework_mapping",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    framework: varchar("framework", { length: 50 }).notNull(), // iso_42001 | nist_ai_rmf | eu_ai_act
    controlReference: varchar("control_reference", { length: 100 }).notNull(),
    controlTitle: varchar("control_title", { length: 500 }).notNull(),
    aiActArticle: varchar("ai_act_article", { length: 100 }),
    implementationStatus: varchar("implementation_status", { length: 20 }).notNull().default("not_started"), // not_started | in_progress | implemented | not_applicable
    evidenceIds: jsonb("evidence_ids").default("[]"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ai_fm_org_idx").on(table.orgId),
    fwIdx: index("ai_fm_fw_idx").on(table.orgId, table.framework),
    refIdx: uniqueIndex("ai_fm_ref_idx").on(table.orgId, table.framework, table.controlReference),
    statusIdx: index("ai_fm_status_idx").on(table.orgId, table.implementationStatus),
  }),
);

export const aiFrameworkMappingRelations = relations(aiFrameworkMapping, ({ one }) => ({
  organization: one(organization, {
    fields: [aiFrameworkMapping.orgId],
    references: [organization.id],
  }),
}));
