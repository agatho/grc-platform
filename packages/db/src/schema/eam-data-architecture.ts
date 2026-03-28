// Sprint 50: EAM Data Architecture & Scenario Planning
// Tables: eam_data_object, eam_data_object_crud, eam_context, eam_context_attribute,
//         eam_org_unit, eam_business_context

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
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { architectureElement, businessCapability } from "./eam";
import { process } from "./process";

// ──────────────────────────────────────────────────────────────
// EAM Data Object (hierarchical)
// ──────────────────────────────────────────────────────────────

export const eamDataObject = pgTable(
  "eam_data_object",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    parentId: uuid("parent_id"),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    dataCategory: varchar("data_category", { length: 30 }).notNull(),
    classification: varchar("classification", { length: 20 }).default("internal"),
    ownerApplicationId: uuid("owner_application_id").references(
      () => architectureElement.id,
    ),
    dataFormat: varchar("data_format", { length: 50 }),
    volumeEstimate: varchar("volume_estimate", { length: 100 }),
    qualityScore: integer("quality_score"),
    retentionPeriod: varchar("retention_period", { length: 50 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("edo_org_idx").on(table.orgId),
    parentIdx: index("edo_parent_idx").on(table.parentId),
    ownerIdx: index("edo_owner_idx").on(table.ownerApplicationId),
    categoryIdx: index("edo_category_idx").on(table.orgId, table.dataCategory),
  }),
);

export const eamDataObjectRelations = relations(
  eamDataObject,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [eamDataObject.orgId],
      references: [organization.id],
    }),
    parent: one(eamDataObject, {
      fields: [eamDataObject.parentId],
      references: [eamDataObject.id],
      relationName: "dataObjectHierarchy",
    }),
    children: many(eamDataObject, { relationName: "dataObjectHierarchy" }),
    ownerApplication: one(architectureElement, {
      fields: [eamDataObject.ownerApplicationId],
      references: [architectureElement.id],
    }),
    crudMappings: many(eamDataObjectCrud),
  }),
);

// ──────────────────────────────────────────────────────────────
// EAM Data Object CRUD Mapping (per data object x application)
// ──────────────────────────────────────────────────────────────

export const eamDataObjectCrud = pgTable(
  "eam_data_object_crud",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataObjectId: uuid("data_object_id")
      .notNull()
      .references(() => eamDataObject.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => architectureElement.id),
    orgId: uuid("org_id").notNull(),
    canCreate: boolean("can_create").notNull().default(false),
    canRead: boolean("can_read").notNull().default(false),
    canUpdate: boolean("can_update").notNull().default(false),
    canDelete: boolean("can_delete").notNull().default(false),
    notes: text("notes"),
  },
  (table) => ({
    uniqueCrud: uniqueIndex("edoc_unique_idx").on(
      table.dataObjectId,
      table.applicationId,
    ),
    dataObjIdx: index("edoc_do_idx").on(table.dataObjectId),
    appIdx: index("edoc_app_idx").on(table.applicationId),
    orgIdx: index("edoc_org_idx").on(table.orgId),
  }),
);

export const eamDataObjectCrudRelations = relations(
  eamDataObjectCrud,
  ({ one }) => ({
    dataObject: one(eamDataObject, {
      fields: [eamDataObjectCrud.dataObjectId],
      references: [eamDataObject.id],
    }),
    application: one(architectureElement, {
      fields: [eamDataObjectCrud.applicationId],
      references: [architectureElement.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// EAM Context (AS-IS / TO-BE / Scenario)
// ──────────────────────────────────────────────────────────────

export const eamContext = pgTable(
  "eam_context",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    contextType: varchar("context_type", { length: 20 }).notNull(),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    isDefault: boolean("is_default").notNull().default(false),
    predecessorContextId: uuid("predecessor_context_id"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ectx_org_idx").on(table.orgId),
    defaultIdx: uniqueIndex("ectx_default_idx")
      .on(table.orgId)
      .where(sql`is_default = true`),
    typeIdx: index("ectx_type_idx").on(table.orgId, table.contextType),
  }),
);

export const eamContextRelations = relations(eamContext, ({ one, many }) => ({
  organization: one(organization, {
    fields: [eamContext.orgId],
    references: [organization.id],
  }),
  predecessor: one(eamContext, {
    fields: [eamContext.predecessorContextId],
    references: [eamContext.id],
    relationName: "contextPredecessor",
  }),
  attributes: many(eamContextAttribute),
}));

// ──────────────────────────────────────────────────────────────
// EAM Context Attribute (per-element per-context overrides)
// ──────────────────────────────────────────────────────────────

export const eamContextAttribute = pgTable(
  "eam_context_attribute",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contextId: uuid("context_id")
      .notNull()
      .references(() => eamContext.id, { onDelete: "cascade" }),
    elementId: uuid("element_id")
      .notNull()
      .references(() => architectureElement.id),
    orgId: uuid("org_id").notNull(),
    functionalFit: varchar("functional_fit", { length: 20 }),
    technicalFit: varchar("technical_fit", { length: 20 }),
    timeClassification: varchar("time_classification", { length: 20 }),
    sixRStrategy: varchar("six_r_strategy", { length: 20 }),
    businessCriticality: varchar("business_criticality", { length: 30 }),
    lifecycleStatus: varchar("lifecycle_status", { length: 20 }),
    notes: text("notes"),
  },
  (table) => ({
    uniqueOverride: uniqueIndex("eca_unique_idx").on(
      table.contextId,
      table.elementId,
    ),
    contextIdx: index("eca_ctx_idx").on(table.contextId),
    elementIdx: index("eca_elem_idx").on(table.elementId),
    orgIdx: index("eca_org_idx").on(table.orgId),
  }),
);

export const eamContextAttributeRelations = relations(
  eamContextAttribute,
  ({ one }) => ({
    context: one(eamContext, {
      fields: [eamContextAttribute.contextId],
      references: [eamContext.id],
    }),
    element: one(architectureElement, {
      fields: [eamContextAttribute.elementId],
      references: [architectureElement.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// EAM Organizational Unit (hierarchical)
// ──────────────────────────────────────────────────────────────

export const eamOrgUnit = pgTable(
  "eam_org_unit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    parentOrgUnitId: uuid("parent_org_unit_id"),
    name: varchar("name", { length: 300 }).notNull(),
    abbreviation: varchar("abbreviation", { length: 20 }),
    location: varchar("location", { length: 200 }),
    headUserId: uuid("head_user_id").references(() => user.id),
    headCount: integer("head_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("eou_org_idx").on(table.orgId),
    parentIdx: index("eou_parent_idx").on(table.parentOrgUnitId),
  }),
);

export const eamOrgUnitRelations = relations(eamOrgUnit, ({ one, many }) => ({
  organization: one(organization, {
    fields: [eamOrgUnit.orgId],
    references: [organization.id],
  }),
  parent: one(eamOrgUnit, {
    fields: [eamOrgUnit.parentOrgUnitId],
    references: [eamOrgUnit.id],
    relationName: "orgUnitHierarchy",
  }),
  children: many(eamOrgUnit, { relationName: "orgUnitHierarchy" }),
  head: one(user, {
    fields: [eamOrgUnit.headUserId],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// EAM Business Context (bridge: capability + process + org unit + apps)
// ──────────────────────────────────────────────────────────────

export const eamBusinessContext = pgTable(
  "eam_business_context",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    capabilityId: uuid("capability_id").references(
      () => businessCapability.id,
    ),
    processId: uuid("process_id").references(() => process.id),
    orgUnitId: uuid("org_unit_id").references(() => eamOrgUnit.id),
    applicationIds: uuid("application_ids").array().default(sql`'{}'`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ebc_org_idx").on(table.orgId),
    capIdx: index("ebc_cap_idx").on(table.capabilityId),
    processIdx: index("ebc_process_idx").on(table.processId),
    orgUnitIdx: index("ebc_ou_idx").on(table.orgUnitId),
  }),
);

export const eamBusinessContextRelations = relations(
  eamBusinessContext,
  ({ one }) => ({
    organization: one(organization, {
      fields: [eamBusinessContext.orgId],
      references: [organization.id],
    }),
    capability: one(businessCapability, {
      fields: [eamBusinessContext.capabilityId],
      references: [businessCapability.id],
    }),
    process: one(process, {
      fields: [eamBusinessContext.processId],
      references: [process.id],
    }),
    orgUnit: one(eamOrgUnit, {
      fields: [eamBusinessContext.orgUnitId],
      references: [eamOrgUnit.id],
    }),
  }),
);
