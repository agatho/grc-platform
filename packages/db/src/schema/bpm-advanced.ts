// Sprint 47: BPM Advanced — Process Mining, KPIs, Maturity,
// Value Stream Mapping, Template Library

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { process } from "./process";

// ──────────────────────────────────────────────────────────────
// 47.1 process_event_log — Imported event log metadata
// ──────────────────────────────────────────────────────────────

export const processEventLog = pgTable(
  "process_event_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id").references(() => process.id),
    importName: varchar("import_name", { length: 500 }).notNull(),
    formatSource: varchar("format_source", { length: 10 }).notNull(),
    eventCount: integer("event_count"),
    caseCount: integer("case_count"),
    activityCount: integer("activity_count"),
    dateRangeStart: date("date_range_start", { mode: "string" }),
    dateRangeEnd: date("date_range_end", { mode: "string" }),
    importedBy: uuid("imported_by").references(() => user.id),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: varchar("status", { length: 20 }).notNull().default("importing"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("pel_org_idx").on(table.orgId),
    index("pel_process_idx").on(table.processId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 47.2 process_event — Individual events (HIGH-VOLUME)
// ──────────────────────────────────────────────────────────────

export const processEvent = pgTable(
  "process_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventLogId: uuid("event_log_id")
      .notNull()
      .references(() => processEventLog.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    caseId: varchar("case_id", { length: 200 }).notNull(),
    activity: varchar("activity", { length: 500 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    resource: varchar("resource", { length: 200 }),
    additionalData: jsonb("additional_data").default("{}"),
  },
  (table) => [
    index("pe_log_idx").on(table.eventLogId),
    index("pe_case_idx").on(table.eventLogId, table.caseId),
    index("pe_activity_idx").on(table.eventLogId, table.activity),
    index("pe_timestamp_idx").on(table.eventLogId, table.timestamp),
  ],
);

// ──────────────────────────────────────────────────────────────
// 47.3 process_conformance_result — Conformance analysis output
// ──────────────────────────────────────────────────────────────

export const processConformanceResult = pgTable(
  "process_conformance_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventLogId: uuid("event_log_id")
      .notNull()
      .references(() => processEventLog.id),
    orgId: uuid("org_id").notNull(),
    processId: uuid("process_id").references(() => process.id),
    conformanceScore: numeric("conformance_score", {
      precision: 5,
      scale: 2,
    }),
    totalTraces: integer("total_traces"),
    conformantTraces: integer("conformant_traces"),
    fitnessGaps: jsonb("fitness_gaps").default("[]"),
    precisionIssues: jsonb("precision_issues").default("[]"),
    reworkLoops: jsonb("rework_loops").default("[]"),
    bottlenecks: jsonb("bottlenecks").default("[]"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pcr_event_log_idx").on(table.eventLogId),
    index("pcr_process_idx").on(table.processId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 47.4 process_mining_suggestion — BPMN update suggestions
// ──────────────────────────────────────────────────────────────

export const processMiningSuggestion = pgTable(
  "process_mining_suggestion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conformanceResultId: uuid("conformance_result_id")
      .notNull()
      .references(() => processConformanceResult.id),
    orgId: uuid("org_id").notNull(),
    suggestionType: varchar("suggestion_type", { length: 30 }).notNull(),
    description: text("description").notNull(),
    evidenceFrequency: numeric("evidence_frequency", {
      precision: 10,
      scale: 2,
    }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
  },
  (table) => [
    index("pms_result_idx").on(table.conformanceResultId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 47.5 process_kpi_definition — KPI definitions per process
// ──────────────────────────────────────────────────────────────

export const processKpiDefinition = pgTable(
  "process_kpi_definition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id),
    name: varchar("name", { length: 500 }).notNull(),
    metricType: varchar("metric_type", { length: 30 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    targetValue: numeric("target_value", {
      precision: 15,
      scale: 4,
    }).notNull(),
    thresholdGreen: numeric("threshold_green", {
      precision: 15,
      scale: 4,
    }).notNull(),
    thresholdYellow: numeric("threshold_yellow", {
      precision: 15,
      scale: 4,
    }).notNull(),
    measurementPeriod: varchar("measurement_period", { length: 20 }).notNull(),
    dataSource: varchar("data_source", { length: 20 }).notNull(),
    apiConfig: jsonb("api_config"),
    ownerId: uuid("owner_id").references(() => user.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pkd_process_idx").on(table.processId),
    index("pkd_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 47.6 process_kpi_measurement — Periodic KPI measurements
// ──────────────────────────────────────────────────────────────

export const processKpiMeasurement = pgTable(
  "process_kpi_measurement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kpiDefinitionId: uuid("kpi_definition_id")
      .notNull()
      .references(() => processKpiDefinition.id),
    orgId: uuid("org_id").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    actualValue: numeric("actual_value", {
      precision: 15,
      scale: 4,
    }).notNull(),
    targetValue: numeric("target_value", {
      precision: 15,
      scale: 4,
    }).notNull(),
    status: varchar("status", { length: 10 }).notNull(),
    dataSourceDetail: text("data_source_detail"),
    measuredBy: uuid("measured_by").references(() => user.id),
    measuredAt: timestamp("measured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pkm_kpi_idx").on(table.kpiDefinitionId, table.periodStart),
  ],
);

// ──────────────────────────────────────────────────────────────
// 47.7 process_maturity_assessment — Assessment results
// ──────────────────────────────────────────────────────────────

export const processMaturityAssessment = pgTable(
  "process_maturity_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id),
    assessmentDate: date("assessment_date", { mode: "string" }).notNull(),
    overallLevel: integer("overall_level").notNull(),
    dimensionScores: jsonb("dimension_scores").notNull(),
    targetLevel: integer("target_level"),
    gapActions: jsonb("gap_actions").default("[]"),
    assessorId: uuid("assessor_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pma_org_idx").on(table.orgId),
    index("pma_process_idx").on(table.processId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 47.8 process_maturity_questionnaire — Shared template (NOT org-scoped)
// ──────────────────────────────────────────────────────────────

export const processMaturityQuestionnaire = pgTable(
  "process_maturity_questionnaire",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dimension: varchar("dimension", { length: 30 }).notNull(),
    questionNumber: integer("question_number").notNull(),
    questionText: jsonb("question_text").notNull(),
    levelMapping: integer("level_mapping").notNull(),
    weight: integer("weight").notNull().default(1),
  },
);

// ──────────────────────────────────────────────────────────────
// 47.9 value_stream_map — VSM diagrams (current + future state)
// ──────────────────────────────────────────────────────────────

export const valueStreamMap = pgTable(
  "value_stream_map",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id),
    mapType: varchar("map_type", { length: 20 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    diagramData: jsonb("diagram_data").notNull(),
    totalLeadTimeMinutes: numeric("total_lead_time_minutes", {
      precision: 15,
      scale: 2,
    }),
    totalValueAddMinutes: numeric("total_value_add_minutes", {
      precision: 15,
      scale: 2,
    }),
    valueAddRatio: numeric("value_add_ratio", { precision: 5, scale: 2 }),
    wasteAnalysis: jsonb("waste_analysis").default("[]"),
    version: integer("version").notNull().default(1),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("vsm_org_idx").on(table.orgId),
    index("vsm_process_idx").on(table.processId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 47.10 process_template — Pre-built BPMN templates (NOT org-scoped)
// ──────────────────────────────────────────────────────────────

export const processTemplate = pgTable(
  "process_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: varchar("domain", { length: 30 }).notNull(),
    name: jsonb("name").notNull(),
    description: jsonb("description"),
    bpmnXml: text("bpmn_xml").notNull(),
    typicalKpis: jsonb("typical_kpis").default("[]"),
    typicalRisks: jsonb("typical_risks").default("[]"),
    typicalControls: jsonb("typical_controls").default("[]"),
    requiredRoles: text("required_roles").array().default([]),
    complexity: varchar("complexity", { length: 20 }).notNull().default("moderate"),
    isPublished: boolean("is_published").notNull().default(true),
  },
);
