// Sprint 64: Identity und SaaS Connectors
// 3 entities: identity_connector_config, identity_test_result, saas_compliance_check

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { organization } from "./platform";
import { evidenceConnector } from "./evidence-connector";

// ──────────────────────────────────────────────────────────────
// 64.1 IdentityConnectorConfig — IdP-specific configuration
// Entra ID, Google Workspace, Generic OIDC, HR Systems
// ──────────────────────────────────────────────────────────────

export const identityConnectorConfig = pgTable(
  "identity_connector_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    identityProvider: varchar("identity_provider", { length: 50 }).notNull(), // entra_id | google_workspace | okta | generic_oidc | hr_system
    tenantId: varchar("tenant_id", { length: 255 }),
    domain: varchar("domain", { length: 255 }),
    syncEnabled: boolean("sync_enabled").notNull().default(false),
    syncInterval: varchar("sync_interval", { length: 20 })
      .notNull()
      .default("daily"), // hourly | daily | weekly
    mfaCheckEnabled: boolean("mfa_check_enabled").notNull().default(true),
    staleAccountDays: integer("stale_account_days").notNull().default(90),
    passwordPolicyCheck: boolean("password_policy_check")
      .notNull()
      .default(true),
    accessReviewEnabled: boolean("access_review_enabled")
      .notNull()
      .default(true),
    privilegedAccountMonitoring: boolean("privileged_account_monitoring")
      .notNull()
      .default(true),
    guestAccessCheck: boolean("guest_access_check").notNull().default(true),
    conditionalAccessCheck: boolean("conditional_access_check")
      .notNull()
      .default(true),
    dlpEnabled: boolean("dlp_enabled").notNull().default(false),
    retentionPolicyCheck: boolean("retention_policy_check")
      .notNull()
      .default(false),
    onboardingCheck: boolean("onboarding_check").notNull().default(false),
    offboardingCheck: boolean("offboarding_check").notNull().default(false),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    syncStatus: varchar("sync_status", { length: 20 }).default("pending"), // pending | syncing | synced | error
    config: jsonb("config").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("icc_org_idx").on(table.orgId),
    index("icc_connector_idx").on(table.connectorId),
    index("icc_provider_idx").on(table.identityProvider),
  ],
);

// ──────────────────────────────────────────────────────────────
// 64.2 IdentityTestResult — Identity & access test outcomes
// ──────────────────────────────────────────────────────────────

export const identityTestResult = pgTable(
  "identity_test_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    configId: uuid("config_id")
      .notNull()
      .references(() => identityConnectorConfig.id),
    testCategory: varchar("test_category", { length: 50 }).notNull(), // mfa_enforcement | stale_accounts | password_policy | access_review | privileged_accounts | guest_access | conditional_access | dlp | retention | onboarding | offboarding
    testName: varchar("test_name", { length: 500 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // pass | fail | warning | error | skipped
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    totalUsers: integer("total_users").notNull().default(0),
    compliantUsers: integer("compliant_users").notNull().default(0),
    nonCompliantUsers: integer("non_compliant_users").notNull().default(0),
    complianceRate: numeric("compliance_rate", { precision: 5, scale: 2 }),
    findings: jsonb("findings").default("[]"), // [{userId, userName, issue, severity}]
    evidence: jsonb("evidence").default("{}"),
    remediationSteps: text("remediation_steps"),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("itr_org_idx").on(table.orgId),
    index("itr_connector_idx").on(table.connectorId),
    index("itr_config_idx").on(table.configId),
    index("itr_category_idx").on(table.testCategory),
    index("itr_status_idx").on(table.status),
    index("itr_executed_idx").on(table.executedAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 64.3 SaasComplianceCheck — SaaS platform compliance checks
// M365 DLP, Retention, Google Workspace, HR System checks
// ──────────────────────────────────────────────────────────────

export const saasComplianceCheck = pgTable(
  "saas_compliance_check",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 50 }).notNull(), // m365 | google_workspace | hr_system
    checkType: varchar("check_type", { length: 50 }).notNull(), // dlp_policy | retention_policy | sharing_policy | external_sharing | mailbox_audit | drive_sharing | onboarding_sla | offboarding_sla
    checkName: varchar("check_name", { length: 500 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // compliant | non_compliant | partial | error | not_applicable
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    details: jsonb("details").default("{}"),
    findings: jsonb("findings").default("[]"),
    affectedResources: integer("affected_resources").notNull().default(0),
    totalResources: integer("total_resources").notNull().default(0),
    complianceRate: numeric("compliance_rate", { precision: 5, scale: 2 }),
    remediationGuide: text("remediation_guide"),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("scc_org_idx").on(table.orgId),
    index("scc_connector_idx").on(table.connectorId),
    index("scc_platform_idx").on(table.platform),
    index("scc_check_type_idx").on(table.checkType),
    index("scc_status_idx").on(table.status),
    index("scc_executed_idx").on(table.executedAt),
  ],
);
