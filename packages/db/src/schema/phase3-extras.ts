// Phase-3 Platform-Extras (ADR-014 Phase 3)
//
// Kleinere Tabellen die sich nicht in andere Domain-Files einordnen
// lassen:
// - catalog_entry_mapping -- Cross-Framework-Mapping zwischen catalog_entry
//   (z. B. ISO 27002 A.8.1 <-> BSI OPS.1.1.3)
// - evidence_request -- Anforderung von Evidenzen zu einer Control / Audit
// - inline_comment -- Generic Threaded-Comments auf beliebigen Entitaeten
// - messaging_integration -- Slack/Teams/Mattermost-Webhooks
// - module_nav_item -- Navigation-Items pro Modul
// - reminder_rule -- Generic Reminder-Engine (days_before_due, overdue_by)
// - sox_scoping -- SOX-Scoping fuer US-listed Tenants
// - tag_definition -- User-definierte Tags (cross-entity)
//
// Migration-Quellen: 0075/0079/0080/0081/0082/0084 -- diverse.

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
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { catalogEntry } from "./catalog";
import { moduleDefinition } from "./module";
import { control, evidence } from "./control";
import { audit } from "./audit-mgmt";

// ─────────── Cross-Framework Catalog-Mapping ───────────

export const catalogEntryMapping = pgTable("catalog_entry_mapping", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceEntryId: uuid("source_entry_id").notNull().references(() => catalogEntry.id, { onDelete: "cascade" }),
  targetEntryId: uuid("target_entry_id").notNull().references(() => catalogEntry.id, { onDelete: "cascade" }),
  // equivalent | subset | superset | related
  relationship: varchar("relationship", { length: 50 }).default("equivalent").notNull(),
  // 0-100
  confidence: integer("confidence").default(85).notNull(),
  // official | community | inferred | manual
  mappingSource: varchar("mapping_source", { length: 50 }).default("official").notNull(),
  sourceReference: text("source_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────── Evidence Requests ───────────

export const evidenceRequest = pgTable("evidence_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  controlId: uuid("control_id").references(() => control.id),
  auditId: uuid("audit_id").references(() => audit.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  requestedFrom: uuid("requested_from").notNull().references(() => user.id),
  requestedBy: uuid("requested_by").notNull().references(() => user.id),
  dueDate: date("due_date"),
  // low | medium | high | urgent
  priority: varchar("priority", { length: 20 }).default("medium"),
  // pending | provided | rejected | cancelled
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  evidenceId: uuid("evidence_id").references(() => evidence.id),
  responseNote: text("response_note"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  reminderCount: integer("reminder_count").default(0),
  lastReminder: timestamp("last_reminder", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────── Inline Comments ───────────

export const inlineComment = pgTable("inline_comment", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  fieldName: varchar("field_name", { length: 100 }),
  content: text("content").notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => inlineComment.id),
  isResolved: boolean("is_resolved").default(false).notNull(),
  resolvedBy: uuid("resolved_by").references(() => user.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").notNull().references(() => user.id),
});

// ─────────── Messaging Integration ───────────

export const messagingIntegration = pgTable("messaging_integration", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  // slack | teams | mattermost | discord | rocketchat
  provider: varchar("provider", { length: 30 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  webhookUrl: text("webhook_url"),
  channelId: varchar("channel_id", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  errorCount: integer("error_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

// ─────────── Module Navigation ───────────

export const moduleNavItem = pgTable("module_nav_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleKey: varchar("module_key", { length: 50 }).notNull().references(() => moduleDefinition.moduleKey, { onDelete: "cascade" }),
  labelDe: varchar("label_de", { length: 200 }).notNull(),
  labelEn: varchar("label_en", { length: 200 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  route: varchar("route", { length: 200 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  parentRoute: varchar("parent_route", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─────────── Reminder Rule ───────────

export const reminderRule = pgTable("reminder_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  name: varchar("name", { length: 255 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  conditionField: varchar("condition_field", { length: 100 }).notNull(),
  // days_before_due | days_overdue | status_equals | no_activity
  conditionType: varchar("condition_type", { length: 30 }).default("days_before_due").notNull(),
  conditionValue: integer("condition_value").default(7).notNull(),
  // in_app | email | slack | teams
  channel: varchar("channel", { length: 20 }).default("in_app").notNull(),
  template: text("template"),
  isActive: boolean("is_active").default(true).notNull(),
  lastExecuted: timestamp("last_executed", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

// ─────────── SOX Scoping ───────────

export const soxScoping = pgTable("sox_scoping", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  fiscalYear: integer("fiscal_year").notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  // draft | in_progress | approved | archived
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  scopedLocations: jsonb("scoped_locations").default([]),
  scopedAccounts: jsonb("scoped_accounts").default([]),
  // Financial-Statement-Assertions: existence, completeness, accuracy,
  // valuation, rights_obligations, presentation
  scopedAssertions: jsonb("scoped_assertions").default([]),
  totalControls: integer("total_controls").default(0),
  inScopeControls: integer("in_scope_controls").default(0),
  approvedBy: uuid("approved_by").references(() => user.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

// ─────────── Tag Definitions ───────────

export const tagDefinition = pgTable("tag_definition", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6B7280"),
  category: varchar("category", { length: 50 }),
  description: text("description"),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});
