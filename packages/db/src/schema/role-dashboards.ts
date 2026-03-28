// Sprint 81: Role-Based Experience Redesign
// 2 entities: role_dashboard_config, role_dashboard_widget_preference

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

export const roleDashboardTypeEnum = pgEnum("role_dashboard_type", [
  "ciso",
  "cfo",
  "board",
  "auditor",
  "department_manager",
  "risk_manager",
  "dpo",
  "custom",
]);

export const roleDashboardWidgetCategoryEnum = pgEnum("role_dashboard_widget_category", [
  "risk_posture",
  "threat_intel",
  "top_risks",
  "financial_exposure",
  "audit_effort",
  "grc_roi",
  "maturity_radar",
  "findings_overview",
  "evidence_quality",
  "department_summary",
  "compliance_status",
  "kpi_summary",
]);

// ──────────────────────────────────────────────────────────────
// 81.1 RoleDashboardConfig — Per-role dashboard configuration
// ──────────────────────────────────────────────────────────────

export const roleDashboardConfig = pgTable(
  "role_dashboard_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    dashboardType: roleDashboardTypeEnum("dashboard_type").notNull(),
    name: varchar("name", { length: 300 }).notNull(),
    description: text("description"),
    layoutJson: jsonb("layout_json").notNull().default(sql`'[]'::jsonb`),
    widgetsJson: jsonb("widgets_json").notNull().default(sql`'[]'::jsonb`),
    filtersJson: jsonb("filters_json").notNull().default(sql`'{}'::jsonb`),
    refreshIntervalSeconds: integer("refresh_interval_seconds").notNull().default(300),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rdc_org_idx").on(t.orgId),
    index("rdc_type_idx").on(t.orgId, t.dashboardType),
    unique("rdc_org_type_default").on(t.orgId, t.dashboardType, t.isDefault),
  ],
);

// ──────────────────────────────────────────────────────────────
// 81.2 RoleDashboardWidgetPreference — User overrides per widget
// ──────────────────────────────────────────────────────────────

export const roleDashboardWidgetPreference = pgTable(
  "role_dashboard_widget_preference",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    dashboardConfigId: uuid("dashboard_config_id")
      .notNull()
      .references(() => roleDashboardConfig.id, { onDelete: "cascade" }),
    widgetKey: varchar("widget_key", { length: 200 }).notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
    positionOverride: jsonb("position_override"),
    configOverride: jsonb("config_override"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rdwp_org_idx").on(t.orgId),
    index("rdwp_user_idx").on(t.userId),
    unique("rdwp_user_widget_unique").on(t.userId, t.dashboardConfigId, t.widgetKey),
  ],
);
