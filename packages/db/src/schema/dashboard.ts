// Sprint 18: Custom Dashboards Schema (Drizzle ORM)
// 3 entities: widgetDefinition, customDashboard, customDashboardWidget

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 18.1 Widget Definition — Seed catalog of widget types
// ──────────────────────────────────────────────────────────────

export const widgetDefinition = pgTable(
  "widget_definition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 50 }).notNull().unique(),
    nameDe: varchar("name_de", { length: 200 }).notNull(),
    nameEn: varchar("name_en", { length: 200 }).notNull(),
    descriptionDe: text("description_de"),
    descriptionEn: text("description_en"),
    type: varchar("type", { length: 20 }).notNull(), // kpi | chart | table | special
    defaultConfig: jsonb("default_config").notNull(),
    minWidth: integer("min_width").notNull().default(2),
    minHeight: integer("min_height").notNull().default(2),
    maxWidth: integer("max_width").default(12),
    maxHeight: integer("max_height").default(8),
    requiredPermissions: text("required_permissions").array(),
    previewImageUrl: varchar("preview_image_url", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("wd_key_idx").on(table.key),
    index("wd_type_idx").on(table.type),
  ],
);

export const widgetDefinitionRelations = relations(
  widgetDefinition,
  ({ many }) => ({
    widgets: many(customDashboardWidget),
  }),
);

// ──────────────────────────────────────────────────────────────
// 18.2 Custom Dashboard — User-owned or team dashboard
// ──────────────────────────────────────────────────────────────

export const customDashboard = pgTable(
  "custom_dashboard",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id").references(() => user.id), // null = team dashboard
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    visibility: varchar("visibility", { length: 20 })
      .notNull()
      .default("personal"), // personal | team | org
    layoutJson: jsonb("layout_json").notNull().default("[]"),
    isDefault: boolean("is_default").notNull().default(false),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("cdash_org_idx").on(table.orgId),
    index("cd_user_idx").on(table.userId),
    index("cd_default_idx").on(table.orgId, table.isDefault),
  ],
);

export const customDashboardRelations = relations(
  customDashboard,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [customDashboard.orgId],
      references: [organization.id],
    }),
    owner: one(user, {
      fields: [customDashboard.userId],
      references: [user.id],
      relationName: "dashboardOwner",
    }),
    creator: one(user, {
      fields: [customDashboard.createdBy],
      references: [user.id],
      relationName: "dashboardCreator",
    }),
    widgets: many(customDashboardWidget),
  }),
);

// ──────────────────────────────────────────────────────────────
// 18.3 Custom Dashboard Widget — Instance of a widget on a dashboard
// ──────────────────────────────────────────────────────────────

export const customDashboardWidget = pgTable(
  "custom_dashboard_widget",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => customDashboard.id, { onDelete: "cascade" }),
    widgetDefinitionId: uuid("widget_definition_id")
      .notNull()
      .references(() => widgetDefinition.id),
    positionJson: jsonb("position_json").notNull(), // {x, y, w, h, minW, minH}
    configJson: jsonb("config_json").notNull().default("{}"), // {dataSource, filters, displayOptions}
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("cdw_dashboard_idx").on(table.dashboardId),
    index("cdw_definition_idx").on(table.widgetDefinitionId),
  ],
);

export const customDashboardWidgetRelations = relations(
  customDashboardWidget,
  ({ one }) => ({
    dashboard: one(customDashboard, {
      fields: [customDashboardWidget.dashboardId],
      references: [customDashboard.id],
    }),
    definition: one(widgetDefinition, {
      fields: [customDashboardWidget.widgetDefinitionId],
      references: [widgetDefinition.id],
    }),
  }),
);
