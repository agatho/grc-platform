// Content-Mgmt + Narrative-Templates (ADR-014 Phase 3)
//
// - content_placeholder -- benannte Platzhalter (Tokens) die in Reports,
//   Templates oder Narratives durch dynamische Werte ersetzt werden
// - content_request -- Anforderung von Inhalten an einen User
//   (ergaenzt task.ts um Content-spezifische Felder)
// - narrative_template / narrative_instance -- Template-Engine fuer
//   Narrative-Textbausteine in Reports (ESEF/CSRD/ICS), mit Versionierung
//
// Migration: 0080_round3_features.sql, 0084_round7_financial_reporting.sql

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

export const contentPlaceholder = pgTable("content_placeholder", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  // {{ENTITY_NAME}}, {{ORG_LEI_CODE}}, etc.
  token: varchar("token", { length: 100 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  sourceType: varchar("source_type", { length: 50 }),
  sourceId: uuid("source_id"),
  sourceField: varchar("source_field", { length: 100 }),
  staticValue: text("static_value"),
  // strftime/printf-artig
  formatPattern: varchar("format_pattern", { length: 100 }),
  category: varchar("category", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const contentRequest = pgTable("content_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: uuid("entity_id"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  // Array<{ field: string; label: string; required: boolean }>
  requestedFields: jsonb("requested_fields").default([]),
  requestedFrom: uuid("requested_from")
    .notNull()
    .references(() => user.id),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => user.id),
  dueDate: date("due_date"),
  // low | medium | high | urgent
  priority: varchar("priority", { length: 20 }).default("medium"),
  // pending | in_progress | completed | declined | cancelled
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  responseData: jsonb("response_data").default({}),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  reminderCount: integer("reminder_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const narrativeTemplate = pgTable("narrative_template", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  // Array<{ kind: "text"|"placeholder"|"condition"; value: string }>
  contentBlocks: jsonb("content_blocks").default([]).notNull(),
  language: varchar("language", { length: 5 }).default("de"),
  version: integer("version").default(1).notNull(),
  // draft | published | archived
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const narrativeInstance = pgTable("narrative_instance", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").references(() => narrativeTemplate.id),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: uuid("entity_id"),
  reportId: uuid("report_id"),
  renderedContent: text("rendered_content"),
  // Snapshot aller Placeholder-Werte zum Render-Zeitpunkt (fuer Audit-
  // Trail: 'was stand in dem Report den wir damals gefiled haben?')
  dataSnapshot: jsonb("data_snapshot").default({}),
  // draft | rendered | approved | published
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});
