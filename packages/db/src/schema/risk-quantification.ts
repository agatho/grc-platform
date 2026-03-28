// Sprint 79: Unified Risk Quantification Dashboard
// 5 entities: risk_quantification_config, risk_var_calculation, risk_appetite_threshold,
//             risk_sensitivity_analysis, risk_executive_summary

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const rqMethodologyEnum = pgEnum("rq_methodology", [
  "fair",
  "monte_carlo",
  "qualitative",
  "hybrid",
]);

export const rqCalculationStatusEnum = pgEnum("rq_calculation_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const rqAppetiteStatusEnum = pgEnum("rq_appetite_status", [
  "within_appetite",
  "approaching_limit",
  "exceeds_appetite",
  "critical",
]);

export const rqSummaryStatusEnum = pgEnum("rq_summary_status", [
  "draft",
  "final",
  "archived",
]);

// ──────────────────────────────────────────────────────────────
// 79.1 RiskQuantificationConfig — Org-level methodology config
// ──────────────────────────────────────────────────────────────

export const riskQuantificationConfig = pgTable(
  "risk_quantification_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    methodology: rqMethodologyEnum("methodology").notNull().default("hybrid"),
    defaultIterations: integer("default_iterations").notNull().default(10000),
    confidenceLevel: numeric("confidence_level", { precision: 5, scale: 2 }).notNull().default("0.95"),
    currencyCode: varchar("currency_code", { length: 3 }).notNull().default("EUR"),
    aggregationMethod: varchar("aggregation_method", { length: 50 }).notNull().default("sum"),
    includeCorrelations: boolean("include_correlations").notNull().default(false),
    correlationMatrix: jsonb("correlation_matrix"),
    configJson: jsonb("config_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("rqc_org_unique").on(t.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 79.2 RiskVarCalculation — Aggregated Value-at-Risk per entity
// ──────────────────────────────────────────────────────────────

export const riskVarCalculation = pgTable(
  "risk_var_calculation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityLabel: varchar("entity_label", { length: 300 }),
    methodology: rqMethodologyEnum("methodology").notNull(),
    status: rqCalculationStatusEnum("status").notNull().default("pending"),
    iterations: integer("iterations").notNull().default(10000),
    riskCount: integer("risk_count").notNull().default(0),
    varP50: numeric("var_p50", { precision: 15, scale: 2 }),
    varP75: numeric("var_p75", { precision: 15, scale: 2 }),
    varP90: numeric("var_p90", { precision: 15, scale: 2 }),
    varP95: numeric("var_p95", { precision: 15, scale: 2 }),
    varP99: numeric("var_p99", { precision: 15, scale: 2 }),
    expectedLoss: numeric("expected_loss", { precision: 15, scale: 2 }),
    standardDeviation: numeric("standard_deviation", { precision: 15, scale: 2 }),
    histogram: jsonb("histogram"),
    lossExceedance: jsonb("loss_exceedance"),
    riskContributions: jsonb("risk_contributions"),
    computedAt: timestamp("computed_at", { withTimezone: true }),
    computedBy: uuid("computed_by").references(() => user.id),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rvc_org_idx").on(t.orgId),
    index("rvc_status_idx").on(t.orgId, t.status),
    index("rvc_computed_idx").on(t.orgId, t.computedAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 79.3 RiskAppetiteThreshold — Appetite vs Actual tracking
// ──────────────────────────────────────────────────────────────

export const riskAppetiteThreshold = pgTable(
  "risk_appetite_threshold",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 300 }).notNull(),
    category: varchar("category", { length: 100 }),
    appetiteAmount: numeric("appetite_amount", { precision: 15, scale: 2 }).notNull(),
    toleranceAmount: numeric("tolerance_amount", { precision: 15, scale: 2 }),
    currentExposure: numeric("current_exposure", { precision: 15, scale: 2 }),
    status: rqAppetiteStatusEnum("status").notNull().default("within_appetite"),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }),
    alertEnabled: boolean("alert_enabled").notNull().default(true),
    trendData: jsonb("trend_data").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rat_org_idx").on(t.orgId),
    index("rat_status_idx").on(t.orgId, t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 79.4 RiskSensitivityAnalysis — Tornado / what-if analysis
// ──────────────────────────────────────────────────────────────

export const riskSensitivityAnalysis = pgTable(
  "risk_sensitivity_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    varCalculationId: uuid("var_calculation_id")
      .references(() => riskVarCalculation.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 300 }).notNull(),
    description: text("description"),
    baselineVar: numeric("baseline_var", { precision: 15, scale: 2 }),
    scenariosJson: jsonb("scenarios_json").notNull().default(sql`'[]'::jsonb`),
    tornadoData: jsonb("tornado_data"),
    waterfallData: jsonb("waterfall_data"),
    computedAt: timestamp("computed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rsa_org_idx").on(t.orgId),
    index("rsa_var_idx").on(t.varCalculationId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 79.5 RiskExecutiveSummary — 1-page board summary
// ──────────────────────────────────────────────────────────────

export const riskExecutiveSummary = pgTable(
  "risk_executive_summary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    periodLabel: varchar("period_label", { length: 100 }),
    status: rqSummaryStatusEnum("status").notNull().default("draft"),
    executiveSummary: text("executive_summary"),
    topRisks: jsonb("top_risks").notNull().default(sql`'[]'::jsonb`),
    keyMetrics: jsonb("key_metrics").notNull().default(sql`'{}'::jsonb`),
    trendComparison: jsonb("trend_comparison"),
    recommendations: jsonb("recommendations").notNull().default(sql`'[]'::jsonb`),
    exportFormat: varchar("export_format", { length: 10 }),
    exportPath: varchar("export_path", { length: 1000 }),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("res_org_idx").on(t.orgId),
    index("res_status_idx").on(t.orgId, t.status),
    index("res_period_idx").on(t.orgId, t.periodLabel),
  ],
);
