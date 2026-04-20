// ESEF / XBRL / EU-Taxonomy / Consolidation (ADR-014 Phase 3)
//
// Finanz- und Nachhaltigkeits-Reporting:
// - xbrl_taxonomy / xbrl_tag / xbrl_tagging_instance -- XBRL-Tagging-
//   Infrastruktur fuer ESEF-Filings
// - esef_filing -- Filing-Container fuer ESMA (European Single Electronic
//   Format, ab 2020 fuer listed EU-Issuer verpflichtend)
// - consolidation_group / consolidation_entry -- Konzern-Konsolidierung
// - eu_taxonomy_assessment -- EU-Taxonomie-Verordnung 2020/852
//   Eligibility/Alignment je Wirtschaftsaktivitaet
//
// Migration: 0084_round7_financial_reporting.sql

import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { document } from "./document";

// ─────────── XBRL ───────────

export const xbrlTaxonomy = pgTable("xbrl_taxonomy", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  // esef | gaap | ifrs | esma_esg
  taxonomyType: varchar("taxonomy_type", { length: 30 }).notNull(),
  namespaceUri: text("namespace_uri"),
  entryPointUrl: text("entry_point_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const xbrlTag = pgTable("xbrl_tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  taxonomyId: uuid("taxonomy_id")
    .notNull()
    .references(() => xbrlTaxonomy.id, { onDelete: "cascade" }),
  elementName: varchar("element_name", { length: 500 }).notNull(),
  labelEn: varchar("label_en", { length: 500 }),
  labelDe: varchar("label_de", { length: 500 }),
  dataType: varchar("data_type", { length: 50 }),
  // instant | duration
  periodType: varchar("period_type", { length: 20 }),
  // debit | credit | null
  balanceType: varchar("balance_type", { length: 20 }),
  isAbstract: boolean("is_abstract").default(false),
  parentId: uuid("parent_id").references((): AnyPgColumn => xbrlTag.id),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const xbrlTaggingInstance = pgTable("xbrl_tagging_instance", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  reportId: uuid("report_id"),
  documentId: uuid("document_id").references(() => document.id),
  taxonomyId: uuid("taxonomy_id")
    .notNull()
    .references(() => xbrlTaxonomy.id),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => xbrlTag.id),
  taggedValue: text("tagged_value"),
  contextPeriod: varchar("context_period", { length: 50 }),
  contextEntity: varchar("context_entity", { length: 255 }),
  unit: varchar("unit", { length: 50 }),
  decimals: integer("decimals"),
  isExtension: boolean("is_extension").default(false),
  taggedBy: uuid("tagged_by").references(() => user.id),
  taggedAt: timestamp("tagged_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // draft | validated | final | rejected
  status: varchar("status", { length: 20 }).default("draft").notNull(),
});

// ─────────── ESEF ───────────

export const esefFiling = pgTable("esef_filing", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  fiscalYear: integer("fiscal_year").notNull(),
  leiCode: varchar("lei_code", { length: 20 }),
  // annual | interim | ad_hoc
  filingType: varchar("filing_type", { length: 30 })
    .default("annual")
    .notNull(),
  taxonomyVersion: varchar("taxonomy_version", { length: 50 }),
  documentId: uuid("document_id").references(() => document.id),
  xhtmlContent: text("xhtml_content"),
  // not_validated | validated | errors | warnings
  validationStatus: varchar("validation_status", { length: 20 }).default(
    "not_validated",
  ),
  validationErrors: jsonb("validation_errors").default([]),
  filedAt: timestamp("filed_at", { withTimezone: true }),
  filedTo: varchar("filed_to", { length: 100 }),
  // draft | in_review | filed | rejected
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

// ─────────── Consolidation ───────────

export const consolidationGroup = pgTable("consolidation_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  parentEntityId: uuid("parent_entity_id").references(() => organization.id),
  // full | proportional | equity | cost
  consolidationMethod: varchar("consolidation_method", { length: 30 })
    .default("full")
    .notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  fiscalYearEnd: varchar("fiscal_year_end", { length: 5 }).default("12-31"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const consolidationEntry = pgTable("consolidation_entry", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => consolidationGroup.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => organization.id),
  // YYYY-MM oder YYYY-Q1
  reportingPeriod: varchar("reporting_period", { length: 10 }).notNull(),
  // reported | adjusted | eliminated | reclassified
  entryType: varchar("entry_type", { length: 30 })
    .default("reported")
    .notNull(),
  accountCode: varchar("account_code", { length: 50 }),
  accountName: varchar("account_name", { length: 255 }),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  // intercompany | minority | goodwill | investment
  eliminationType: varchar("elimination_type", { length: 30 }),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

// ─────────── EU Taxonomy (VO 2020/852) ───────────

export const euTaxonomyAssessment = pgTable("eu_taxonomy_assessment", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  reportingYear: integer("reporting_year").notNull(),
  activityName: varchar("activity_name", { length: 500 }).notNull(),
  naceCode: varchar("nace_code", { length: 20 }),
  // EU-Taxonomy 6 Environmental Objectives: 1=climate-mitigation,
  // 2=climate-adaptation, 3=water, 4=circular-economy, 5=pollution,
  // 6=biodiversity
  objectiveId: varchar("objective_id", { length: 10 }).notNull(),
  isEligible: boolean("is_eligible"),
  isAligned: boolean("is_aligned"),
  substantialContributionMet: boolean("substantial_contribution_met").default(
    false,
  ),
  // DNSH = Do No Significant Harm
  dnshMet: boolean("dnsh_met").default(false),
  minimumSafeguardsMet: boolean("minimum_safeguards_met").default(false),
  justification: text("justification"),
  assessedBy: uuid("assessed_by").references(() => user.id),
  assessedAt: timestamp("assessed_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});
