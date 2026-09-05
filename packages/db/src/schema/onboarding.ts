// Sprint 59: Onboarding Wizard und Template Library (Drizzle ORM)
// 5 entities: onboarding_session, onboarding_step, template_pack, template_pack_item, import_job

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
// 59.1 OnboardingSession — Tracks org first-time setup progress
// ──────────────────────────────────────────────────────────────

export const onboardingSession = pgTable(
  "onboarding_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    status: varchar("status", { length: 20 }).notNull().default("in_progress"),
    currentStep: integer("current_step").notNull().default(1),
    totalSteps: integer("total_steps").notNull().default(8),
    selectedFrameworks: jsonb("selected_frameworks").default("[]"),
    selectedModules: jsonb("selected_modules").default("[]"),
    orgProfile: jsonb("org_profile").default("{}"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    startedBy: uuid("started_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("onboarding_org_idx").on(table.orgId),
    index("onboarding_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 59.2 OnboardingStep — Individual step completion tracking
// ──────────────────────────────────────────────────────────────

export const onboardingStep = pgTable(
  "onboarding_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => onboardingSession.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    stepKey: varchar("step_key", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    data: jsonb("data").default("{}"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("onboarding_step_unique_idx").on(
      table.sessionId,
      table.stepNumber,
    ),
    index("onboarding_step_key_idx").on(table.stepKey),
  ],
);

// ──────────────────────────────────────────────────────────────
// 59.3 TemplatePack — Compliance template packs
// ──────────────────────────────────────────────────────────────

export const templatePack = pgTable(
  "template_pack",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    frameworkKey: varchar("framework_key", { length: 50 }).notNull(),
    version: varchar("version", { length: 20 }).notNull().default("1.0.0"),
    category: varchar("category", { length: 50 })
      .notNull()
      .default("compliance"),
    itemCount: integer("item_count").notNull().default(0),
    iconKey: varchar("icon_key", { length: 50 }),
    isDefault: boolean("is_default").notNull().default(false),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("template_pack_framework_idx").on(table.frameworkKey),
    index("template_pack_category_idx").on(table.category),
  ],
);

// ──────────────────────────────────────────────────────────────
// 59.4 TemplatePackItem — Items within a template pack
// ──────────────────────────────────────────────────────────────

export const templatePackItem = pgTable(
  "template_pack_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => templatePack.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    referenceId: varchar("reference_id", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(0),
    data: jsonb("data").notNull().default("{}"),
    parentItemId: uuid("parent_item_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("template_item_pack_idx").on(table.packId),
    index("template_item_entity_idx").on(table.entityType),
    index("template_item_sort_idx").on(table.packId, table.sortOrder),
  ],
);

// ──────────────────────────────────────────────────────────────
// 59.5 ImportJob — entfernt (S09-08)
// ──────────────────────────────────────────────────────────────
// [ARCTOS-FULL-2026-08-31 / WP1 · S09-08] Die zweite pgTable-Definition für
// die SQL-Tabelle `import_job` ist hier entfernt. `onboardingImportJob` und
// `importJob` (in ./import-export.ts) deklarierten dieselbe Tabelle mit
// DISJUNKTEN Spaltenmengen und kollidierenden Indexnamen. Die Datenbank trägt
// die Gestalt von `importJob`:
//   id, org_id, entity_type, file_name, file_size, mime_type, status,
//   total_rows, valid_rows, error_rows, imported_rows, column_mapping,
//   validation_errors, log_json, raw_headers, raw_preview_rows, source,
//   template_pack_id, total_items, processed_items, failed_items, error_log, …
// Ein Import der hier entfernten Definition hätte zur Laufzeit
// `column … does not exist` erzeugt; der Schema-Drift-Endpunkt zählte beide
// als „vorhanden". Wird die zweite Gestalt fachlich gebraucht, gehört sie in
// eine eigene Tabelle mit eigenem Namen und eigener Migration.
