// Sprint 20: SSO (SAML 2.0 + OIDC) + SCIM User Provisioning Schema (Drizzle ORM)
// 3 new tables: sso_config, scim_token, scim_sync_log
// 1 table extension: user (external_id, identity_provider, last_synced_at)

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const ssoProviderTypeEnum = pgEnum("sso_provider_type", [
  "saml",
  "oidc",
]);

export const identityProviderEnum = pgEnum("identity_provider", [
  "local",
  "saml",
  "oidc",
  "scim",
]);

export const scimSyncActionEnum = pgEnum("scim_sync_action", [
  "create",
  "update",
  "deactivate",
  "reactivate",
  "group_assign",
  "group_remove",
]);

export const scimSyncStatusEnum = pgEnum("scim_sync_status", [
  "success",
  "error",
  "skipped",
]);

// ──────────────────────────────────────────────────────────────
// 20.1 sso_config — Per-org SSO configuration (SAML or OIDC)
// ──────────────────────────────────────────────────────────────

export const ssoConfig = pgTable(
  "sso_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    provider: ssoProviderTypeEnum("provider").notNull(),
    displayName: varchar("display_name", { length: 200 }),
    // SAML fields
    samlMetadataUrl: varchar("saml_metadata_url", { length: 2000 }),
    samlEntityId: varchar("saml_entity_id", { length: 500 }),
    samlSsoUrl: varchar("saml_sso_url", { length: 2000 }),
    samlCertificate: text("saml_certificate"),
    samlAttributeMapping: jsonb("saml_attribute_mapping").default(
      '{"email":"email","firstName":"givenName","lastName":"sn","groups":"memberOf"}',
    ),
    // OIDC fields
    oidcDiscoveryUrl: varchar("oidc_discovery_url", { length: 2000 }),
    oidcClientId: varchar("oidc_client_id", { length: 500 }),
    oidcClientSecret: text("oidc_client_secret"), // encrypted at rest
    oidcScopes: text("oidc_scopes").default("openid profile email"),
    oidcClaimMapping: jsonb("oidc_claim_mapping").default(
      '{"email":"email","firstName":"given_name","lastName":"family_name","groups":"groups"}',
    ),
    // General SSO settings
    isActive: boolean("is_active").notNull().default(false),
    enforceSSO: boolean("enforce_sso").notNull().default(false),
    defaultRole: varchar("default_role", { length: 50 }).default("viewer"),
    groupRoleMapping: jsonb("group_role_mapping").default("{}"),
    autoProvision: boolean("auto_provision").notNull().default(true),
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
  (table) => [uniqueIndex("sso_org_idx").on(table.orgId)],
);

// ──────────────────────────────────────────────────────────────
// 20.2 scim_token — SCIM bearer tokens (hashed, org-scoped)
// ──────────────────────────────────────────────────────────────

export const scimToken = pgTable(
  "scim_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    description: varchar("description", { length: 200 }),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => user.id),
  },
  (table) => [
    index("st_org_idx").on(table.orgId),
    index("st_hash_idx").on(table.tokenHash),
  ],
);

// ──────────────────────────────────────────────────────────────
// 20.3 scim_sync_log — Audit log for SCIM operations
// ──────────────────────────────────────────────────────────────

export const scimSyncLog = pgTable(
  "scim_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    action: scimSyncActionEnum("action").notNull(),
    status: scimSyncStatusEnum("status").notNull(),
    scimResourceId: varchar("scim_resource_id", { length: 255 }),
    userId: uuid("user_id").references(() => user.id),
    userEmail: varchar("user_email", { length: 255 }),
    requestPayload: jsonb("request_payload"),
    responsePayload: jsonb("response_payload"),
    errorMessage: text("error_message"),
    tokenId: uuid("token_id").references(() => scimToken.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ssl_org_idx").on(table.orgId, table.createdAt),
    index("ssl_action_idx").on(table.orgId, table.action),
    index("ssl_user_idx").on(table.userId),
  ],
);
