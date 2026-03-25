// Sprint 1.3: Module System Schema (Drizzle ORM)
// 2 entities per PRD §021: module_definition (platform-wide), module_config (per-org)

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  date,
  index,
  unique,
} from "drizzle-orm/pg-core";

import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const moduleUiStatusEnum = pgEnum("module_ui_status", [
  "disabled",
  "preview",
  "enabled",
  "maintenance",
]);

// ──────────────────────────────────────────────────────────────
// 2.1 ModuleDefinition — Platform-wide module registry
//     No org_id, no RLS. One row per module.
// ──────────────────────────────────────────────────────────────

export const moduleDefinition = pgTable("module_definition", {
  moduleKey: varchar("module_key", { length: 50 }).primaryKey(),
  displayNameDe: varchar("display_name_de", { length: 100 }).notNull(),
  displayNameEn: varchar("display_name_en", { length: 100 }).notNull(),
  descriptionDe: text("description_de"),
  descriptionEn: text("description_en"),
  icon: varchar("icon", { length: 50 }),
  navPath: varchar("nav_path", { length: 100 }),
  navSection: varchar("nav_section", { length: 50 }),
  navOrder: integer("nav_order").notNull(),
  requiresModules: text("requires_modules").array().notNull().default([]),
  licenseTier: varchar("license_tier", { length: 50 }).notNull().default("included"),
  isActiveInPlatform: boolean("is_active_in_platform").notNull().default(true),
  backgroundProcesses: text("background_processes").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ──────────────────────────────────────────────────────────────
// 2.2 ModuleConfig — Per-org module configuration
//     Has org_id + RLS. One row per (org, module).
// ──────────────────────────────────────────────────────────────

export const moduleConfig = pgTable(
  "module_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    moduleKey: varchar("module_key", { length: 50 })
      .notNull()
      .references(() => moduleDefinition.moduleKey),
    uiStatus: moduleUiStatusEnum("ui_status").notNull().default("disabled"),
    isDataActive: boolean("is_data_active").notNull().default(true),
    config: jsonb("config").notNull().default({}),
    licenseTier: varchar("license_tier", { length: 50 }).default("included"),
    licensedUntil: date("licensed_until"),
    enabledAt: timestamp("enabled_at", { withTimezone: true }),
    enabledBy: uuid("enabled_by").references(() => user.id),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    disabledBy: uuid("disabled_by").references(() => user.id),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    updatedBy: uuid("updated_by").references(() => user.id),
  },
  (table) => [
    unique("module_config_org_module_uq").on(table.orgId, table.moduleKey),
    index("module_config_lookup_idx").on(table.orgId, table.moduleKey, table.uiStatus),
  ],
);
