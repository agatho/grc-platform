// Sprint 65: DevOps und IT Connectors
// 3 entities: devops_connector_config, devops_test_result, it_infrastructure_check

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
// 65.1 DevopsConnectorConfig — Git, Issue Tracker, Wiki configs
// ──────────────────────────────────────────────────────────────

export const devopsConnectorConfig = pgTable(
  "devops_connector_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 50 }).notNull(), // github | gitlab | bitbucket | jira | confluence | servicenow | wiki_generic
    platformCategory: varchar("platform_category", { length: 30 }).notNull(), // git_platform | issue_tracker | wiki | endpoint_mgmt | network_firewall
    branchProtectionCheck: boolean("branch_protection_check")
      .notNull()
      .default(true),
    codeReviewCheck: boolean("code_review_check").notNull().default(true),
    sastEnabled: boolean("sast_enabled").notNull().default(true),
    secretScanningCheck: boolean("secret_scanning_check")
      .notNull()
      .default(true),
    slaComplianceCheck: boolean("sla_compliance_check").notNull().default(true),
    docsFreshnessCheck: boolean("docs_freshness_check").notNull().default(true),
    docsFreshnessMaxDays: integer("docs_freshness_max_days")
      .notNull()
      .default(180),
    endpointComplianceCheck: boolean("endpoint_compliance_check")
      .notNull()
      .default(false),
    firewallRuleCheck: boolean("firewall_rule_check").notNull().default(false),
    repositories: jsonb("repositories").default("[]"), // repos to monitor
    projects: jsonb("projects").default("[]"), // issue tracker projects
    spaces: jsonb("spaces").default("[]"), // wiki spaces
    config: jsonb("config").default("{}"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    syncStatus: varchar("sync_status", { length: 20 }).default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("dcc_org_idx").on(table.orgId),
    index("dcc_connector_idx").on(table.connectorId),
    index("dcc_platform_idx").on(table.platform),
    index("dcc_category_idx").on(table.platformCategory),
  ],
);

// ──────────────────────────────────────────────────────────────
// 65.2 DevopsTestResult — Git/Issue/Wiki test outcomes
// ──────────────────────────────────────────────────────────────

export const devopsTestResult = pgTable(
  "devops_test_result",
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
      .references(() => devopsConnectorConfig.id),
    testCategory: varchar("test_category", { length: 50 }).notNull(), // branch_protection | code_review | sast | secret_scanning | sla_compliance | docs_freshness | endpoint_compliance | firewall_rules
    testName: varchar("test_name", { length: 500 }).notNull(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(), // repository | project | space | endpoint | firewall
    resourceName: varchar("resource_name", { length: 500 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // pass | fail | warning | error | skipped
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    details: jsonb("details").default("{}"),
    findings: jsonb("findings").default("[]"),
    metrics: jsonb("metrics").default("{}"), // { reviewCoverage: 95, meanTimeToReview: 4.2, ... }
    complianceRate: numeric("compliance_rate", { precision: 5, scale: 2 }),
    remediationSteps: text("remediation_steps"),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("dtr_org_idx").on(table.orgId),
    index("dtr_connector_idx").on(table.connectorId),
    index("dtr_config_idx").on(table.configId),
    index("dtr_category_idx").on(table.testCategory),
    index("dtr_status_idx").on(table.status),
    index("dtr_executed_idx").on(table.executedAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 65.3 ItInfrastructureCheck — Endpoint & Network checks
// ──────────────────────────────────────────────────────────────

export const itInfrastructureCheck = pgTable(
  "it_infrastructure_check",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    checkType: varchar("check_type", { length: 50 }).notNull(), // endpoint_encryption | endpoint_patching | endpoint_antivirus | firewall_rule_review | network_segmentation | vpn_config | certificate_expiry
    checkName: varchar("check_name", { length: 500 }).notNull(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(), // endpoint | firewall | switch | router | certificate | vpn
    status: varchar("status", { length: 20 }).notNull(), // compliant | non_compliant | warning | error
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    totalDevices: integer("total_devices").notNull().default(0),
    compliantDevices: integer("compliant_devices").notNull().default(0),
    nonCompliantDevices: integer("non_compliant_devices").notNull().default(0),
    complianceRate: numeric("compliance_rate", { precision: 5, scale: 2 }),
    findings: jsonb("findings").default("[]"),
    details: jsonb("details").default("{}"),
    remediationGuide: text("remediation_guide"),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("iic_org_idx").on(table.orgId),
    index("iic_connector_idx").on(table.connectorId),
    index("iic_check_type_idx").on(table.checkType),
    index("iic_status_idx").on(table.status),
    index("iic_executed_idx").on(table.executedAt),
  ],
);
