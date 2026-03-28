// Sprint 62: Evidence Connector Framework
// 8 entities: evidence_connector, connector_credential, connector_schedule,
// evidence_artifact, connector_health_check, connector_test_definition,
// connector_test_result, evidence_freshness_config

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
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 62.1 EvidenceConnector — Connector instance definition
// ──────────────────────────────────────────────────────────────

export const evidenceConnector = pgTable(
  "evidence_connector",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    connectorType: varchar("connector_type", { length: 50 }).notNull(), // aws | azure | gcp | entra_id | google_workspace | m365 | git_platform | issue_tracker | endpoint_mgmt | network_firewall | wiki | hr_system | custom_api | file_import
    providerKey: varchar("provider_key", { length: 100 }).notNull(), // e.g. aws_iam, azure_ad, gcp_iam
    version: varchar("version", { length: 20 }).notNull().default("1.0.0"),
    status: varchar("status", { length: 30 }).notNull().default("inactive"), // inactive | active | error | disabled | pending_setup
    authMethod: varchar("auth_method", { length: 30 }).notNull(), // oauth2 | api_key | service_account | certificate | basic_auth
    baseUrl: varchar("base_url", { length: 1000 }),
    config: jsonb("config").default("{}"), // connector-specific config (region, tenant_id, etc.)
    capabilities: jsonb("capabilities").default("[]"), // list of test IDs this connector can run
    lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
    healthStatus: varchar("health_status", { length: 20 }).default("unknown"), // healthy | degraded | unhealthy | unknown
    errorMessage: text("error_message"),
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
    index("ec_org_idx").on(table.orgId),
    index("ec_type_idx").on(table.connectorType),
    index("ec_status_idx").on(table.orgId, table.status),
    index("ec_provider_idx").on(table.providerKey),
  ],
);

// ──────────────────────────────────────────────────────────────
// 62.2 ConnectorCredential — AES-256 encrypted credential vault
// ──────────────────────────────────────────────────────────────

export const connectorCredential = pgTable(
  "connector_credential",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    credentialType: varchar("credential_type", { length: 30 }).notNull(), // oauth2_token | api_key | service_account_json | client_certificate | basic_credentials
    encryptedPayload: text("encrypted_payload").notNull(), // AES-256-GCM encrypted
    iv: varchar("iv", { length: 64 }).notNull(), // initialization vector
    authTag: varchar("auth_tag", { length: 64 }).notNull(), // GCM auth tag
    keyVersion: integer("key_version").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    refreshToken: text("refresh_token"), // encrypted OAuth2 refresh token
    scopes: jsonb("scopes").default("[]"), // granted OAuth2 scopes
    lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ccred_connector_idx").on(table.connectorId),
    index("ccred_org_idx").on(table.orgId),
    index("ccred_expiry_idx").on(table.expiresAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 62.3 ConnectorSchedule — Cron-based evidence collection scheduling
// ──────────────────────────────────────────────────────────────

export const connectorSchedule = pgTable(
  "connector_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    cronExpression: varchar("cron_expression", { length: 100 }).notNull(), // e.g. "0 2 * * *"
    timezone: varchar("timezone", { length: 50 }).notNull().default("Europe/Berlin"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    testIds: jsonb("test_ids").default("[]"), // specific tests to run, empty = all
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunStatus: varchar("last_run_status", { length: 20 }), // success | partial_failure | failure
    lastRunDurationMs: integer("last_run_duration_ms"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("csched_connector_idx").on(table.connectorId),
    index("csched_next_run_idx").on(table.nextRunAt, table.isEnabled),
    index("csched_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 62.4 EvidenceArtifact — Collected evidence artifact storage
// ──────────────────────────────────────────────────────────────

export const evidenceArtifact = pgTable(
  "evidence_artifact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    testResultId: uuid("test_result_id"),
    artifactType: varchar("artifact_type", { length: 30 }).notNull(), // screenshot | json_export | csv_export | pdf_report | log_extract | config_snapshot | api_response
    fileName: varchar("file_name", { length: 500 }).notNull(),
    storagePath: varchar("storage_path", { length: 1000 }).notNull(), // S3 path
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    metadata: jsonb("metadata").default("{}"), // source info, timestamps, etc.
    retentionDays: integer("retention_days").notNull().default(365),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    collectedAt: timestamp("collected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ea_connector_idx").on(table.connectorId),
    index("ea_org_idx").on(table.orgId),
    index("ea_type_idx").on(table.artifactType),
    index("ea_collected_idx").on(table.collectedAt),
    index("ea_expiry_idx").on(table.expiresAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 62.5 ConnectorHealthCheck — Periodic health probe records
// ──────────────────────────────────────────────────────────────

export const connectorHealthCheck = pgTable(
  "connector_health_check",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull(), // healthy | degraded | unhealthy
    responseTimeMs: integer("response_time_ms"),
    checkType: varchar("check_type", { length: 30 }).notNull(), // connectivity | authentication | authorization | data_access
    errorMessage: text("error_message"),
    details: jsonb("details").default("{}"),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chc_connector_idx").on(table.connectorId),
    index("chc_org_idx").on(table.orgId),
    index("chc_checked_idx").on(table.checkedAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 62.6 ConnectorTestDefinition — Predefined auto-test catalog
// ──────────────────────────────────────────────────────────────

export const connectorTestDefinition = pgTable(
  "connector_test_definition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testKey: varchar("test_key", { length: 100 }).notNull().unique(),
    connectorType: varchar("connector_type", { length: 50 }).notNull(),
    providerKey: varchar("provider_key", { length: 100 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 50 }).notNull(), // iam | encryption | logging | network | data_protection | access_control | configuration | monitoring
    severity: varchar("severity", { length: 20 }).notNull().default("medium"), // critical | high | medium | low | informational
    frameworkMappings: jsonb("framework_mappings").default("[]"), // [{framework: "ISO27001", controlId: "A.9.2.1"}]
    testLogic: jsonb("test_logic").notNull(), // { apiCalls: [], evaluationRules: [] }
    expectedResult: jsonb("expected_result").default("{}"),
    remediationGuide: text("remediation_guide"),
    isBuiltIn: boolean("is_built_in").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ctd_type_idx").on(table.connectorType),
    index("ctd_provider_idx").on(table.providerKey),
    index("ctd_category_idx").on(table.category),
    index("ctd_severity_idx").on(table.severity),
  ],
);

// ──────────────────────────────────────────────────────────────
// 62.7 ConnectorTestResult — Individual test execution results
// ──────────────────────────────────────────────────────────────

export const connectorTestResult = pgTable(
  "connector_test_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    testDefinitionId: uuid("test_definition_id")
      .notNull()
      .references(() => connectorTestDefinition.id),
    scheduleId: uuid("schedule_id").references(() => connectorSchedule.id),
    status: varchar("status", { length: 20 }).notNull(), // pass | fail | error | skipped | warning
    result: jsonb("result").default("{}"), // actual test output
    findings: jsonb("findings").default("[]"), // [{severity, message, resource}]
    resourcesScanned: integer("resources_scanned").notNull().default(0),
    resourcesFailed: integer("resources_failed").notNull().default(0),
    durationMs: integer("duration_ms"),
    artifactIds: jsonb("artifact_ids").default("[]"), // references to evidence_artifact
    errorMessage: text("error_message"),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ctr_connector_idx").on(table.connectorId),
    index("ctr_test_def_idx").on(table.testDefinitionId),
    index("ctr_org_idx").on(table.orgId),
    index("ctr_status_idx").on(table.status),
    index("ctr_executed_idx").on(table.executedAt),
    index("ctr_schedule_idx").on(table.scheduleId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 62.8 EvidenceFreshnessConfig — Freshness thresholds per control
// ──────────────────────────────────────────────────────────────

export const evidenceFreshnessConfig = pgTable(
  "evidence_freshness_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(), // control | risk | process
    entityId: uuid("entity_id"),
    connectorId: uuid("connector_id").references(() => evidenceConnector.id),
    testKey: varchar("test_key", { length: 100 }),
    maxAgeDays: integer("max_age_days").notNull().default(30),
    warningDays: integer("warning_days").notNull().default(7), // days before maxAge to start warning
    autoCollect: boolean("auto_collect").notNull().default(true),
    notifyOnStale: boolean("notify_on_stale").notNull().default(true),
    notifyRoles: jsonb("notify_roles").default('["control_owner", "risk_manager"]'),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("efc_org_idx").on(table.orgId),
    index("efc_entity_idx").on(table.entityType, table.entityId),
    index("efc_connector_idx").on(table.connectorId),
  ],
);
