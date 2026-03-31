// Sprint 4b: Catalog & Framework Layer Schema (Drizzle ORM)
// 10 entities: risk_catalog, risk_catalog_entry, control_catalog, control_catalog_entry,
// general_catalog_entry, org_risk_methodology, org_active_catalog, org_catalog_exclusion,
// catalog_entry_reference, catalog_lifecycle_phase

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Generic catalog + catalog_entry — used by all seed data
// ──────────────────────────────────────────────────────────────

export const catalog = pgTable(
  "catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    catalogType: varchar("catalog_type", { length: 20 }).notNull(),
    scope: varchar("scope", { length: 20 }).notNull().default("platform"),
    source: varchar("source", { length: 100 }).notNull(),
    version: varchar("version", { length: 50 }),
    language: varchar("language", { length: 5 }).default("de"),
    isActive: boolean("is_active").notNull().default(true),
    targetModules: text("target_modules")
      .array()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("catalog_type_idx").on(table.catalogType),
    index("catalog_source_idx").on(table.source),
  ],
);

export const catalogEntry = pgTable(
  "catalog_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => catalog.id, { onDelete: "cascade" }),
    parentEntryId: uuid("parent_entry_id"),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    level: integer("level").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("catalog_entry_catalog_code_uniq").on(table.catalogId, table.code),
    index("ce_catalog_idx").on(table.catalogId),
    index("ce_parent_idx").on(table.parentEntryId),
  ],
);

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const catalogObjectTypeEnum = pgEnum("catalog_object_type", [
  "it_system",
  "application",
  "role",
  "department",
  "location",
  "vendor",
  "standard",
  "regulation",
  "custom",
]);

// ──────────────────────────────────────────────────────────────
// 4b.1 RiskCatalog — Platform-wide risk catalog (no org_id)
// ──────────────────────────────────────────────────────────────

export const riskCatalog = pgTable(
  "risk_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    version: varchar("version", { length: 50 }),
    source: varchar("source", { length: 100 }).notNull(),
    language: varchar("language", { length: 10 }).notNull().default("de"),
    entryCount: integer("entry_count").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    targetModules: text("target_modules")
      .array()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("risk_catalog_source_idx").on(table.source),
    index("risk_catalog_active_idx").on(table.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4b.2 RiskCatalogEntry — Individual risk catalog entries
// ──────────────────────────────────────────────────────────────

export const riskCatalogEntry = pgTable(
  "risk_catalog_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => riskCatalog.id, { onDelete: "cascade" }),
    parentEntryId: uuid("parent_entry_id")
      .references((): any => riskCatalogEntry.id),
    code: varchar("code", { length: 50 }).notNull(),
    titleDe: varchar("title_de", { length: 500 }).notNull(),
    titleEn: varchar("title_en", { length: 500 }),
    descriptionDe: text("description_de"),
    descriptionEn: text("description_en"),
    level: integer("level").notNull(),
    riskCategory: varchar("risk_category", { length: 50 }),
    defaultLikelihood: integer("default_likelihood"),
    defaultImpact: integer("default_impact"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("risk_catalog_entry_code_uniq").on(table.catalogId, table.code),
    index("rce_catalog_idx").on(table.catalogId),
    index("rce_parent_idx").on(table.parentEntryId),
    index("rce_level_idx").on(table.catalogId, table.level),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4b.3 ControlCatalog — Platform-wide control catalog (no org_id)
// ──────────────────────────────────────────────────────────────

export const controlCatalog = pgTable(
  "control_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    version: varchar("version", { length: 50 }),
    source: varchar("source", { length: 100 }).notNull(),
    language: varchar("language", { length: 10 }).notNull().default("de"),
    entryCount: integer("entry_count").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    targetModules: text("target_modules")
      .array()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("control_catalog_source_idx").on(table.source),
    index("control_catalog_active_idx").on(table.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4b.4 ControlCatalogEntry — Individual control catalog entries
// ──────────────────────────────────────────────────────────────

export const controlCatalogEntry = pgTable(
  "control_catalog_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => controlCatalog.id, { onDelete: "cascade" }),
    parentEntryId: uuid("parent_entry_id")
      .references((): any => controlCatalogEntry.id),
    code: varchar("code", { length: 50 }).notNull(),
    titleDe: varchar("title_de", { length: 500 }).notNull(),
    titleEn: varchar("title_en", { length: 500 }),
    descriptionDe: text("description_de"),
    descriptionEn: text("description_en"),
    implementationDe: text("implementation_de"),
    implementationEn: text("implementation_en"),
    level: integer("level").notNull(),
    controlType: varchar("control_type_cat", { length: 50 }),
    defaultFrequency: varchar("default_frequency", { length: 50 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("control_catalog_entry_code_uniq").on(table.catalogId, table.code),
    index("cce_catalog_idx").on(table.catalogId),
    index("cce_parent_idx").on(table.parentEntryId),
    index("cce_level_idx").on(table.catalogId, table.level),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4b.5 GeneralCatalogEntry — Org-scoped generic catalog objects
// ──────────────────────────────────────────────────────────────

export const generalCatalogEntry = pgTable(
  "general_catalog_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    objectType: catalogObjectTypeEnum("object_type").notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    lifecycleStart: date("lifecycle_start"),
    lifecycleEnd: date("lifecycle_end"),
    ownerId: uuid("owner_id")
      .references(() => user.id),
    metadataJson: jsonb("metadata_json"),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("gce_org_type_idx").on(table.orgId, table.objectType),
    index("gce_owner_idx").on(table.ownerId),
    index("gce_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4b.6 OrgRiskMethodology — Per-org risk methodology config
// ──────────────────────────────────────────────────────────────

export const orgRiskMethodology = pgTable(
  "org_risk_methodology",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id)
      .unique(),
    methodology: varchar("methodology", { length: 50 }).notNull().default("iso_31000"),
    matrixSize: integer("matrix_size").notNull().default(5),
    fairCurrency: varchar("fair_currency", { length: 10 }).notNull().default("EUR"),
    fairSimulationRuns: integer("fair_simulation_runs").notNull().default(10000),
    riskAppetiteThreshold: integer("risk_appetite_threshold"),
    customLabelsJson: jsonb("custom_labels_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by")
      .references(() => user.id),
  },
  (table) => [
    index("org_methodology_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4b.7 OrgActiveCatalog — Which catalogs are active per org
// ──────────────────────────────────────────────────────────────

export const orgActiveCatalog = pgTable(
  "org_active_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    catalogType: varchar("catalog_type", { length: 50 }).notNull(),
    catalogId: uuid("catalog_id").notNull(),
    enforcementLevel: varchar("enforcement_level", { length: 50 }).notNull().default("optional"),
    isMandatoryFromParent: boolean("is_mandatory_from_parent").notNull().default(false),
    activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
    activatedBy: uuid("activated_by")
      .references(() => user.id),
  },
  (table) => [
    unique("org_active_catalog_uniq").on(table.orgId, table.catalogType, table.catalogId),
    index("oac_org_idx").on(table.orgId),
    index("oac_catalog_idx").on(table.catalogId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4b.8 OrgCatalogExclusion — Per-org exclusions from catalogs
// ──────────────────────────────────────────────────────────────

export const orgCatalogExclusion = pgTable(
  "org_catalog_exclusion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entryType: varchar("entry_type", { length: 50 }).notNull(),
    entryId: uuid("entry_id").notNull(),
    reason: text("reason"),
    excludedAt: timestamp("excluded_at", { withTimezone: true }).notNull().defaultNow(),
    excludedBy: uuid("excluded_by")
      .references(() => user.id),
  },
  (table) => [
    unique("org_catalog_exclusion_uniq").on(table.orgId, table.entryType, table.entryId),
    index("oce_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4b.9 CatalogEntryReference — Links catalog entries to entities
// ──────────────────────────────────────────────────────────────

export const catalogEntryReference = pgTable(
  "catalog_entry_reference",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogEntryId: uuid("catalog_entry_id").notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("catalog_entry_ref_uniq").on(table.catalogEntryId, table.entityType, table.entityId),
    index("cer_org_idx").on(table.orgId),
    index("cer_entry_idx").on(table.catalogEntryId),
    index("cer_entity_idx").on(table.entityType, table.entityId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 4b.10 CatalogLifecyclePhase — Lifecycle tracking for entities
// ──────────────────────────────────────────────────────────────

export const catalogLifecyclePhase = pgTable(
  "catalog_lifecycle_phase",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    phaseName: varchar("phase_name", { length: 100 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("clp_org_idx").on(table.orgId),
    index("clp_entity_idx").on(table.entityType, table.entityId),
  ],
);
