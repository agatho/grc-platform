// Sprint 21: Multi-Language Content Management Schema (Drizzle ORM)
// 1 entity: translation_status — tracks provenance of every translation

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const translationStatusValueEnum = pgEnum("translation_status_value", [
  "original",
  "draft_translation",
  "verified",
  "outdated",
]);

export const translationMethodEnum = pgEnum("translation_method", [
  "manual",
  "ai_claude",
  "ai_ollama",
  "xliff_import",
  "csv_import",
]);

// ──────────────────────────────────────────────────────────────
// 21.1 TranslationStatus — Per-field per-language translation tracking
// ──────────────────────────────────────────────────────────────

export const translationStatus = pgTable(
  "translation_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    field: varchar("field", { length: 50 }).notNull(),
    language: varchar("language", { length: 5 }).notNull(),
    status: translationStatusValueEnum("status").notNull().default("original"),
    method: translationMethodEnum("method"),
    translatedBy: uuid("translated_by").references(() => user.id),
    translatedAt: timestamp("translated_at", { withTimezone: true }),
    sourceHash: varchar("source_hash", { length: 64 }),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("ts_entity_idx").on(table.entityType, table.entityId),
    index("ts_lang_status_idx").on(table.orgId, table.language, table.status),
    index("ts_org_entity_type_idx").on(table.orgId, table.entityType),
    unique("ts_unique_field_lang").on(
      table.orgId,
      table.entityType,
      table.entityId,
      table.field,
      table.language,
    ),
  ],
);
