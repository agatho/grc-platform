// Sprint 19: Bulk Import/Export Schema (Drizzle ORM)
// 2 entities: import_job, import_column_mapping

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// import_job — Tracks import job lifecycle
// ──────────────────────────────────────────────────────────────

export const importJob = pgTable(
  "import_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("uploaded"),
    totalRows: integer("total_rows"),
    validRows: integer("valid_rows"),
    errorRows: integer("error_rows"),
    importedRows: integer("imported_rows"),
    columnMapping: jsonb("column_mapping"),
    validationErrors: jsonb("validation_errors").default("[]"),
    logJson: jsonb("log_json").default("[]"),
    rawHeaders: jsonb("raw_headers").default("[]"),
    rawPreviewRows: jsonb("raw_preview_rows").default("[]"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index("ij_org_idx").on(table.orgId),
    statusIdx: index("ij_status_idx").on(table.orgId, table.status),
    createdByIdx: index("ij_created_by_idx").on(table.createdBy),
  }),
);

// ──────────────────────────────────────────────────────────────
// import_column_mapping — Saved mapping templates for reuse
// ──────────────────────────────────────────────────────────────

export const importColumnMapping = pgTable(
  "import_column_mapping",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    mappingJson: jsonb("mapping_json").notNull(),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgEntityIdx: index("icm_org_entity_idx").on(
      table.orgId,
      table.entityType,
    ),
  }),
);

// ──────────────────────────────────────────────────────────────
// export_schedule — Scheduled recurring exports
// ──────────────────────────────────────────────────────────────

export const exportSchedule = pgTable(
  "export_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 200 }).notNull(),
    entityTypes: jsonb("entity_types").notNull(), // string[]
    format: varchar("format", { length: 10 }).notNull().default("csv"),
    cronExpression: varchar("cron_expression", { length: 50 })
      .notNull()
      .default("0 6 * * 1"), // Monday 06:00
    recipientEmails: jsonb("recipient_emails").notNull(), // string[]
    filters: jsonb("filters").default("{}"),
    isActive: varchar("is_active", { length: 5 }).notNull().default("true"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("es_org_idx").on(table.orgId),
  }),
);
