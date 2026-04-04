// Sprint 69: AI Regulatory Change Agent
// Tables: regulatory_source, regulatory_change, regulatory_impact_assessment,
//         regulatory_calendar_event, regulatory_digest

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
// 69.1 Regulatory Source — Monitored regulatory sources
// ──────────────────────────────────────────────────────────────

export const regulatorySource = pgTable(
  "regulatory_source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organization.id), // NULL = platform-wide
    name: varchar("name", { length: 500 }).notNull(),
    sourceType: varchar("source_type", { length: 50 }).notNull(), // official_gazette | regulator | industry_body | eu_lex | custom_feed
    url: varchar("url", { length: 2000 }),
    jurisdiction: varchar("jurisdiction", { length: 100 }).notNull(),
    frameworks: text("frameworks").array(),
    fetchFrequencyHours: integer("fetch_frequency_hours").notNull().default(24),
    parserConfig: jsonb("parser_config").default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastFetchError: text("last_fetch_error"),
    totalChangesDetected: integer("total_changes_detected").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("rcs_org_idx").on(table.orgId),
    jurisdictionIdx: index("rs_jurisdiction_idx").on(table.jurisdiction),
    activeIdx: index("rs_active_idx").on(table.isActive),
  }),
);

export const regulatorySourceRelations = relations(
  regulatorySource,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [regulatorySource.orgId],
      references: [organization.id],
    }),
    changes: many(regulatoryChange),
  }),
);

// ──────────────────────────────────────────────────────────────
// 69.2 Regulatory Change — Detected changes from sources
// ──────────────────────────────────────────────────────────────

export const regulatoryChange = pgTable(
  "regulatory_change",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceId: uuid("source_id")
      .references(() => regulatorySource.id),
    externalId: varchar("external_id", { length: 500 }),
    title: varchar("title", { length: 1000 }).notNull(),
    summary: text("summary").notNull(),
    fullText: text("full_text"),
    changeType: varchar("change_type", { length: 50 }).notNull(), // new_regulation | amendment | repeal | guidance | enforcement
    classification: varchar("classification", { length: 50 }).notNull(), // critical | major | minor | informational
    jurisdiction: varchar("jurisdiction", { length: 100 }).notNull(),
    affectedFrameworks: text("affected_frameworks").array(),
    affectedModules: text("affected_modules").array(),
    effectiveDate: date("effective_date"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    sourceUrl: varchar("source_url", { length: 2000 }),
    nlpClassification: jsonb("nlp_classification").default("{}"), // {category, topics, entities, sentiment}
    relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }), // 0-100
    aiSummary: text("ai_summary"),
    status: varchar("status", { length: 20 }).notNull().default("new"), // new | under_review | assessed | acknowledged | not_applicable
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    isNotified: boolean("is_notified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("rc_org_idx").on(table.orgId),
    sourceIdx: index("rc_source_idx").on(table.sourceId),
    classIdx: index("rc_class_idx").on(table.orgId, table.classification),
    statusIdx: index("rc_status_idx").on(table.orgId, table.status),
    dateIdx: index("rc_date_idx").on(table.orgId, table.publishedAt),
    externalIdx: uniqueIndex("rc_external_idx").on(table.orgId, table.sourceId, table.externalId),
  }),
);

export const regulatoryChangeRelations = relations(
  regulatoryChange,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [regulatoryChange.orgId],
      references: [organization.id],
    }),
    source: one(regulatorySource, {
      fields: [regulatoryChange.sourceId],
      references: [regulatorySource.id],
    }),
    reviewer: one(user, {
      fields: [regulatoryChange.reviewedBy],
      references: [user.id],
    }),
    impactAssessments: many(regulatoryImpactAssessment),
  }),
);

// ──────────────────────────────────────────────────────────────
// 69.3 Regulatory Impact Assessment — Auto-generated assessment
// ──────────────────────────────────────────────────────────────

export const regulatoryImpactAssessment = pgTable(
  "regulatory_impact_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    changeId: uuid("change_id")
      .notNull()
      .references(() => regulatoryChange.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    impactLevel: varchar("impact_level", { length: 20 }).notNull(), // critical | high | medium | low | none
    impactAreas: jsonb("impact_areas").default("[]"), // [{module, area, description, severity}]
    affectedControls: jsonb("affected_controls").default("[]"), // [{controlId, impact}]
    affectedProcesses: jsonb("affected_processes").default("[]"), // [{processId, impact}]
    requiredActions: jsonb("required_actions").default("[]"), // [{action, priority, deadline}]
    estimatedEffort: varchar("estimated_effort", { length: 50 }),
    complianceDeadline: date("compliance_deadline"),
    aiReasoning: text("ai_reasoning"),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }), // 0-100
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | in_review | approved | rejected
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    changeIdx: index("ria_change_idx").on(table.changeId),
    orgIdx: index("ria_org_idx").on(table.orgId),
    impactIdx: index("ria_impact_idx").on(table.orgId, table.impactLevel),
    statusIdx: index("ria_status_idx").on(table.orgId, table.status),
  }),
);

export const regulatoryImpactAssessmentRelations = relations(
  regulatoryImpactAssessment,
  ({ one }) => ({
    change: one(regulatoryChange, {
      fields: [regulatoryImpactAssessment.changeId],
      references: [regulatoryChange.id],
    }),
    approver: one(user, {
      fields: [regulatoryImpactAssessment.approvedBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 69.4 Regulatory Calendar Event — Compliance deadlines
// ──────────────────────────────────────────────────────────────

export const regulatoryCalendarEvent = pgTable(
  "regulatory_calendar_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    changeId: uuid("change_id")
      .references(() => regulatoryChange.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    eventType: varchar("event_type", { length: 50 }).notNull(), // compliance_deadline | enforcement_date | consultation_end | reporting_deadline
    eventDate: date("event_date").notNull(),
    jurisdiction: varchar("jurisdiction", { length: 100 }),
    framework: varchar("framework", { length: 100 }),
    priority: varchar("priority", { length: 20 }).notNull().default("medium"),
    reminderDays: integer("reminder_days").default(30),
    isCompleted: boolean("is_completed").notNull().default(false),
    assigneeId: uuid("assignee_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("rce_org_idx").on(table.orgId),
    dateIdx: index("rce_date_idx").on(table.orgId, table.eventDate),
    changeIdx: index("rce_change_idx").on(table.changeId),
    priorityIdx: index("rce_priority_idx").on(table.orgId, table.priority),
  }),
);

export const regulatoryCalendarEventRelations = relations(
  regulatoryCalendarEvent,
  ({ one }) => ({
    organization: one(organization, {
      fields: [regulatoryCalendarEvent.orgId],
      references: [organization.id],
    }),
    change: one(regulatoryChange, {
      fields: [regulatoryCalendarEvent.changeId],
      references: [regulatoryChange.id],
    }),
    assignee: one(user, {
      fields: [regulatoryCalendarEvent.assigneeId],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 69.5 Regulatory Digest — Weekly digest per org
// ──────────────────────────────────────────────────────────────

export const regulatoryDigest = pgTable(
  "regulatory_digest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    digestType: varchar("digest_type", { length: 20 }).notNull().default("weekly"), // daily | weekly | monthly
    summary: text("summary").notNull(),
    changeCount: integer("change_count").notNull().default(0),
    criticalCount: integer("critical_count").notNull().default(0),
    highlights: jsonb("highlights").default("[]"), // [{title, classification, relevance}]
    recipients: jsonb("recipients").default("[]"), // [{userId, email, sentAt}]
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("rd_org_idx").on(table.orgId),
    periodIdx: index("rd_period_idx").on(table.orgId, table.periodStart),
  }),
);

export const regulatoryDigestRelations = relations(
  regulatoryDigest,
  ({ one }) => ({
    organization: one(organization, {
      fields: [regulatoryDigest.orgId],
      references: [organization.id],
    }),
  }),
);
