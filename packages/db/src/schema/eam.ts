// Sprint 36: Enterprise Architecture Management (EAM) Foundation
// Tables: architecture_element, architecture_relationship, business_capability,
//         application_portfolio, architecture_rule, architecture_rule_violation

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
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { asset } from "./asset";
import { process } from "./process";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const architectureLayerEnum = pgEnum("architecture_layer", [
  "business",
  "application",
  "technology",
]);

export const architectureTypeEnum = pgEnum("architecture_type", [
  "business_capability",
  "business_service",
  "business_function",
  "application",
  "app_service",
  "app_interface",
  "app_component",
  "data_object",
  "server",
  "network",
  "cloud_service",
  "database",
  "infrastructure_service",
]);

export const archRelationshipTypeEnum = pgEnum("arch_relationship_type", [
  "realizes",
  "serves",
  "runs_on",
  "accesses",
  "flows_to",
  "composes",
  "depends_on",
  "deployed_on",
  "uses",
]);

// ──────────────────────────────────────────────────────────────
// Architecture Element
// ──────────────────────────────────────────────────────────────

export const architectureElement = pgTable(
  "architecture_element",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    layer: architectureLayerEnum("layer").notNull(),
    type: architectureTypeEnum("type").notNull(),
    assetId: uuid("asset_id").references(() => asset.id),
    processId: uuid("process_id").references(() => process.id),
    owner: uuid("owner").references(() => user.id),
    department: varchar("department", { length: 200 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    criticality: varchar("criticality", { length: 20 }).default("normal"),
    tags: text("tags").array(),
    metadata: jsonb("metadata").default("{}"),
    governanceStatus: varchar("governance_status", { length: 20 }).default("draft"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ae_org_idx").on(table.orgId),
    layerIdx: index("ae_layer_idx").on(table.orgId, table.layer),
    typeIdx: index("ae_type_idx").on(table.orgId, table.type),
    assetIdx: index("ae_asset_idx").on(table.assetId),
    statusIdx: index("ae_status_idx").on(table.orgId, table.status),
  }),
);

export const architectureElementRelations = relations(
  architectureElement,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [architectureElement.orgId],
      references: [organization.id],
    }),
    ownerUser: one(user, {
      fields: [architectureElement.owner],
      references: [user.id],
    }),
    linkedAsset: one(asset, {
      fields: [architectureElement.assetId],
      references: [asset.id],
    }),
    linkedProcess: one(process, {
      fields: [architectureElement.processId],
      references: [process.id],
    }),
    sourceRelationships: many(architectureRelationship, {
      relationName: "sourceElement",
    }),
    targetRelationships: many(architectureRelationship, {
      relationName: "targetElement",
    }),
    capability: one(businessCapability),
    portfolio: one(applicationPortfolio),
  }),
);

// ──────────────────────────────────────────────────────────────
// Architecture Relationship
// ──────────────────────────────────────────────────────────────

export const architectureRelationship = pgTable(
  "architecture_relationship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => architectureElement.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => architectureElement.id, { onDelete: "cascade" }),
    relationshipType: archRelationshipTypeEnum("relationship_type").notNull(),
    criticality: varchar("criticality", { length: 20 }).default("normal"),
    dataFlowDirection: varchar("data_flow_direction", { length: 20 }),
    description: text("description"),
    metadata: jsonb("metadata").default("{}"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("archrel_org_idx").on(table.orgId),
    sourceIdx: index("archrel_source_idx").on(table.sourceId),
    targetIdx: index("archrel_target_idx").on(table.targetId),
    uniqueRel: uniqueIndex("archrel_unique_idx").on(
      table.sourceId,
      table.targetId,
      table.relationshipType,
    ),
  }),
);

export const architectureRelationshipRelations = relations(
  architectureRelationship,
  ({ one }) => ({
    source: one(architectureElement, {
      fields: [architectureRelationship.sourceId],
      references: [architectureElement.id],
      relationName: "sourceElement",
    }),
    target: one(architectureElement, {
      fields: [architectureRelationship.targetId],
      references: [architectureElement.id],
      relationName: "targetElement",
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Business Capability (hierarchical)
// ──────────────────────────────────────────────────────────────

export const businessCapability = pgTable(
  "business_capability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    elementId: uuid("element_id")
      .notNull()
      .references(() => architectureElement.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    level: integer("level").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    maturityLevel: integer("maturity_level"),
    strategicImportance: varchar("strategic_importance", { length: 20 }),
  },
  (table) => ({
    orgIdx: index("bc_org_idx").on(table.orgId),
    parentIdx: index("bc_parent_idx").on(table.parentId),
    elementIdx: uniqueIndex("bc_element_idx").on(table.elementId),
  }),
);

export const businessCapabilityRelations = relations(
  businessCapability,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [businessCapability.orgId],
      references: [organization.id],
    }),
    element: one(architectureElement, {
      fields: [businessCapability.elementId],
      references: [architectureElement.id],
    }),
    parent: one(businessCapability, {
      fields: [businessCapability.parentId],
      references: [businessCapability.id],
      relationName: "parentChild",
    }),
    children: many(businessCapability, {
      relationName: "parentChild",
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Application Portfolio
// ──────────────────────────────────────────────────────────────

export const applicationPortfolio = pgTable(
  "application_portfolio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    elementId: uuid("element_id")
      .notNull()
      .references(() => architectureElement.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    vendorName: varchar("vendor_name", { length: 500 }),
    vendorId: uuid("vendor_id"),
    version: varchar("version", { length: 100 }),
    licenseType: varchar("license_type", { length: 50 }),
    plannedIntroduction: date("planned_introduction"),
    goLiveDate: date("go_live_date"),
    plannedEol: date("planned_eol"),
    lifecycleStatus: varchar("lifecycle_status", { length: 20 })
      .notNull()
      .default("active"),
    timeClassification: varchar("time_classification", { length: 20 }),
    businessValue: integer("business_value"),
    technicalCondition: integer("technical_condition"),
    annualCost: numeric("annual_cost", { precision: 15, scale: 2 }),
    userCount: integer("user_count"),
    costCenter: varchar("cost_center", { length: 100 }),
    hasApi: boolean("has_api").default(false),
    authMethod: varchar("auth_method", { length: 50 }),
    dataClassification: varchar("data_classification", { length: 20 }),
    sixRStrategy: varchar("six_r_strategy", { length: 20 }),
  },
  (table) => ({
    elementIdx: uniqueIndex("ap_element_idx").on(table.elementId),
    orgIdx: index("ap_org_idx").on(table.orgId),
    lifecycleIdx: index("ap_lifecycle_idx").on(
      table.orgId,
      table.lifecycleStatus,
    ),
    eolIdx: index("ap_eol_idx").on(table.orgId, table.plannedEol),
  }),
);

export const applicationPortfolioRelations = relations(
  applicationPortfolio,
  ({ one }) => ({
    element: one(architectureElement, {
      fields: [applicationPortfolio.elementId],
      references: [architectureElement.id],
    }),
    organization: one(organization, {
      fields: [applicationPortfolio.orgId],
      references: [organization.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Architecture Rule
// ──────────────────────────────────────────────────────────────

export const architectureRule = pgTable(
  "architecture_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    ruleType: varchar("rule_type", { length: 50 }).notNull(),
    condition: jsonb("condition").notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("warning"),
    isActive: boolean("is_active").notNull().default(true),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("archrule_org_idx").on(table.orgId),
    activeIdx: index("archrule_active_idx").on(table.orgId, table.isActive),
  }),
);

export const architectureRuleRelations = relations(
  architectureRule,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [architectureRule.orgId],
      references: [organization.id],
    }),
    violations: many(architectureRuleViolation),
  }),
);

// ──────────────────────────────────────────────────────────────
// Architecture Rule Violation
// ──────────────────────────────────────────────────────────────

export const architectureRuleViolation = pgTable(
  "architecture_rule_violation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => architectureRule.id, { onDelete: "cascade" }),
    elementId: uuid("element_id")
      .notNull()
      .references(() => architectureElement.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    violationDetail: text("violation_detail"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    acknowledgedBy: uuid("acknowledged_by").references(() => user.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index("archviol_org_idx").on(table.orgId),
    ruleIdx: index("archviol_rule_idx").on(table.ruleId),
    elementIdx: index("archviol_element_idx").on(table.elementId),
    statusIdx: index("archviol_status_idx").on(table.orgId, table.status),
  }),
);

export const architectureRuleViolationRelations = relations(
  architectureRuleViolation,
  ({ one }) => ({
    rule: one(architectureRule, {
      fields: [architectureRuleViolation.ruleId],
      references: [architectureRule.id],
    }),
    element: one(architectureElement, {
      fields: [architectureRuleViolation.elementId],
      references: [architectureElement.id],
    }),
  }),
);
