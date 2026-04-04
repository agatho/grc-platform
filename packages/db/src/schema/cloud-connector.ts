// Sprint 63: Cloud Infrastructure Connectors
// 3 entities: cloud_test_suite, cloud_test_execution, cloud_compliance_snapshot

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
// 63.1 CloudTestSuite — Grouped test suites for cloud providers
// AWS (25 tests), Azure (25 tests), GCP (15 tests)
// ──────────────────────────────────────────────────────────────

export const cloudTestSuite = pgTable(
  "cloud_test_suite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull(), // aws | azure | gcp
    suiteName: varchar("suite_name", { length: 255 }).notNull(),
    description: text("description"),
    testKeys: jsonb("test_keys").notNull().default("[]"), // list of test_key references
    isEnabled: boolean("is_enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastPassRate: numeric("last_pass_rate", { precision: 5, scale: 2 }),
    totalTests: integer("total_tests").notNull().default(0),
    passingTests: integer("passing_tests").notNull().default(0),
    failingTests: integer("failing_tests").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("clts_org_idx").on(table.orgId),
    index("cts_connector_idx").on(table.connectorId),
    index("cts_provider_idx").on(table.provider),
  ],
);

// ──────────────────────────────────────────────────────────────
// 63.2 CloudTestExecution — Per-suite execution batch record
// ──────────────────────────────────────────────────────────────

export const cloudTestExecution = pgTable(
  "cloud_test_execution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    suiteId: uuid("suite_id")
      .notNull()
      .references(() => cloudTestSuite.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id),
    provider: varchar("provider", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // running | completed | failed | cancelled
    totalTests: integer("total_tests").notNull().default(0),
    passCount: integer("pass_count").notNull().default(0),
    failCount: integer("fail_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    skipCount: integer("skip_count").notNull().default(0),
    passRate: numeric("pass_rate", { precision: 5, scale: 2 }),
    durationMs: integer("duration_ms"),
    results: jsonb("results").default("[]"), // detailed per-test results
    triggeredBy: varchar("triggered_by", { length: 30 }).notNull().default("schedule"), // schedule | manual | api
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cte_org_idx").on(table.orgId),
    index("cte_suite_idx").on(table.suiteId),
    index("cte_connector_idx").on(table.connectorId),
    index("cte_status_idx").on(table.status),
    index("cte_started_idx").on(table.startedAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 63.3 CloudComplianceSnapshot — Point-in-time compliance posture
// ──────────────────────────────────────────────────────────────

export const cloudComplianceSnapshot = pgTable(
  "cloud_compliance_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => evidenceConnector.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull(),
    snapshotDate: timestamp("snapshot_date", { withTimezone: true }).notNull(),
    overallScore: numeric("overall_score", { precision: 5, scale: 2 }).notNull(),
    categoryScores: jsonb("category_scores").default("{}"), // { iam: 85, encryption: 92, logging: 78, ... }
    totalChecks: integer("total_checks").notNull(),
    passingChecks: integer("passing_checks").notNull(),
    failingChecks: integer("failing_checks").notNull(),
    criticalFindings: integer("critical_findings").notNull().default(0),
    highFindings: integer("high_findings").notNull().default(0),
    mediumFindings: integer("medium_findings").notNull().default(0),
    lowFindings: integer("low_findings").notNull().default(0),
    trendDirection: varchar("trend_direction", { length: 10 }), // up | down | stable
    trendDelta: numeric("trend_delta", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ccs_org_idx").on(table.orgId),
    index("ccs_connector_idx").on(table.connectorId),
    index("ccs_provider_idx").on(table.provider),
    index("ccs_date_idx").on(table.snapshotDate),
  ],
);
