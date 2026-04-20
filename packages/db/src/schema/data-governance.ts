// Data-Governance (ADR-014 Phase 3)
//
// - data_lineage_source / data_lineage_entry -- Nachweis welche Quelle
//   welchen Feldwert geliefert hat (fuer CSRD-Assurance, SOX-Controls,
//   forensische Audits)
// - data_link -- polymorphe Cross-Entity-Links (Source-Entity.Field ->
//   Target-Entity.Field), z. B. Risk-Amount <-> Contract-Value
// - data_validation_rule / data_validation_result -- Data-Quality-Engine
//   (range, regex, enum, cross-field, uniqueness)
//
// Migration: 0082 / 0083 / 0084 (round5/6/7 features)

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { connectorInstance } from "./connector";

// ─────────── Data Lineage ───────────

export const dataLineageSource = pgTable("data_lineage_source", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  sourceName: varchar("source_name", { length: 255 }).notNull(),
  // manual | connector | calculation | import | api
  sourceType: varchar("source_type", { length: 50 })
    .default("manual")
    .notNull(),
  connectionId: uuid("connection_id").references(() => connectorInstance.id),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const dataLineageEntry = pgTable("data_lineage_entry", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  fieldValue: text("field_value"),
  sourceId: uuid("source_id").references(() => dataLineageSource.id),
  sourceRecord: varchar("source_record", { length: 500 }),
  transformation: text("transformation"),
  // unverified | verified | estimated | imputed
  confidence: varchar("confidence", { length: 20 }).default("verified"),
  verifiedBy: uuid("verified_by").references(() => user.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

// ─────────── Data Link ───────────

export const dataLink = pgTable("data_link", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  sourceType: varchar("source_type", { length: 50 }).notNull(),
  sourceId: uuid("source_id").notNull(),
  sourceField: varchar("source_field", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetId: uuid("target_id").notNull(),
  targetField: varchar("target_field", { length: 100 }).notNull(),
  // reference | calculation | copy | aggregation
  linkType: varchar("link_type", { length: 30 }).default("reference").notNull(),
  isBidirectional: boolean("is_bidirectional").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

// ─────────── Data Validation ───────────

export const dataValidationRule = pgTable("data_validation_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  // range | regex | enum | cross_field | uniqueness | reference | custom
  ruleType: varchar("rule_type", { length: 30 }).default("range").notNull(),
  configuration: jsonb("configuration").default({}).notNull(),
  // info | warning | error | critical
  severity: varchar("severity", { length: 20 }).default("warning").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const dataValidationResult = pgTable("data_validation_result", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => dataValidationRule.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  fieldValue: text("field_value"),
  isValid: boolean("is_valid").notNull(),
  message: text("message"),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
