// Sprint 66: Cross-Framework Auto-Mapping Engine
// 5 entities: framework_mapping, framework_mapping_rule, control_framework_coverage,
// framework_gap_analysis, framework_coverage_snapshot

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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 66.1 FrameworkMapping — NIST OLIR-based cross-framework mappings
// Maps between ISO 27001, NIS2, BSI, NIST CSF, SOC2, TISAX, DORA, GDPR, COBIT, CIS
// ──────────────────────────────────────────────────────────────

export const frameworkMapping = pgTable(
  "framework_mapping",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceFramework: varchar("source_framework", { length: 50 }).notNull(),
    sourceControlId: varchar("source_control_id", { length: 100 }).notNull(),
    sourceControlTitle: varchar("source_control_title", { length: 500 }),
    targetFramework: varchar("target_framework", { length: 50 }).notNull(),
    targetControlId: varchar("target_control_id", { length: 100 }).notNull(),
    targetControlTitle: varchar("target_control_title", { length: 500 }),
    relationshipType: varchar("relationship_type", { length: 30 }).notNull(), // equal | subset | superset | intersect | not_related
    confidence: numeric("confidence", { precision: 5, scale: 2 })
      .notNull()
      .default("0.80"), // 0.00 - 1.00
    mappingSource: varchar("mapping_source", { length: 30 })
      .notNull()
      .default("nist_olir"), // nist_olir | manual | ai_suggested
    rationale: text("rationale"),
    isVerified: boolean("is_verified").notNull().default(false),
    verifiedBy: uuid("verified_by").references(() => user.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    isBuiltIn: boolean("is_built_in").notNull().default(true),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("fm_source_idx").on(table.sourceFramework, table.sourceControlId),
    index("fm_target_idx").on(table.targetFramework, table.targetControlId),
    index("fm_rel_type_idx").on(table.relationshipType),
    index("fm_confidence_idx").on(table.confidence),
    uniqueIndex("fm_unique_mapping_idx").on(
      table.sourceFramework,
      table.sourceControlId,
      table.targetFramework,
      table.targetControlId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 66.2 FrameworkMappingRule — Org-specific mapping overrides/additions
// ──────────────────────────────────────────────────────────────

export const frameworkMappingRule = pgTable(
  "framework_mapping_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    mappingId: uuid("mapping_id").references(() => frameworkMapping.id),
    sourceFramework: varchar("source_framework", { length: 50 }).notNull(),
    sourceControlId: varchar("source_control_id", { length: 100 }).notNull(),
    targetFramework: varchar("target_framework", { length: 50 }).notNull(),
    targetControlId: varchar("target_control_id", { length: 100 }).notNull(),
    ruleType: varchar("rule_type", { length: 20 }).notNull(), // override | addition | exclusion
    confidence: numeric("confidence", { precision: 5, scale: 2 }),
    rationale: text("rationale"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("fmr_org_idx").on(table.orgId),
    index("fmr_mapping_idx").on(table.mappingId),
    index("fmr_source_idx").on(table.sourceFramework, table.sourceControlId),
    index("fmr_target_idx").on(table.targetFramework, table.targetControlId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 66.3 ControlFrameworkCoverage — Per-control coverage across frameworks
// "Assess once, comply everywhere"
// ──────────────────────────────────────────────────────────────

export const controlFrameworkCoverage = pgTable(
  "control_framework_coverage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id").notNull(), // references control table
    framework: varchar("framework", { length: 50 }).notNull(),
    frameworkControlId: varchar("framework_control_id", {
      length: 100,
    }).notNull(),
    coverageStatus: varchar("coverage_status", { length: 30 }).notNull(), // covered | partially_covered | not_covered | not_applicable
    coverageSource: varchar("coverage_source", { length: 30 }).notNull(), // direct_assessment | mapped | inherited | manual
    evidenceStatus: varchar("evidence_status", { length: 30 })
      .notNull()
      .default("missing"), // fresh | stale | missing | not_required
    lastAssessedAt: timestamp("last_assessed_at", { withTimezone: true }),
    assessmentResult: varchar("assessment_result", { length: 20 }), // effective | partially_effective | ineffective
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cfc_org_idx").on(table.orgId),
    index("cfc_control_idx").on(table.controlId),
    index("cfc_framework_idx").on(table.framework),
    index("cfc_status_idx").on(table.coverageStatus),
    uniqueIndex("cfc_unique_idx").on(
      table.orgId,
      table.controlId,
      table.framework,
      table.frameworkControlId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 66.4 FrameworkGapAnalysis — Gap analysis per framework
// ──────────────────────────────────────────────────────────────

export const frameworkGapAnalysis = pgTable(
  "framework_gap_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    framework: varchar("framework", { length: 50 }).notNull(),
    analysisDate: timestamp("analysis_date", { withTimezone: true }).notNull(),
    totalControls: integer("total_controls").notNull(),
    coveredControls: integer("covered_controls").notNull(),
    partiallyCoveredControls: integer("partially_covered_controls").notNull(),
    notCoveredControls: integer("not_covered_controls").notNull(),
    notApplicableControls: integer("not_applicable_controls")
      .notNull()
      .default(0),
    coveragePercentage: numeric("coverage_percentage", {
      precision: 5,
      scale: 2,
    }).notNull(),
    gapDetails: jsonb("gap_details").default("[]"), // [{controlId, controlTitle, status, recommendation}]
    prioritizedActions: jsonb("prioritized_actions").default("[]"), // [{action, priority, effort, impact}]
    riskExposure: varchar("risk_exposure", { length: 20 }), // critical | high | medium | low
    estimatedEffortDays: integer("estimated_effort_days"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("fga_org_idx").on(table.orgId),
    index("fga_framework_idx").on(table.framework),
    index("fga_date_idx").on(table.analysisDate),
  ],
);

// ──────────────────────────────────────────────────────────────
// 66.5 FrameworkCoverageSnapshot — Point-in-time coverage heatmap
// ──────────────────────────────────────────────────────────────

export const frameworkCoverageSnapshot = pgTable(
  "framework_coverage_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    snapshotDate: timestamp("snapshot_date", { withTimezone: true }).notNull(),
    frameworkScores: jsonb("framework_scores").notNull(), // { ISO27001: { coverage: 87, gaps: 12 }, NIS2: { ... }, ... }
    overallCoverage: numeric("overall_coverage", {
      precision: 5,
      scale: 2,
    }).notNull(),
    totalFrameworks: integer("total_frameworks").notNull(),
    fullyCompliant: integer("fully_compliant").notNull(),
    partiallyCompliant: integer("partially_compliant").notNull(),
    nonCompliant: integer("non_compliant").notNull(),
    heatmapData: jsonb("heatmap_data").default("{}"), // category x framework matrix
    trendData: jsonb("trend_data").default("{}"), // comparison with previous snapshot
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("fcs_org_idx").on(table.orgId),
    index("fcs_date_idx").on(table.snapshotDate),
  ],
);
