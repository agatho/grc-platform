// Sprint 77: Embedded BI und Report Builder
// 8 entities: bi_report, bi_report_widget, bi_data_source, bi_query,
//             bi_shared_dashboard, bi_brand_config, bi_scheduled_report, bi_report_execution

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
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const biReportStatusEnum = pgEnum("bi_report_status", [
  "draft",
  "published",
  "archived",
]);

export const biWidgetTypeEnum = pgEnum("bi_widget_type", [
  "kpi_card",
  "bar_chart",
  "line_chart",
  "donut_chart",
  "heatmap",
  "table",
  "text_block",
  "radar_chart",
  "gauge",
  "treemap",
]);

export const biDataSourceTypeEnum = pgEnum("bi_data_source_type", [
  "erm",
  "isms",
  "audit",
  "bcms",
  "esg",
  "ics",
  "dpms",
  "tprm",
  "bpm",
  "custom_sql",
]);

export const biQueryStatusEnum = pgEnum("bi_query_status", [
  "draft",
  "validated",
  "failed",
]);

export const biShareAccessEnum = pgEnum("bi_share_access", ["view", "edit"]);

export const biScheduleFrequencyEnum = pgEnum("bi_schedule_frequency", [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
]);

export const biExecutionStatusEnum = pgEnum("bi_execution_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const biOutputFormatEnum = pgEnum("bi_output_format", [
  "pdf",
  "xlsx",
  "csv",
  "pptx",
]);

// ──────────────────────────────────────────────────────────────
// 77.1 BiReport — Drag-drop report definition
// ──────────────────────────────────────────────────────────────

export const biReport = pgTable(
  "bi_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    status: biReportStatusEnum("status").notNull().default("draft"),
    moduleScope: varchar("module_scope", { length: 50 })
      .notNull()
      .default("all"),
    layoutJson: jsonb("layout_json")
      .notNull()
      .default(sql`'[]'::jsonb`),
    filtersJson: jsonb("filters_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
    parametersJson: jsonb("parameters_json")
      .notNull()
      .default(sql`'[]'::jsonb`),
    isTemplate: boolean("is_template").notNull().default(false),
    templateCategory: varchar("template_category", { length: 100 }),
    thumbnailUrl: varchar("thumbnail_url", { length: 1000 }),
    createdBy: uuid("created_by").references(() => user.id),
    updatedBy: uuid("updated_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bi_report_org_idx").on(t.orgId),
    index("bi_report_status_idx").on(t.orgId, t.status),
    index("bi_report_template_idx").on(t.orgId, t.isTemplate),
    index("bi_report_module_idx").on(t.orgId, t.moduleScope),
  ],
);

// ──────────────────────────────────────────────────────────────
// 77.2 BiReportWidget — Individual widget in a report
// ──────────────────────────────────────────────────────────────

export const biReportWidget = pgTable(
  "bi_report_widget",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    reportId: uuid("report_id")
      .notNull()
      .references(() => biReport.id, { onDelete: "cascade" }),
    widgetType: biWidgetTypeEnum("widget_type").notNull(),
    title: varchar("title", { length: 300 }),
    dataSourceType: biDataSourceTypeEnum("data_source_type").notNull(),
    queryId: uuid("query_id"),
    configJson: jsonb("config_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
    positionJson: jsonb("position_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bi_rw_org_idx").on(t.orgId),
    index("bi_rw_report_idx").on(t.reportId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 77.3 BiDataSource — Data warehouse layer source definition
// ──────────────────────────────────────────────────────────────

export const biDataSource = pgTable(
  "bi_data_source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 300 }).notNull(),
    sourceType: biDataSourceTypeEnum("source_type").notNull(),
    description: text("description"),
    schemaDefinition: jsonb("schema_definition")
      .notNull()
      .default(sql`'{}'::jsonb`),
    availableColumns: jsonb("available_columns")
      .notNull()
      .default(sql`'[]'::jsonb`),
    defaultFilters: jsonb("default_filters")
      .notNull()
      .default(sql`'{}'::jsonb`),
    refreshIntervalMinutes: integer("refresh_interval_minutes")
      .notNull()
      .default(60),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bi_ds_org_idx").on(t.orgId),
    index("bi_ds_type_idx").on(t.orgId, t.sourceType),
  ],
);

// ──────────────────────────────────────────────────────────────
// 77.4 BiQuery — SQL Query Builder (read-only, RLS enforced)
// ──────────────────────────────────────────────────────────────

export const biQuery = pgTable(
  "bi_query",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 300 }).notNull(),
    description: text("description"),
    dataSourceId: uuid("data_source_id").references(() => biDataSource.id),
    sqlText: text("sql_text").notNull(),
    status: biQueryStatusEnum("status").notNull().default("draft"),
    resultSchemaJson: jsonb("result_schema_json"),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    validationError: text("validation_error"),
    isSaved: boolean("is_saved").notNull().default(true),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bi_q_org_idx").on(t.orgId),
    index("bi_q_ds_idx").on(t.dataSourceId),
    index("bi_q_status_idx").on(t.orgId, t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 77.5 BiSharedDashboard — Public link sharing for dashboards
// ──────────────────────────────────────────────────────────────

export const biSharedDashboard = pgTable(
  "bi_shared_dashboard",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    reportId: uuid("report_id")
      .notNull()
      .references(() => biReport.id, { onDelete: "cascade" }),
    shareToken: varchar("share_token", { length: 128 }).notNull(),
    accessLevel: biShareAccessEnum("access_level").notNull().default("view"),
    password: varchar("password", { length: 256 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bi_sd_org_idx").on(t.orgId),
    index("bi_sd_report_idx").on(t.reportId),
    unique("bi_sd_token_unique").on(t.shareToken),
  ],
);

// ──────────────────────────────────────────────────────────────
// 77.6 BiBrandConfig — White-label branding per org
// ──────────────────────────────────────────────────────────────

export const biBrandConfig = pgTable(
  "bi_brand_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    logoUrl: varchar("logo_url", { length: 1000 }),
    primaryColor: varchar("primary_color", { length: 20 }),
    secondaryColor: varchar("secondary_color", { length: 20 }),
    fontFamily: varchar("font_family", { length: 100 }),
    headerText: varchar("header_text", { length: 500 }),
    footerText: varchar("footer_text", { length: 500 }),
    confidentialityLabel: varchar("confidentiality_label", { length: 200 }),
    showPageNumbers: boolean("show_page_numbers").notNull().default(true),
    customCss: text("custom_css"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("bi_bc_org_unique").on(t.orgId)],
);

// ──────────────────────────────────────────────────────────────
// 77.7 BiScheduledReport — Recurring report delivery
// ──────────────────────────────────────────────────────────────

export const biScheduledReport = pgTable(
  "bi_scheduled_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    reportId: uuid("report_id")
      .notNull()
      .references(() => biReport.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 500 }).notNull(),
    frequency: biScheduleFrequencyEnum("frequency").notNull(),
    cronExpression: varchar("cron_expression", { length: 100 }),
    outputFormat: biOutputFormatEnum("output_format").notNull().default("pdf"),
    recipientEmails: jsonb("recipient_emails")
      .notNull()
      .default(sql`'[]'::jsonb`),
    parametersJson: jsonb("parameters_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
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
    index("bi_sr_org_idx").on(t.orgId),
    index("bi_sr_report_idx").on(t.reportId),
    index("bi_sr_next_run_idx").on(t.isActive, t.nextRunAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 77.8 BiReportExecution — Execution log for generated reports
// ──────────────────────────────────────────────────────────────

export const biReportExecution = pgTable(
  "bi_report_execution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    reportId: uuid("report_id")
      .notNull()
      .references(() => biReport.id, { onDelete: "cascade" }),
    scheduledReportId: uuid("scheduled_report_id").references(
      () => biScheduledReport.id,
    ),
    status: biExecutionStatusEnum("status").notNull().default("queued"),
    outputFormat: biOutputFormatEnum("output_format").notNull().default("pdf"),
    filePath: varchar("file_path", { length: 1000 }),
    fileSize: integer("file_size"),
    executionTimeMs: integer("execution_time_ms"),
    parametersJson: jsonb("parameters_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
    error: text("error"),
    triggeredBy: uuid("triggered_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("bi_re_org_idx").on(t.orgId),
    index("bi_re_report_idx").on(t.reportId),
    index("bi_re_status_idx").on(t.orgId, t.status),
    index("bi_re_scheduled_idx").on(t.scheduledReportId),
  ],
);
