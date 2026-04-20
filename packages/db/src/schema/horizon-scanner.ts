// Sprint 75: Regulatory Horizon Scanner
// Tables: horizon_scan_source, horizon_scan_item, horizon_impact_assessment, horizon_calendar_event

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
// 75.1 Horizon Scan Source — Monitored regulatory sources
// ──────────────────────────────────────────────────────────────

export const horizonScanSource = pgTable(
  "horizon_scan_source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organization.id), // NULL = platform-wide
    name: varchar("name", { length: 500 }).notNull(),
    sourceType: varchar("source_type", { length: 50 }).notNull(), // eu_oj | bsi | bafin | enisa | eba | esma | cert | national_gazette | custom
    url: varchar("url", { length: 2000 }),
    jurisdiction: varchar("jurisdiction", { length: 100 }).notNull(),
    regulatoryBody: varchar("regulatory_body", { length: 200 }),
    frameworks: text("frameworks").array(),
    fetchFrequencyHours: integer("fetch_frequency_hours").notNull().default(12),
    parserType: varchar("parser_type", { length: 50 }).notNull().default("rss"), // rss | html_scraper | api | email | manual
    parserConfig: jsonb("parser_config").default("{}"),
    nlpModel: varchar("nlp_model", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastFetchError: text("last_fetch_error"),
    totalItemsFetched: integer("total_items_fetched").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("hs_src_org_idx").on(table.orgId),
    typeIdx: index("hs_src_type_idx").on(table.sourceType),
    jurisdictionIdx: index("hs_src_jurisdiction_idx").on(table.jurisdiction),
    activeIdx: index("hs_src_active_idx").on(table.isActive),
  }),
);

export const horizonScanSourceRelations = relations(
  horizonScanSource,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [horizonScanSource.orgId],
      references: [organization.id],
    }),
    items: many(horizonScanItem),
  }),
);

// ──────────────────────────────────────────────────────────────
// 75.2 Horizon Scan Item — Detected regulatory changes
// ──────────────────────────────────────────────────────────────

export const horizonScanItem = pgTable(
  "horizon_scan_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceId: uuid("source_id").references(() => horizonScanSource.id),
    externalId: varchar("external_id", { length: 500 }),
    title: varchar("title", { length: 1000 }).notNull(),
    summary: text("summary").notNull(),
    fullText: text("full_text"),
    itemType: varchar("item_type", { length: 50 }).notNull(), // regulation | directive | guideline | consultation | enforcement | standard | alert
    classification: varchar("classification", { length: 20 }).notNull(), // critical | high | medium | low | informational
    jurisdiction: varchar("jurisdiction", { length: 100 }).notNull(),
    regulatoryBody: varchar("regulatory_body", { length: 200 }),
    affectedFrameworks: text("affected_frameworks").array(),
    affectedModules: text("affected_modules").array(),
    effectiveDate: date("effective_date"),
    consultationEndDate: date("consultation_end_date"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    sourceUrl: varchar("source_url", { length: 2000 }),
    // NLP Classification
    nlpTopics: jsonb("nlp_topics").default("[]"), // [{topic, confidence}]
    nlpEntities: jsonb("nlp_entities").default("[]"), // [{entity, type, relevance}]
    nlpSentiment: varchar("nlp_sentiment", { length: 20 }), // positive | neutral | negative
    relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }),
    aiSummary: text("ai_summary"),
    suggestedControls: jsonb("suggested_controls").default("[]"), // [{controlId, controlName, reason}]
    status: varchar("status", { length: 20 }).notNull().default("new"), // new | triaged | under_review | assessed | acknowledged | dismissed
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("hs_item_org_idx").on(table.orgId),
    sourceIdx: index("hs_item_source_idx").on(table.sourceId),
    classIdx: index("hs_item_class_idx").on(table.orgId, table.classification),
    statusIdx: index("hs_item_status_idx").on(table.orgId, table.status),
    dateIdx: index("hs_item_date_idx").on(table.orgId, table.publishedAt),
    externalIdx: uniqueIndex("hs_item_external_idx").on(
      table.orgId,
      table.sourceId,
      table.externalId,
    ),
    typeIdx: index("hs_item_type_idx").on(table.orgId, table.itemType),
  }),
);

export const horizonScanItemRelations = relations(
  horizonScanItem,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [horizonScanItem.orgId],
      references: [organization.id],
    }),
    source: one(horizonScanSource, {
      fields: [horizonScanItem.sourceId],
      references: [horizonScanSource.id],
    }),
    reviewer: one(user, {
      fields: [horizonScanItem.reviewedBy],
      references: [user.id],
    }),
    impactAssessments: many(horizonImpactAssessment),
  }),
);

// ──────────────────────────────────────────────────────────────
// 75.3 Horizon Impact Assessment
// ──────────────────────────────────────────────────────────────

export const horizonImpactAssessment = pgTable(
  "horizon_impact_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    scanItemId: uuid("scan_item_id")
      .notNull()
      .references(() => horizonScanItem.id, { onDelete: "cascade" }),
    impactLevel: varchar("impact_level", { length: 20 }).notNull(), // critical | high | medium | low | none
    impactAreas: jsonb("impact_areas").default("[]"), // [{module, area, description, severity}]
    affectedControls: jsonb("affected_controls").default("[]"),
    affectedProcesses: jsonb("affected_processes").default("[]"),
    requiredActions: jsonb("required_actions").default("[]"), // [{action, priority, deadline, assignee}]
    estimatedEffort: varchar("estimated_effort", { length: 50 }),
    complianceDeadline: date("compliance_deadline"),
    aiReasoning: text("ai_reasoning"),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
    assessedBy: uuid("assessed_by").references(() => user.id),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | in_review | approved | rejected
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("hia_org_idx").on(table.orgId),
    itemIdx: index("hia_item_idx").on(table.scanItemId),
    impactIdx: index("hia_impact_idx").on(table.orgId, table.impactLevel),
    statusIdx: index("hia_status_idx").on(table.orgId, table.status),
  }),
);

export const horizonImpactAssessmentRelations = relations(
  horizonImpactAssessment,
  ({ one }) => ({
    organization: one(organization, {
      fields: [horizonImpactAssessment.orgId],
      references: [organization.id],
    }),
    scanItem: one(horizonScanItem, {
      fields: [horizonImpactAssessment.scanItemId],
      references: [horizonScanItem.id],
    }),
    assessor: one(user, {
      fields: [horizonImpactAssessment.assessedBy],
      references: [user.id],
    }),
    approver: one(user, {
      fields: [horizonImpactAssessment.approvedBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 75.4 Horizon Calendar Event — Regulatory deadlines
// ──────────────────────────────────────────────────────────────

export const horizonCalendarEvent = pgTable(
  "horizon_calendar_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    scanItemId: uuid("scan_item_id").references(() => horizonScanItem.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    eventType: varchar("event_type", { length: 50 }).notNull(), // compliance_deadline | enforcement_date | consultation_end | reporting_deadline | transition_period
    eventDate: date("event_date").notNull(),
    jurisdiction: varchar("jurisdiction", { length: 100 }),
    framework: varchar("framework", { length: 100 }),
    priority: varchar("priority", { length: 20 }).notNull().default("medium"), // critical | high | medium | low
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
    orgIdx: index("hce_org_idx").on(table.orgId),
    dateIdx: index("hce_date_idx").on(table.orgId, table.eventDate),
    itemIdx: index("hce_item_idx").on(table.scanItemId),
    priorityIdx: index("hce_priority_idx").on(table.orgId, table.priority),
  }),
);

export const horizonCalendarEventRelations = relations(
  horizonCalendarEvent,
  ({ one }) => ({
    organization: one(organization, {
      fields: [horizonCalendarEvent.orgId],
      references: [organization.id],
    }),
    scanItem: one(horizonScanItem, {
      fields: [horizonCalendarEvent.scanItemId],
      references: [horizonScanItem.id],
    }),
    assignee: one(user, {
      fields: [horizonCalendarEvent.assigneeId],
      references: [user.id],
    }),
  }),
);
