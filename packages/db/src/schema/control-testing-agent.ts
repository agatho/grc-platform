// Sprint 70: AI Control Testing Agent
// Tables: control_test_script, control_test_execution, control_test_checklist, control_test_learning

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
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 70.1 Control Test Script — AI-generated test scripts
// ──────────────────────────────────────────────────────────────

export const controlTestScript = pgTable(
  "control_test_script",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id").notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    testType: varchar("test_type", { length: 50 }).notNull(), // automated | manual | hybrid
    scriptContent: text("script_content").notNull(),
    steps: jsonb("steps").default("[]"), // [{order, instruction, expectedResult, isAutomated}]
    connectorType: varchar("connector_type", { length: 50 }), // api | database | file_system | cloud | null
    connectorConfig: jsonb("connector_config").default("{}"),
    frequency: varchar("frequency", { length: 20 }), // daily | weekly | monthly | quarterly | on_demand
    expectedDurationMinutes: integer("expected_duration_minutes"),
    severityMapping: jsonb("severity_mapping").default("{}"), // {pass, fail_low, fail_medium, fail_high, fail_critical}
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    aiGenerated: boolean("ai_generated").notNull().default(true),
    aiModel: varchar("ai_model", { length: 100 }),
    aiConfidence: numeric("ai_confidence", { precision: 5, scale: 2 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("cts_org_idx").on(table.orgId),
    controlIdx: index("cts_control_idx").on(table.orgId, table.controlId),
    typeIdx: index("cts_type_idx").on(table.orgId, table.testType),
    activeIdx: index("cts_active_idx").on(table.orgId, table.isActive),
  }),
);

export const controlTestScriptRelations = relations(
  controlTestScript,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [controlTestScript.orgId],
      references: [organization.id],
    }),
    creator: one(user, {
      fields: [controlTestScript.createdBy],
      references: [user.id],
    }),
    executions: many(controlTestExecution),
  }),
);

// ──────────────────────────────────────────────────────────────
// 70.2 Control Test Execution — Test run results
// ──────────────────────────────────────────────────────────────

export const controlTestExecution = pgTable(
  "control_test_execution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scriptId: uuid("script_id")
      .notNull()
      .references(() => controlTestScript.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    controlId: uuid("control_id").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | running | passed | failed | error | cancelled
    result: varchar("result", { length: 20 }), // pass | fail | inconclusive
    resultSeverity: varchar("result_severity", { length: 20 }), // critical | high | medium | low | info
    stepResults: jsonb("step_results").default("[]"), // [{stepOrder, status, actualResult, evidence}]
    summary: text("summary"),
    aiAnalysis: text("ai_analysis"),
    findingsGenerated: integer("findings_generated").notNull().default(0),
    findingIds: jsonb("finding_ids").default("[]"),
    connectorLogs: jsonb("connector_logs").default("[]"),
    durationMs: integer("duration_ms"),
    tokensUsed: integer("tokens_used").notNull().default(0),
    executedBy: uuid("executed_by").references(() => user.id),
    triggeredBy: varchar("triggered_by", { length: 20 }).notNull().default("manual"), // manual | scheduled | agent
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    scriptIdx: index("cte_script_idx").on(table.scriptId),
    orgIdx: index("ctex_org_idx").on(table.orgId),
    controlIdx: index("cte_control_idx").on(table.orgId, table.controlId),
    statusIdx: index("ctex_status_idx").on(table.orgId, table.status),
    dateIdx: index("cte_date_idx").on(table.orgId, table.createdAt),
  }),
);

export const controlTestExecutionRelations = relations(
  controlTestExecution,
  ({ one }) => ({
    script: one(controlTestScript, {
      fields: [controlTestExecution.scriptId],
      references: [controlTestScript.id],
    }),
    executor: one(user, {
      fields: [controlTestExecution.executedBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 70.3 Control Test Checklist — Manual test checklists
// ──────────────────────────────────────────────────────────────

export const controlTestChecklist = pgTable(
  "control_test_checklist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id").notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    items: jsonb("items").notNull().default("[]"), // [{order, question, guidance, evidenceRequired, response, notes}]
    totalItems: integer("total_items").notNull().default(0),
    completedItems: integer("completed_items").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | in_progress | completed | archived
    overallResult: varchar("overall_result", { length: 20 }), // pass | fail | partial
    aiGenerated: boolean("ai_generated").notNull().default(true),
    assigneeId: uuid("assignee_id").references(() => user.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ctc_org_idx").on(table.orgId),
    controlIdx: index("ctc_control_idx").on(table.orgId, table.controlId),
    statusIdx: index("ctc_status_idx").on(table.orgId, table.status),
    assigneeIdx: index("ctc_assignee_idx").on(table.assigneeId),
  }),
);

export const controlTestChecklistRelations = relations(
  controlTestChecklist,
  ({ one }) => ({
    organization: one(organization, {
      fields: [controlTestChecklist.orgId],
      references: [organization.id],
    }),
    assignee: one(user, {
      fields: [controlTestChecklist.assigneeId],
      references: [user.id],
    }),
    creator: one(user, {
      fields: [controlTestChecklist.createdBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 70.4 Control Test Learning — Historical learning data
// ──────────────────────────────────────────────────────────────

export const controlTestLearning = pgTable(
  "control_test_learning",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id").notNull(),
    patternType: varchar("pattern_type", { length: 50 }).notNull(), // common_failure | effective_test | false_positive | improvement
    pattern: jsonb("pattern").notNull(), // {description, conditions, frequency, lastSeen}
    confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
    sampleSize: integer("sample_size").notNull().default(0),
    lastUpdatedFromExecution: uuid("last_updated_from_execution"),
    isApplied: boolean("is_applied").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ctl_org_idx").on(table.orgId),
    controlIdx: index("ctl_control_idx").on(table.orgId, table.controlId),
    patternIdx: index("ctl_pattern_idx").on(table.orgId, table.patternType),
  }),
);

export const controlTestLearningRelations = relations(
  controlTestLearning,
  ({ one }) => ({
    organization: one(organization, {
      fields: [controlTestLearning.orgId],
      references: [organization.id],
    }),
  }),
);
