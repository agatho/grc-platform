// Sprint 40: ICS Advanced — CCM, SOX, Deficiency Management, Control Library, 3LoD Dashboard

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
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { control } from "./control";

// ──────────────────────────────────────────────────────────────
// ccm_connector — Continuous Control Monitoring connector config
// ──────────────────────────────────────────────────────────────

export const ccmConnector = pgTable(
  "ccm_connector",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 300 }).notNull(),
    connectorType: varchar("connector_type", { length: 50 }).notNull(),
    config: jsonb("config").notNull(),
    credentialRef: varchar("credential_ref", { length: 200 }),
    targetControlIds: jsonb("target_control_ids").notNull().default("[]"),
    schedule: varchar("schedule", { length: 20 }).notNull().default("daily"),
    evaluationRules: jsonb("evaluation_rules").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: varchar("last_run_status", { length: 20 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ccmc_org_idx").on(table.orgId),
    index("ccmc_type_idx").on(table.orgId, table.connectorType),
  ],
);

// ──────────────────────────────────────────────────────────────
// ccm_evidence — IMMUTABLE evidence log (no UPDATE, no DELETE)
// ──────────────────────────────────────────────────────────────

export const ccmEvidence = pgTable(
  "ccm_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => ccmConnector.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id")
      .notNull()
      .references(() => control.id),
    collectedAt: timestamp("collected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    rawData: jsonb("raw_data").notNull(),
    evaluationResult: varchar("evaluation_result", { length: 20 }).notNull(),
    evaluationDetail: text("evaluation_detail"),
    score: integer("score"),
  },
  (table) => [
    index("ccme_connector_idx").on(table.connectorId, table.collectedAt),
    index("ccme_control_idx").on(table.controlId, table.collectedAt),
    index("ccme_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// sox_scope — SOX scoping per fiscal year
// ──────────────────────────────────────────────────────────────

export const soxScope = pgTable(
  "sox_scope",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    fiscalYear: integer("fiscal_year").notNull(),
    inScopeProcessIds: jsonb("in_scope_process_ids").default("[]"),
    inScopeAccounts: jsonb("in_scope_accounts").default("[]"),
    inScopeLocationIds: jsonb("in_scope_location_ids").default("[]"),
    inScopeItSystemIds: jsonb("in_scope_it_system_ids").default("[]"),
    scopingCriteria: jsonb("scoping_criteria").default("{}"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ss_org_year_idx").on(table.orgId, table.fiscalYear),
  ],
);

// ──────────────────────────────────────────────────────────────
// sox_walkthrough — Control design evaluation per fiscal year
// ──────────────────────────────────────────────────────────────

export const soxWalkthrough = pgTable(
  "sox_walkthrough",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id")
      .notNull()
      .references(() => control.id),
    fiscalYear: integer("fiscal_year").notNull(),
    narrative: text("narrative").notNull(),
    inputs: text("inputs"),
    procedures: text("procedures"),
    outputs: text("outputs"),
    evidenceDescription: text("evidence_description"),
    controlDesignEffective: boolean("control_design_effective"),
    performedBy: uuid("performed_by").references(() => user.id),
    performedAt: timestamp("performed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sw_org_year_idx").on(table.orgId, table.fiscalYear),
    index("sw_control_idx").on(table.controlId),
  ],
);

// ──────────────────────────────────────────────────────────────
// control_deficiency — Deficiency lifecycle management
// ──────────────────────────────────────────────────────────────

export const controlDeficiency = pgTable(
  "control_deficiency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id")
      .notNull()
      .references(() => control.id),
    findingId: uuid("finding_id"),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    classification: varchar("classification", { length: 30 }).notNull(),
    rootCauseMethod: varchar("root_cause_method", { length: 20 }),
    rootCause: text("root_cause"),
    remediationPlan: text("remediation_plan"),
    remediationResponsible: uuid("remediation_responsible").references(
      () => user.id,
    ),
    remediationDeadline: date("remediation_deadline"),
    remediationStatus: varchar("remediation_status", { length: 20 })
      .notNull()
      .default("open"),
    retestDate: date("retest_date"),
    retestResult: varchar("retest_result", { length: 20 }),
    retestBy: uuid("retest_by").references(() => user.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cd_org_idx").on(table.orgId),
    index("cd_control_idx").on(table.controlId),
    index("cd_status_idx").on(table.orgId, table.remediationStatus),
  ],
);

// ──────────────────────────────────────────────────────────────
// control_library_entry — Shared control catalog (NOT org-scoped)
// ──────────────────────────────────────────────────────────────

export const controlLibraryEntry = pgTable(
  "control_library_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    controlRef: varchar("control_ref", { length: 50 }).notNull(),
    title: jsonb("title").notNull(),
    description: jsonb("description").notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    cobitDomain: varchar("cobit_domain", { length: 50 }),
    controlType: varchar("control_type", { length: 20 }).notNull(),
    frequency: varchar("frequency", { length: 20 }),
    automatable: boolean("automatable").notNull().default(false),
    frameworkMappings: jsonb("framework_mappings").notNull().default("[]"),
  },
  (table) => [
    index("cle_category_idx").on(table.category),
    index("cle_type_idx").on(table.controlType),
  ],
);

// ──────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────

export const ccmConnectorRelations = relations(ccmConnector, ({ one }) => ({
  organization: one(organization, {
    fields: [ccmConnector.orgId],
    references: [organization.id],
  }),
}));

export const ccmEvidenceRelations = relations(ccmEvidence, ({ one }) => ({
  connector: one(ccmConnector, {
    fields: [ccmEvidence.connectorId],
    references: [ccmConnector.id],
  }),
  control: one(control, {
    fields: [ccmEvidence.controlId],
    references: [control.id],
  }),
}));

export const soxScopeRelations = relations(soxScope, ({ one }) => ({
  organization: one(organization, {
    fields: [soxScope.orgId],
    references: [organization.id],
  }),
}));

export const soxWalkthroughRelations = relations(
  soxWalkthrough,
  ({ one }) => ({
    organization: one(organization, {
      fields: [soxWalkthrough.orgId],
      references: [organization.id],
    }),
    control: one(control, {
      fields: [soxWalkthrough.controlId],
      references: [control.id],
    }),
  }),
);

export const controlDeficiencyRelations = relations(
  controlDeficiency,
  ({ one }) => ({
    organization: one(organization, {
      fields: [controlDeficiency.orgId],
      references: [organization.id],
    }),
    control: one(control, {
      fields: [controlDeficiency.controlId],
      references: [control.id],
    }),
  }),
);
