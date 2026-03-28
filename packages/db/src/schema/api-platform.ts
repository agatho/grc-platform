// Sprint 57: API Platform und Developer Portal (Drizzle ORM)
// 6 entities: api_key, api_scope, api_key_scope, api_usage_log, developer_app, api_playground_snippet

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
  bigint,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 57.1 ApiKey — API key management for external integrations
// ──────────────────────────────────────────────────────────────

export const apiKey = pgTable(
  "api_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    keyHash: varchar("key_hash", { length: 512 }).notNull(),
    keyLast4: varchar("key_last4", { length: 4 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
    rateLimitPerDay: integer("rate_limit_per_day").notNull().default(10000),
    allowedIps: jsonb("allowed_ips").default("[]"),
    metadata: jsonb("metadata").default("{}"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => user.id),
  },
  (table) => [
    index("api_key_org_idx").on(table.orgId),
    index("api_key_status_idx").on(table.orgId, table.status),
    uniqueIndex("api_key_prefix_idx").on(table.keyPrefix),
    index("api_key_created_by_idx").on(table.createdBy),
  ],
);

// ──────────────────────────────────────────────────────────────
// 57.2 ApiScope — Available API scopes/permissions
// ──────────────────────────────────────────────────────────────

export const apiScope = pgTable(
  "api_scope",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    module: varchar("module", { length: 50 }),
    readWrite: varchar("read_write", { length: 10 }).notNull().default("read"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_scope_module_idx").on(table.module),
  ],
);

// ──────────────────────────────────────────────────────────────
// 57.3 ApiKeyScope — M:N link between api_key and api_scope
// ──────────────────────────────────────────────────────────────

export const apiKeyScope = pgTable(
  "api_key_scope",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => apiKey.id, { onDelete: "cascade" }),
    scopeId: uuid("scope_id")
      .notNull()
      .references(() => apiScope.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("api_key_scope_unique_idx").on(table.apiKeyId, table.scopeId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 57.4 ApiUsageLog — Per-request API usage tracking
// ──────────────────────────────────────────────────────────────

export const apiUsageLog = pgTable(
  "api_usage_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    apiKeyId: uuid("api_key_id").references(() => apiKey.id),
    method: varchar("method", { length: 10 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    statusCode: integer("status_code").notNull(),
    responseTimeMs: integer("response_time_ms"),
    requestSize: integer("request_size"),
    responseSize: integer("response_size"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    errorCode: varchar("error_code", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_usage_org_idx").on(table.orgId),
    index("api_usage_key_idx").on(table.apiKeyId),
    index("api_usage_created_idx").on(table.createdAt),
    index("api_usage_path_idx").on(table.orgId, table.path),
  ],
);

// ──────────────────────────────────────────────────────────────
// 57.5 DeveloperApp — OAuth2 application registrations
// ──────────────────────────────────────────────────────────────

export const developerApp = pgTable(
  "developer_app",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    clientId: varchar("client_id", { length: 64 }).notNull().unique(),
    clientSecretHash: varchar("client_secret_hash", { length: 512 }).notNull(),
    clientSecretLast4: varchar("client_secret_last4", { length: 4 }).notNull(),
    redirectUris: jsonb("redirect_uris").default("[]"),
    grantTypes: jsonb("grant_types").default('["authorization_code"]'),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    logoUrl: varchar("logo_url", { length: 500 }),
    homepageUrl: varchar("homepage_url", { length: 500 }),
    privacyUrl: varchar("privacy_url", { length: 500 }),
    tosUrl: varchar("tos_url", { length: 500 }),
    createdBy: uuid("created_by")
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
    index("dev_app_org_idx").on(table.orgId),
    index("dev_app_status_idx").on(table.orgId, table.status),
    uniqueIndex("dev_app_client_id_idx").on(table.clientId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 57.6 ApiPlaygroundSnippet — Saved API playground snippets
// ──────────────────────────────────────────────────────────────

export const apiPlaygroundSnippet = pgTable(
  "api_playground_snippet",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    method: varchar("method", { length: 10 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    headers: jsonb("headers").default("{}"),
    queryParams: jsonb("query_params").default("{}"),
    body: text("body"),
    isPublic: boolean("is_public").notNull().default(false),
    createdBy: uuid("created_by")
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
    index("playground_org_idx").on(table.orgId),
    index("playground_created_by_idx").on(table.createdBy),
  ],
);
