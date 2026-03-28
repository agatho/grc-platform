// Sprint 58: Extension und Plugin Architecture (Drizzle ORM)
// 6 entities: plugin, plugin_hook, plugin_installation, plugin_execution_log, plugin_setting, extension_marketplace

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
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 58.1 Plugin — Plugin registry
// ──────────────────────────────────────────────────────────────

export const plugin = pgTable(
  "plugin",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    version: varchar("version", { length: 50 }).notNull(),
    author: varchar("author", { length: 255 }),
    authorUrl: varchar("author_url", { length: 500 }),
    repositoryUrl: varchar("repository_url", { length: 500 }),
    category: varchar("category", { length: 50 }).notNull().default("general"),
    tags: jsonb("tags").default("[]"),
    iconUrl: varchar("icon_url", { length: 500 }),
    entryPoint: varchar("entry_point", { length: 500 }).notNull(),
    executionMode: varchar("execution_mode", { length: 20 }).notNull().default("wasm"),
    permissions: jsonb("permissions").default("[]"),
    configSchema: jsonb("config_schema").default("{}"),
    isSystem: boolean("is_system").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    minPlatformVersion: varchar("min_platform_version", { length: 20 }),
    maxPlatformVersion: varchar("max_platform_version", { length: 20 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("plugin_category_idx").on(table.category),
    index("plugin_verified_idx").on(table.isVerified),
  ],
);

// ──────────────────────────────────────────────────────────────
// 58.2 PluginHook — Available hook points in the platform
// ──────────────────────────────────────────────────────────────

export const pluginHook = pgTable(
  "plugin_hook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 150 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    module: varchar("module", { length: 50 }),
    hookType: varchar("hook_type", { length: 30 }).notNull().default("filter"),
    inputSchema: jsonb("input_schema").default("{}"),
    outputSchema: jsonb("output_schema").default("{}"),
    isAsync: boolean("is_async").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("plugin_hook_module_idx").on(table.module),
    index("plugin_hook_type_idx").on(table.hookType),
  ],
);

// ──────────────────────────────────────────────────────────────
// 58.3 PluginInstallation — Per-org plugin installations
// ──────────────────────────────────────────────────────────────

export const pluginInstallation = pgTable(
  "plugin_installation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugin.id),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    config: jsonb("config").default("{}"),
    hookBindings: jsonb("hook_bindings").default("[]"),
    installedBy: uuid("installed_by")
      .notNull()
      .references(() => user.id),
    installedAt: timestamp("installed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    disabledBy: uuid("disabled_by").references(() => user.id),
  },
  (table) => [
    index("plugin_install_org_idx").on(table.orgId),
    uniqueIndex("plugin_install_unique_idx").on(table.orgId, table.pluginId),
    index("plugin_install_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 58.4 PluginExecutionLog — Execution audit trail
// ──────────────────────────────────────────────────────────────

export const pluginExecutionLog = pgTable(
  "plugin_execution_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => pluginInstallation.id),
    hookKey: varchar("hook_key", { length: 150 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    durationMs: integer("duration_ms"),
    inputPayload: jsonb("input_payload").default("{}"),
    outputPayload: jsonb("output_payload").default("{}"),
    errorMessage: text("error_message"),
    memoryUsedBytes: integer("memory_used_bytes"),
    cpuTimeMs: integer("cpu_time_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("plugin_exec_org_idx").on(table.orgId),
    index("plugin_exec_install_idx").on(table.installationId),
    index("plugin_exec_created_idx").on(table.createdAt),
    index("plugin_exec_hook_idx").on(table.hookKey),
  ],
);

// ──────────────────────────────────────────────────────────────
// 58.5 PluginSetting — Per-org plugin configuration overrides
// ──────────────────────────────────────────────────────────────

export const pluginSetting = pgTable(
  "plugin_setting",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => pluginInstallation.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 100 }).notNull(),
    value: jsonb("value").default("null"),
    isSecret: boolean("is_secret").notNull().default(false),
    updatedBy: uuid("updated_by").references(() => user.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("plugin_setting_unique_idx").on(table.installationId, table.key),
    index("plugin_setting_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 58.6 ExtensionMarketplace — Public extension listing
// ──────────────────────────────────────────────────────────────

export const extensionMarketplace = pgTable(
  "extension_marketplace",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugin.id)
      .unique(),
    title: varchar("title", { length: 255 }).notNull(),
    shortDescription: varchar("short_description", { length: 500 }),
    longDescription: text("long_description"),
    screenshots: jsonb("screenshots").default("[]"),
    pricingModel: varchar("pricing_model", { length: 30 }).notNull().default("free"),
    priceMonthly: integer("price_monthly"),
    priceYearly: integer("price_yearly"),
    downloadCount: integer("download_count").notNull().default(0),
    rating: integer("rating"),
    reviewCount: integer("review_count").notNull().default(0),
    isFeatured: boolean("is_featured").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ext_marketplace_featured_idx").on(table.isFeatured),
    index("ext_marketplace_pricing_idx").on(table.pricingModel),
    index("ext_marketplace_rating_idx").on(table.rating),
  ],
);
