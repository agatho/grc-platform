// Sprint 30: Report Engine + Threat Landscape Dashboard
// 4 entities: reportTemplate, reportGenerationLog, reportSchedule, threatFeedSource

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const reportModuleScopeEnum = pgEnum("report_module_scope", [
  "erm",
  "ics",
  "isms",
  "audit",
  "dpms",
  "esg",
  "bcms",
  "tprm",
  "all",
]);

export const reportGenerationStatusEnum = pgEnum("report_generation_status", [
  "queued",
  "generating",
  "completed",
  "failed",
]);

export const reportOutputFormatEnum = pgEnum("report_output_format", [
  "pdf",
  "xlsx",
]);

export const reportSectionTypeEnum = pgEnum("report_section_type", [
  "title",
  "text",
  "table",
  "chart",
  "kpi",
  "page_break",
]);

export const threatFeedTypeEnum = pgEnum("threat_feed_type", [
  "rss",
  "atom",
  "json",
]);

// ──────────────────────────────────────────────────────────────
// 30.1 ReportTemplate — Template definition with section config
// ──────────────────────────────────────────────────────────────

export const reportTemplate = pgTable(
  "report_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    moduleScope: reportModuleScopeEnum("module_scope").notNull().default("all"),
    sectionsJson: jsonb("sections_json").notNull().default(sql`'[]'::jsonb`),
    parametersJson: jsonb("parameters_json")
      .notNull()
      .default(sql`'[]'::jsonb`),
    brandingJson: jsonb("branding_json"),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rt_org_idx").on(t.orgId),
    index("rt_scope_idx").on(t.orgId, t.moduleScope),
  ],
);

// ──────────────────────────────────────────────────────────────
// 30.2 ReportGenerationLog — Generated reports (status, path, params)
// ──────────────────────────────────────────────────────────────

export const reportGenerationLog = pgTable(
  "report_generation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => reportTemplate.id),
    status: reportGenerationStatusEnum("status").notNull().default("queued"),
    parametersJson: jsonb("parameters_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
    outputFormat: reportOutputFormatEnum("output_format")
      .notNull()
      .default("pdf"),
    filePath: varchar("file_path", { length: 1000 }),
    fileSize: integer("file_size"),
    generationTimeMs: integer("generation_time_ms"),
    error: text("error"),
    generatedBy: uuid("generated_by").references(() => user.id),
    scheduleId: uuid("schedule_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("rgl_org_idx").on(t.orgId),
    index("rgl_status_idx").on(t.orgId, t.status),
    index("rgl_template_idx").on(t.templateId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 30.3 ReportSchedule — CRON schedules for recurring reports
// ──────────────────────────────────────────────────────────────

export const reportSchedule = pgTable(
  "report_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => reportTemplate.id),
    name: varchar("name", { length: 500 }),
    cronExpression: varchar("cron_expression", { length: 100 }).notNull(),
    parametersJson: jsonb("parameters_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
    recipientEmails: jsonb("recipient_emails")
      .notNull()
      .default(sql`'[]'::jsonb`),
    outputFormat: reportOutputFormatEnum("output_format")
      .notNull()
      .default("pdf"),
    isActive: boolean("is_active").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rsched_org_idx").on(t.orgId),
    index("rs_next_run_idx").on(t.isActive, t.nextRunAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 30.4 ThreatFeedSource — External threat feed config (RSS/Atom)
// ──────────────────────────────────────────────────────────────

export const threatFeedSource = pgTable(
  "threat_feed_source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 200 }).notNull(),
    feedUrl: varchar("feed_url", { length: 1000 }).notNull(),
    feedType: threatFeedTypeEnum("feed_type").notNull().default("rss"),
    isActive: boolean("is_active").notNull().default(true),
    lastFetchAt: timestamp("last_fetch_at", { withTimezone: true }),
    lastItemCount: integer("last_item_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tfs_org_idx").on(t.orgId),
    index("tfs_active_idx").on(t.orgId, t.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 30.5 ThreatFeedItem — Cached items fetched from feeds
// ──────────────────────────────────────────────────────────────

export const threatFeedItem = pgTable(
  "threat_feed_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => threatFeedSource.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 1000 }).notNull(),
    description: text("description"),
    link: varchar("link", { length: 2000 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    guid: varchar("guid", { length: 500 }),
    category: varchar("category", { length: 200 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tfi_org_idx").on(t.orgId),
    index("tfi_source_idx").on(t.sourceId),
    index("tfi_published_idx").on(t.orgId, t.publishedAt),
  ],
);
