// Connector Framework (ADR-014 Phase 3)
//
// Plugin-basiertes Import/Export-Framework fuer externe Systeme (Jira,
// ServiceNow, Azure, Okta, Splunk, ...). Ergaenzt die bereits vorhandenen
// evidence-connector.ts / cloud-connector.ts / identity-saas-connector.ts
// um die generische Connector-Registry + Sync-Logging.
//
// Migration: 0083_round6_connectors.sql

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

export const connectorTypeDefinition = pgTable("connector_type_definition", {
  connectorType: varchar("connector_type", { length: 50 }).primaryKey(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  displayNameDe: varchar("display_name_de", { length: 255 }),
  category: varchar("category", { length: 50 }).notNull(),
  description: text("description"),
  descriptionDe: text("description_de"),
  icon: varchar("icon", { length: 50 }),
  // JSON-Schema fuer Config-Fields des Connectors
  configSchema: jsonb("config_schema").default({}),
  isAvailable: boolean("is_available").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const connectorInstance = pgTable("connector_instance", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  // FK auf connectorTypeDefinition.connectorType -- Drizzle unterstuetzt
  // referenzierte Non-UUID-Keys, hier via Text-Match
  connectorType: varchar("connector_type", { length: 50 }).notNull().references(() => connectorTypeDefinition.connectorType),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // oauth2 | api_key | basic_auth | certificate | none
  authMethod: varchar("auth_method", { length: 30 }).default("oauth2").notNull(),
  config: jsonb("config").default({}).notNull(),
  // Verschluesselt mit CONNECTOR_ENCRYPTION_KEY (env-var, ADR-018)
  credentialsEncrypted: text("credentials_encrypted"),
  // pull | push | bidirectional
  syncDirection: varchar("sync_direction", { length: 20 }).default("pull").notNull(),
  // manual | hourly | daily | weekly | realtime
  syncFrequency: varchar("sync_frequency", { length: 20 }).default("daily"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: varchar("last_sync_status", { length: 20 }),
  lastSyncRecords: integer("last_sync_records"),
  lastError: text("last_error"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const connectorFieldMapping = pgTable("connector_field_mapping", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectorId: uuid("connector_id").notNull().references(() => connectorInstance.id, { onDelete: "cascade" }),
  sourceField: varchar("source_field", { length: 255 }).notNull(),
  targetEntity: varchar("target_entity", { length: 50 }).notNull(),
  targetField: varchar("target_field", { length: 100 }).notNull(),
  // direct | lookup | regex | template | scripted
  transformation: varchar("transformation", { length: 50 }).default("direct"),
  transformConfig: jsonb("transform_config").default({}),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const connectorSyncLog = pgTable("connector_sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectorId: uuid("connector_id").notNull().references(() => connectorInstance.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  // full | incremental | delta | repair
  syncType: varchar("sync_type", { length: 20 }).default("full").notNull(),
  // success | partial | failed | cancelled
  status: varchar("status", { length: 20 }).notNull(),
  recordsPulled: integer("records_pulled").default(0),
  recordsPushed: integer("records_pushed").default(0),
  recordsFailed: integer("records_failed").default(0),
  // Array<{ record: string; error: string }>
  errorDetails: jsonb("error_details").default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
});
