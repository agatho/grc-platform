// Sprint 85: Simulation und Scenario Engine
// 5 entities: simulation_scenario, simulation_run, simulation_parameter,
// simulation_result, simulation_comparison

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const simulationTypeEnum = pgEnum("simulation_type", [
  "what_if",
  "bpm_cost_time",
  "business_impact",
  "monte_carlo",
  "supplier_cascade",
  "custom",
]);

export const simulationStatusEnum = pgEnum("simulation_status", [
  "draft",
  "configuring",
  "running",
  "completed",
  "failed",
  "archived",
]);

export const simulationScenarioTagEnum = pgEnum("simulation_scenario_tag", [
  "as_is",
  "to_be_a",
  "to_be_b",
  "to_be_c",
  "best_case",
  "worst_case",
  "most_likely",
]);

// ──────────────────────────────────────────────────────────────
// 85.1 SimulationScenario — Scenario definitions
// ──────────────────────────────────────────────────────────────

export const simulationScenario = pgTable(
  "simulation_scenario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    simulationType: simulationTypeEnum("simulation_type").notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    tag: simulationScenarioTagEnum("tag").notNull().default("as_is"),
    status: simulationStatusEnum("status").notNull().default("draft"),
    inputParametersJson: jsonb("input_parameters_json").notNull().default(sql`'{}'::jsonb`),
    assumptionsJson: jsonb("assumptions_json").notNull().default(sql`'[]'::jsonb`),
    sourceEntityType: varchar("source_entity_type", { length: 100 }),
    sourceEntityId: uuid("source_entity_id"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ss_org_idx").on(t.orgId),
    index("ss_type_idx").on(t.orgId, t.simulationType),
    index("ss_status_idx").on(t.orgId, t.status),
    index("ss_tag_idx").on(t.orgId, t.tag),
  ],
);

// ──────────────────────────────────────────────────────────────
// 85.2 SimulationRun — Execution records
// ──────────────────────────────────────────────────────────────

export const simulationRun = pgTable(
  "simulation_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => simulationScenario.id, { onDelete: "cascade" }),
    runNumber: integer("run_number").notNull().default(1),
    iterations: integer("iterations").notNull().default(10000),
    confidenceLevel: numeric("confidence_level", { precision: 5, scale: 2 }).notNull().default("95.00"),
    status: simulationStatusEnum("status").notNull().default("running"),
    durationMs: integer("duration_ms"),
    executedBy: uuid("executed_by").references(() => user.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sr_org_idx").on(t.orgId),
    index("sr_scenario_idx").on(t.scenarioId),
    index("sr_status_idx").on(t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 85.3 SimulationParameter — Configurable parameters per scenario
// ──────────────────────────────────────────────────────────────

export const simulationParameter = pgTable(
  "simulation_parameter",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => simulationScenario.id, { onDelete: "cascade" }),
    parameterKey: varchar("parameter_key", { length: 200 }).notNull(),
    displayName: varchar("display_name", { length: 300 }).notNull(),
    parameterType: varchar("parameter_type", { length: 50 }).notNull().default("number"),
    minValue: numeric("min_value", { precision: 20, scale: 6 }),
    maxValue: numeric("max_value", { precision: 20, scale: 6 }),
    defaultValue: numeric("default_value", { precision: 20, scale: 6 }),
    distribution: varchar("distribution", { length: 50 }).default("normal"),
    unit: varchar("unit", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sp_org_idx").on(t.orgId),
    index("sp_scenario_idx").on(t.scenarioId),
    unique("sp_scenario_key").on(t.scenarioId, t.parameterKey),
  ],
);

// ──────────────────────────────────────────────────────────────
// 85.4 SimulationResult — Output data per run
// ──────────────────────────────────────────────────────────────

export const simulationResult = pgTable(
  "simulation_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    runId: uuid("run_id")
      .notNull()
      .references(() => simulationRun.id, { onDelete: "cascade" }),
    metricKey: varchar("metric_key", { length: 200 }).notNull(),
    metricName: varchar("metric_name", { length: 300 }).notNull(),
    meanValue: numeric("mean_value", { precision: 20, scale: 6 }),
    medianValue: numeric("median_value", { precision: 20, scale: 6 }),
    p5Value: numeric("p5_value", { precision: 20, scale: 6 }),
    p95Value: numeric("p95_value", { precision: 20, scale: 6 }),
    minValue: numeric("min_value", { precision: 20, scale: 6 }),
    maxValue: numeric("max_value", { precision: 20, scale: 6 }),
    stdDev: numeric("std_dev", { precision: 20, scale: 6 }),
    histogramJson: jsonb("histogram_json").notNull().default(sql`'[]'::jsonb`),
    unit: varchar("unit", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sres_org_idx").on(t.orgId),
    index("sres_run_idx").on(t.runId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 85.5 SimulationComparison — Side-by-side scenario comparison
// ──────────────────────────────────────────────────────────────

export const simulationComparison = pgTable(
  "simulation_comparison",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    scenarioIds: jsonb("scenario_ids").notNull().default(sql`'[]'::jsonb`),
    comparisonMetrics: jsonb("comparison_metrics").notNull().default(sql`'[]'::jsonb`),
    resultSummaryJson: jsonb("result_summary_json").notNull().default(sql`'{}'::jsonb`),
    exportUrl: varchar("export_url", { length: 2000 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sc_org_idx").on(t.orgId),
  ],
);
