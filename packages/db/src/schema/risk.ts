// Sprint 2: Enterprise Risk Management Schema (Drizzle ORM)
// 11 entities: risk_appetite, risk, risk_treatment, kri, kri_measurement,
// simulation_result, risk_framework_mapping, process_risk, process_step_risk,
// risk_asset, risk_control

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  integer,
  numeric,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { workItem } from "./work-item";
import { asset } from "./asset";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const riskCategoryEnum = pgEnum("risk_category", [
  "strategic",
  "operational",
  "financial",
  "compliance",
  "cyber",
  "reputational",
  "esg",
]);

export const riskSourceEnum = pgEnum("risk_source", [
  "isms",
  "erm",
  "bcm",
  "project",
  "process",
]);

export const riskStatusEnum = pgEnum("risk_status", [
  "identified",
  "assessed",
  "treated",
  "accepted",
  "closed",
]);

export const treatmentStrategyEnum = pgEnum("treatment_strategy", [
  "mitigate",
  "accept",
  "transfer",
  "avoid",
]);

export const treatmentStatusEnum = pgEnum("treatment_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const kriAlertStatusEnum = pgEnum("kri_alert_status", [
  "green",
  "yellow",
  "red",
]);

export const kriTrendEnum = pgEnum("kri_trend", [
  "improving",
  "stable",
  "worsening",
]);

export const kriDirectionEnum = pgEnum("kri_direction", [
  "asc",
  "desc",
]);

export const kriMeasurementFrequencyEnum = pgEnum("kri_measurement_frequency", [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
]);

export const kriMeasurementSourceEnum = pgEnum("kri_measurement_source", [
  "manual",
  "api_import",
  "calculated",
]);

// ──────────────────────────────────────────────────────────────
// 2.1 RiskAppetite — One per org (Sprint 2, ERM)
// ──────────────────────────────────────────────────────────────

export const riskAppetite = pgTable(
  "risk_appetite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id)
      .unique(),
    appetiteThreshold: integer("appetite_threshold").notNull(),
    toleranceUpper: numeric("tolerance_upper"),
    toleranceLower: numeric("tolerance_lower"),
    description: text("description"),
    effectiveDate: date("effective_date").notNull().defaultNow(),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("risk_appetite_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.2 Risk — Core risk entity (Sprint 2, ERM)
// ──────────────────────────────────────────────────────────────

export const risk = pgTable(
  "risk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id")
      .references(() => workItem.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    riskCategory: riskCategoryEnum("risk_category").notNull(),
    riskSource: riskSourceEnum("risk_source").notNull(),
    status: riskStatusEnum("status").notNull().default("identified"),
    ownerId: uuid("owner_id")
      .references(() => user.id),
    department: varchar("department", { length: 255 }),
    // Inherent risk scores (1-5 scale, CHECK constraints in migration)
    inherentLikelihood: integer("inherent_likelihood"),
    inherentImpact: integer("inherent_impact"),
    // Residual risk scores (1-5 scale, CHECK constraints in migration)
    residualLikelihood: integer("residual_likelihood"),
    residualImpact: integer("residual_impact"),
    // Computed scores (likelihood * impact)
    riskScoreInherent: integer("risk_score_inherent"),
    riskScoreResidual: integer("risk_score_residual"),
    // Treatment
    treatmentStrategy: treatmentStrategyEnum("treatment_strategy"),
    treatmentRationale: text("treatment_rationale"),
    // Financial impact range
    financialImpactMin: numeric("financial_impact_min", { precision: 15, scale: 2 }),
    financialImpactMax: numeric("financial_impact_max", { precision: 15, scale: 2 }),
    financialImpactExpected: numeric("financial_impact_expected", { precision: 15, scale: 2 }),
    // Appetite comparison
    riskAppetiteExceeded: boolean("risk_appetite_exceeded").notNull().default(false),
    // Review
    reviewDate: date("review_date"),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("risk_org_status_idx").on(table.orgId, table.status),
    index("risk_owner_idx").on(table.ownerId),
    index("risk_score_residual_idx").on(table.riskScoreResidual),
    index("risk_org_appetite_exceeded_idx").on(table.orgId, table.riskAppetiteExceeded),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.3 RiskTreatment — Treatment actions (Sprint 2, ERM)
// ──────────────────────────────────────────────────────────────

export const riskTreatment = pgTable(
  "risk_treatment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    workItemId: uuid("work_item_id")
      .references(() => workItem.id),
    description: text("description"),
    responsibleId: uuid("responsible_id")
      .references(() => user.id),
    expectedRiskReduction: numeric("expected_risk_reduction", { precision: 5, scale: 2 }),
    costEstimate: numeric("cost_estimate", { precision: 15, scale: 2 }),
    status: treatmentStatusEnum("status").notNull().default("planned"),
    dueDate: date("due_date"),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("risk_treatment_risk_idx").on(table.riskId),
    index("risk_treatment_org_idx").on(table.orgId),
    index("risk_treatment_responsible_idx").on(table.responsibleId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.4 KRI — Key Risk Indicator (Sprint 2, ERM)
// ──────────────────────────────────────────────────────────────

export const kri = pgTable(
  "kri",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id")
      .references(() => risk.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    unit: varchar("unit", { length: 50 }),
    direction: kriDirectionEnum("direction").notNull(),
    thresholdGreen: numeric("threshold_green", { precision: 15, scale: 2 }),
    thresholdYellow: numeric("threshold_yellow", { precision: 15, scale: 2 }),
    thresholdRed: numeric("threshold_red", { precision: 15, scale: 2 }),
    currentValue: numeric("current_value", { precision: 15, scale: 2 }),
    currentAlertStatus: kriAlertStatusEnum("current_alert_status").notNull().default("green"),
    trend: kriTrendEnum("trend").notNull().default("stable"),
    measurementFrequency: kriMeasurementFrequencyEnum("measurement_frequency").notNull().default("monthly"),
    lastMeasuredAt: timestamp("last_measured_at", { withTimezone: true }),
    alertEnabled: boolean("alert_enabled").notNull().default(true),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("kri_org_idx").on(table.orgId),
    index("kri_risk_idx").on(table.riskId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.5 KRIMeasurement — Time series data (Sprint 2, ERM)
// ──────────────────────────────────────────────────────────────

export const kriMeasurement = pgTable(
  "kri_measurement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kriId: uuid("kri_id")
      .notNull()
      .references(() => kri.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    value: numeric("value", { precision: 15, scale: 2 }).notNull(),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    source: kriMeasurementSourceEnum("source").notNull().default("manual"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("kri_measurement_kri_at_idx").on(table.kriId, table.measuredAt),
    index("kri_measurement_org_at_idx").on(table.orgId, table.measuredAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.6 SimulationResult — Monte Carlo simulation outputs
// ──────────────────────────────────────────────────────────────

export const simulationResult = pgTable(
  "simulation_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    simulationRunId: uuid("simulation_run_id").notNull().defaultRandom(),
    simulatedAt: timestamp("simulated_at", { withTimezone: true }).notNull().defaultNow(),
    p5: numeric("p5", { precision: 15, scale: 2 }),
    p25: numeric("p25", { precision: 15, scale: 2 }),
    p50: numeric("p50", { precision: 15, scale: 2 }),
    p75: numeric("p75", { precision: 15, scale: 2 }),
    p95: numeric("p95", { precision: 15, scale: 2 }),
    iterations: integer("iterations"),
    model: varchar("model", { length: 100 }),
  },
  (table) => [
    index("sim_result_risk_idx").on(table.riskId),
    index("sim_result_org_idx").on(table.orgId),
    index("sim_result_run_idx").on(table.simulationRunId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.7 RiskFrameworkMapping — Risk ↔ Requirement join table
// ──────────────────────────────────────────────────────────────

export const riskFrameworkMapping = pgTable(
  "risk_framework_mapping",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    requirementId: uuid("requirement_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .references(() => user.id),
  },
  (table) => [
    unique("risk_framework_mapping_unique").on(table.riskId, table.requirementId),
    index("rfm_org_idx").on(table.orgId),
    index("rfm_risk_idx").on(table.riskId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.8 ProcessRisk — Risk ↔ Process join table
// ──────────────────────────────────────────────────────────────

export const processRisk = pgTable(
  "process_risk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    processId: uuid("process_id").notNull(),
    riskContext: text("risk_context"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .references(() => user.id),
  },
  (table) => [
    index("process_risk_org_idx").on(table.orgId),
    index("process_risk_risk_idx").on(table.riskId),
    index("process_risk_process_idx").on(table.processId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.9 ProcessStepRisk — Risk ↔ ProcessStep join table
// ──────────────────────────────────────────────────────────────

export const processStepRisk = pgTable(
  "process_step_risk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    processStepId: uuid("process_step_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .references(() => user.id),
  },
  (table) => [
    index("process_step_risk_org_idx").on(table.orgId),
    index("process_step_risk_risk_idx").on(table.riskId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.10 RiskAsset — Risk ↔ Asset join table
// ──────────────────────────────────────────────────────────────

export const riskAsset = pgTable(
  "risk_asset",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .references(() => user.id),
  },
  (table) => [
    index("risk_asset_org_idx").on(table.orgId),
    index("risk_asset_risk_idx").on(table.riskId),
    index("risk_asset_asset_idx").on(table.assetId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 2.11 RiskControl — Risk ↔ Control join (placeholder Sprint 4)
// ──────────────────────────────────────────────────────────────

export const riskControl = pgTable(
  "risk_control",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    controlId: uuid("control_id").notNull(),
    effectiveness: varchar("effectiveness", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .references(() => user.id),
  },
  (table) => [
    index("risk_control_org_idx").on(table.orgId),
    index("risk_control_risk_idx").on(table.riskId),
    index("risk_control_control_idx").on(table.controlId),
  ],
);
