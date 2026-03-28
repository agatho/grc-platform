// Sprint 37: EAM Advanced — Data Flows, Interfaces, Technology Radar,
// Change Requests, Health Snapshots, Cloud Catalog

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
import { architectureElement } from "./eam";

// ──────────────────────────────────────────────────────────────
// Data Flow
// ──────────────────────────────────────────────────────────────

export const dataFlow = pgTable(
  "data_flow",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceElementId: uuid("source_element_id")
      .notNull()
      .references(() => architectureElement.id),
    targetElementId: uuid("target_element_id")
      .notNull()
      .references(() => architectureElement.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    dataCategories: text("data_categories").array().notNull(),
    containsPersonalData: boolean("contains_personal_data")
      .notNull()
      .default(false),
    transferMechanism: varchar("transfer_mechanism", { length: 50 }).notNull(),
    encryptionInTransit: varchar("encryption_in_transit", { length: 20 }).default(
      "tls",
    ),
    encryptionAtRest: varchar("encryption_at_rest", { length: 20 }).default(
      "aes256",
    ),
    frequency: varchar("frequency", { length: 20 }).notNull(),
    volumePerDay: varchar("volume_per_day", { length: 100 }),
    hostingSource: varchar("hosting_source", { length: 5 }),
    hostingTarget: varchar("hosting_target", { length: 5 }),
    crossesEuBorder: boolean("crosses_eu_border").notNull().default(false),
    legalBasis: varchar("legal_basis", { length: 50 }),
    schremsIiSafeguard: varchar("schrems_ii_safeguard", { length: 50 }),
    ropaEntryId: uuid("ropa_entry_id"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("df_org_idx").on(table.orgId),
    sourceIdx: index("df_source_idx").on(table.sourceElementId),
    targetIdx: index("df_target_idx").on(table.targetElementId),
    personalDataIdx: index("df_personal_idx").on(
      table.orgId,
      table.containsPersonalData,
    ),
    crossBorderIdx: index("df_cross_border_idx").on(
      table.orgId,
      table.crossesEuBorder,
    ),
  }),
);

export const dataFlowRelations = relations(dataFlow, ({ one }) => ({
  organization: one(organization, {
    fields: [dataFlow.orgId],
    references: [organization.id],
  }),
  sourceElement: one(architectureElement, {
    fields: [dataFlow.sourceElementId],
    references: [architectureElement.id],
    relationName: "dataFlowSource",
  }),
  targetElement: one(architectureElement, {
    fields: [dataFlow.targetElementId],
    references: [architectureElement.id],
    relationName: "dataFlowTarget",
  }),
}));

// ──────────────────────────────────────────────────────────────
// Application Interface
// ──────────────────────────────────────────────────────────────

export const applicationInterface = pgTable(
  "application_interface",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    elementId: uuid("element_id")
      .notNull()
      .references(() => architectureElement.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    interfaceType: varchar("interface_type", { length: 30 }).notNull(),
    direction: varchar("direction", { length: 20 }).notNull(),
    protocol: varchar("protocol", { length: 30 }),
    authentication: varchar("authentication", { length: 30 }),
    dataFormat: varchar("data_format", { length: 20 }),
    slaAvailability: numeric("sla_availability", { precision: 5, scale: 2 }),
    documentationUrl: varchar("documentation_url", { length: 2000 }),
    healthCheckUrl: varchar("health_check_url", { length: 2000 }),
    healthStatus: varchar("health_status", { length: 20 }).default("unknown"),
    lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    elementIdx: index("ai_element_idx").on(table.elementId),
    orgIdx: index("appintf_org_idx").on(table.orgId),
    healthIdx: index("ai_health_idx").on(table.orgId, table.healthStatus),
  }),
);

export const applicationInterfaceRelations = relations(
  applicationInterface,
  ({ one }) => ({
    element: one(architectureElement, {
      fields: [applicationInterface.elementId],
      references: [architectureElement.id],
    }),
    organization: one(organization, {
      fields: [applicationInterface.orgId],
      references: [organization.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Technology Entry (Radar)
// ──────────────────────────────────────────────────────────────

export const technologyEntry = pgTable(
  "technology_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 300 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    quadrant: varchar("quadrant", { length: 30 }).notNull(),
    ring: varchar("ring", { length: 20 }).notNull(),
    versionInUse: varchar("version_in_use", { length: 100 }),
    latestVersion: varchar("latest_version", { length: 100 }),
    vendor: varchar("vendor", { length: 300 }),
    description: text("description"),
    rationale: text("rationale"),
    movedFrom: varchar("moved_from", { length: 20 }),
    movedAt: timestamp("moved_at", { withTimezone: true }),
    websiteUrl: varchar("website_url", { length: 2000 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("te_org_idx").on(table.orgId),
    ringIdx: index("te_ring_idx").on(table.orgId, table.ring),
    categoryIdx: index("te_category_idx").on(table.orgId, table.category),
  }),
);

export const technologyEntryRelations = relations(
  technologyEntry,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [technologyEntry.orgId],
      references: [organization.id],
    }),
    applicationLinks: many(technologyApplicationLink),
  }),
);

// ──────────────────────────────────────────────────────────────
// Technology ↔ Application Link
// ──────────────────────────────────────────────────────────────

export const technologyApplicationLink = pgTable(
  "technology_application_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyId: uuid("technology_id")
      .notNull()
      .references(() => technologyEntry.id, { onDelete: "cascade" }),
    elementId: uuid("element_id")
      .notNull()
      .references(() => architectureElement.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    versionUsed: varchar("version_used", { length: 100 }),
    notes: text("notes"),
  },
  (table) => ({
    uniqueLink: uniqueIndex("tal_unique_idx").on(
      table.technologyId,
      table.elementId,
    ),
    techIdx: index("tal_tech_idx").on(table.technologyId),
    elementIdx: index("tal_element_idx").on(table.elementId),
  }),
);

export const technologyApplicationLinkRelations = relations(
  technologyApplicationLink,
  ({ one }) => ({
    technology: one(technologyEntry, {
      fields: [technologyApplicationLink.technologyId],
      references: [technologyEntry.id],
    }),
    element: one(architectureElement, {
      fields: [technologyApplicationLink.elementId],
      references: [architectureElement.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Architecture Change Request
// ──────────────────────────────────────────────────────────────

export const architectureChangeRequest = pgTable(
  "architecture_change_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description").notNull(),
    justification: text("justification"),
    changeType: varchar("change_type", { length: 30 }).notNull(),
    affectedElementIds: uuid("affected_element_ids").array().notNull().default([]),
    riskAssessment: varchar("risk_assessment", { length: 20 }).default("medium"),
    costEstimate: numeric("cost_estimate", { precision: 15, scale: 2 }),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    submittedBy: uuid("submitted_by").references(() => user.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    decisionRationale: text("decision_rationale"),
    conditions: text("conditions"),
    implementationDeadline: date("implementation_deadline"),
    impactSummary: jsonb("impact_summary").default("{}"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("acr_org_idx").on(table.orgId),
    statusIdx: index("acr_status_idx").on(table.orgId, table.status),
  }),
);

export const architectureChangeRequestRelations = relations(
  architectureChangeRequest,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [architectureChangeRequest.orgId],
      references: [organization.id],
    }),
    votes: many(architectureChangeVote),
  }),
);

// ──────────────────────────────────────────────────────────────
// Architecture Change Vote
// ──────────────────────────────────────────────────────────────

export const architectureChangeVote = pgTable(
  "architecture_change_vote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    changeRequestId: uuid("change_request_id")
      .notNull()
      .references(() => architectureChangeRequest.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    vote: varchar("vote", { length: 20 }).notNull(),
    comment: text("comment"),
    votedAt: timestamp("voted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueVote: uniqueIndex("acv_unique_idx").on(
      table.changeRequestId,
      table.userId,
    ),
  }),
);

export const architectureChangeVoteRelations = relations(
  architectureChangeVote,
  ({ one }) => ({
    changeRequest: one(architectureChangeRequest, {
      fields: [architectureChangeVote.changeRequestId],
      references: [architectureChangeRequest.id],
    }),
    voter: one(user, {
      fields: [architectureChangeVote.userId],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Architecture Health Snapshot
// ──────────────────────────────────────────────────────────────

export const architectureHealthSnapshot = pgTable(
  "architecture_health_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    overallScore: integer("overall_score").notNull(),
    portfolioAgeScore: integer("portfolio_age_score"),
    technologyCurrencyScore: integer("technology_currency_score"),
    integrationComplexityScore: integer("integration_complexity_score"),
    spofCount: integer("spof_count"),
    ruleViolations: integer("rule_violations"),
    dataFlowComplianceScore: integer("data_flow_compliance_score"),
    technicalDebtEur: numeric("technical_debt_eur", {
      precision: 15,
      scale: 2,
    }),
    factorBreakdown: jsonb("factor_breakdown").default("{}"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ahs_org_idx").on(table.orgId),
    dateIdx: index("ahs_date_idx").on(table.orgId, table.snapshotAt),
  }),
);

export const architectureHealthSnapshotRelations = relations(
  architectureHealthSnapshot,
  ({ one }) => ({
    organization: one(organization, {
      fields: [architectureHealthSnapshot.orgId],
      references: [organization.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Cloud Service Catalog (Seed-only, read-only)
// ──────────────────────────────────────────────────────────────

export const cloudServiceCatalog = pgTable(
  "cloud_service_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 20 }).notNull(),
    serviceName: varchar("service_name", { length: 200 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    description: text("description"),
    architectureType: varchar("architecture_type", { length: 30 }).notNull(),
    regionAvailability: text("region_availability").array(),
  },
  (table) => ({
    providerIdx: index("csc_provider_idx").on(table.provider),
    categoryIdx: index("csc_category_idx").on(table.provider, table.category),
  }),
);
