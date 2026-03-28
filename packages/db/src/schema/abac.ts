// Sprint 34: ABAC (Attribute-Based Access Control) + Process Simulation + DMN Editor
// Tables: abac_policy, simulation_scenario, simulation_activity_param, simulation_result, dmn_decision

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { process } from "./process";

// ──────────────────────────────────────────────────────────────
// ABAC Policy
// ──────────────────────────────────────────────────────────────

export const abacPolicy = pgTable(
  "abac_policy",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    subjectCondition: jsonb("subject_condition").notNull(),
    objectCondition: jsonb("object_condition").notNull(),
    accessLevel: varchar("access_level", { length: 10 }).notNull(),
    priority: integer("priority").notNull().default(100),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("abac_policy_org_idx").on(table.orgId),
    entityIdx: index("abac_policy_entity_idx").on(table.orgId, table.entityType),
    priorityIdx: index("abac_policy_priority_idx").on(
      table.orgId,
      table.entityType,
      table.priority,
    ),
  }),
);

export const abacPolicyRelations = relations(abacPolicy, ({ one }) => ({
  organization: one(organization, {
    fields: [abacPolicy.orgId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [abacPolicy.createdBy],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// ABAC Audit Log
// ──────────────────────────────────────────────────────────────

export const abacAccessLog = pgTable(
  "abac_access_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id"),
    accessLevel: varchar("access_level", { length: 10 }).notNull(),
    decision: varchar("decision", { length: 10 }).notNull(),
    matchedPolicyId: uuid("matched_policy_id"),
    evaluationDurationMs: integer("evaluation_duration_ms"),
    subjectAttributes: jsonb("subject_attributes"),
    objectAttributes: jsonb("object_attributes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgDateIdx: index("abac_log_org_date_idx").on(table.orgId, table.createdAt),
    userIdx: index("abac_log_user_idx").on(table.userId),
    decisionIdx: index("abac_log_decision_idx").on(table.orgId, table.decision),
  }),
);

// ──────────────────────────────────────────────────────────────
// Simulation Scenario
// ──────────────────────────────────────────────────────────────

export const simulationScenario = pgTable(
  "simulation_scenario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    caseCount: integer("case_count").notNull().default(1000),
    timePeriodDays: integer("time_period_days").notNull().default(30),
    resourceConfig: jsonb("resource_config").default("[]"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("sim_scenario_org_idx").on(table.orgId),
    processIdx: index("sim_scenario_process_idx").on(table.processId),
  }),
);

export const simulationScenarioRelations = relations(
  simulationScenario,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [simulationScenario.orgId],
      references: [organization.id],
    }),
    process: one(process, {
      fields: [simulationScenario.processId],
      references: [process.id],
    }),
    activityParams: many(simulationActivityParam),
    results: many(simulationResult),
  }),
);

// ──────────────────────────────────────────────────────────────
// Simulation Activity Parameters
// ──────────────────────────────────────────────────────────────

export const simulationActivityParam = pgTable(
  "simulation_activity_param",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => simulationScenario.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    activityId: varchar("activity_id", { length: 200 }).notNull(),
    activityName: varchar("activity_name", { length: 500 }),
    durationMin: numeric("duration_min", { precision: 10, scale: 2 }).notNull(),
    durationMostLikely: numeric("duration_most_likely", {
      precision: 10,
      scale: 2,
    }).notNull(),
    durationMax: numeric("duration_max", { precision: 10, scale: 2 }).notNull(),
    costPerExecution: numeric("cost_per_execution", {
      precision: 15,
      scale: 2,
    }).default("0"),
    resourceId: varchar("resource_id", { length: 200 }),
    gatewayProbabilities: jsonb("gateway_probabilities"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    scenarioIdx: index("sim_param_scenario_idx").on(table.scenarioId),
    uniqueActivity: uniqueIndex("sim_param_unique_idx").on(
      table.scenarioId,
      table.activityId,
    ),
  }),
);

export const simulationActivityParamRelations = relations(
  simulationActivityParam,
  ({ one }) => ({
    scenario: one(simulationScenario, {
      fields: [simulationActivityParam.scenarioId],
      references: [simulationScenario.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Simulation Result
// ──────────────────────────────────────────────────────────────

export const simulationResult = pgTable(
  "simulation_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => simulationScenario.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    caseCount: integer("case_count").notNull(),
    avgCycleTime: numeric("avg_cycle_time", { precision: 15, scale: 4 }),
    p50CycleTime: numeric("p50_cycle_time", { precision: 15, scale: 4 }),
    p95CycleTime: numeric("p95_cycle_time", { precision: 15, scale: 4 }),
    avgCost: numeric("avg_cost", { precision: 15, scale: 2 }),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }),
    bottleneckActivities: jsonb("bottleneck_activities").default("[]"),
    costBreakdown: jsonb("cost_breakdown").default("{}"),
    resourceUtilization: jsonb("resource_utilization").default("{}"),
    histogram: jsonb("histogram").default("[]"),
    rawResults: jsonb("raw_results"),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    scenarioIdx: index("sim_result_scenario_idx").on(table.scenarioId),
  }),
);

export const simulationResultRelations = relations(
  simulationResult,
  ({ one }) => ({
    scenario: one(simulationScenario, {
      fields: [simulationResult.scenarioId],
      references: [simulationScenario.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// DMN Decision
// ──────────────────────────────────────────────────────────────

export const dmnDecision = pgTable(
  "dmn_decision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    dmnXml: text("dmn_xml").notNull(),
    version: integer("version").notNull().default(1),
    linkedProcessStepId: uuid("linked_process_step_id"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    inputSchema: jsonb("input_schema").default("[]"),
    outputSchema: jsonb("output_schema").default("[]"),
    hitPolicy: varchar("hit_policy", { length: 20 }).default("UNIQUE"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("dmn_decision_org_idx").on(table.orgId),
    statusIdx: index("dmn_decision_status_idx").on(table.orgId, table.status),
    processStepIdx: index("dmn_decision_step_idx").on(table.linkedProcessStepId),
  }),
);

export const dmnDecisionRelations = relations(dmnDecision, ({ one }) => ({
  organization: one(organization, {
    fields: [dmnDecision.orgId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [dmnDecision.createdBy],
    references: [user.id],
  }),
}));
