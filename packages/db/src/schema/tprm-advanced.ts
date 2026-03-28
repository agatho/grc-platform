// Sprint 44: TPRM Advanced — Vendor Scorecards, Concentration Risk,
// SLA Monitoring, Exit Planning, Sub-Processor Tracking

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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { vendor } from "./tprm";

// ──────────────────────────────────────────────────────────────
// 44.1 vendor_scorecard — Composite score with 7 dimensions
// ──────────────────────────────────────────────────────────────

export const vendorScorecard = pgTable(
  "vendor_scorecard",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull(),
    tier: varchar("tier", { length: 30 }).notNull(),
    dimensionScores: jsonb("dimension_scores").notNull(),
    weights: jsonb("weights").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    previousScore: integer("previous_score"),
    previousTier: varchar("previous_tier", { length: 30 }),
  },
  (table) => [
    uniqueIndex("vs_vendor_idx").on(table.vendorId),
    index("vs_org_idx").on(table.orgId),
    index("vs_tier_idx").on(table.orgId, table.tier),
  ],
);

// ──────────────────────────────────────────────────────────────
// 44.2 vendor_scorecard_history — IMMUTABLE quarterly snapshots
// ──────────────────────────────────────────────────────────────

export const vendorScorecardHistory = pgTable(
  "vendor_scorecard_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scorecardId: uuid("scorecard_id")
      .notNull()
      .references(() => vendorScorecard.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    overallScore: integer("overall_score").notNull(),
    tier: varchar("tier", { length: 30 }).notNull(),
    dimensionScores: jsonb("dimension_scores").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// ──────────────────────────────────────────────────────────────
// 44.3 vendor_concentration_analysis — Concentration results
// ──────────────────────────────────────────────────────────────

export const vendorConcentrationAnalysis = pgTable(
  "vendor_concentration_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    analysisType: varchar("analysis_type", { length: 30 }).notNull(),
    analysisDate: date("analysis_date", { mode: "string" }).notNull(),
    results: jsonb("results").notNull(),
    hhiScore: integer("hhi_score"),
    riskLevel: varchar("risk_level", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("vca_org_idx").on(table.orgId),
    index("vca_type_idx").on(table.orgId, table.analysisType),
  ],
);

// ──────────────────────────────────────────────────────────────
// 44.4 vendor_sla_definition — SLA metrics per vendor/contract
// ──────────────────────────────────────────────────────────────

export const vendorSlaDefinition = pgTable(
  "vendor_sla_definition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id),
    contractId: uuid("contract_id"),
    metricName: varchar("metric_name", { length: 200 }).notNull(),
    metricType: varchar("metric_type", { length: 30 }).notNull(),
    targetValue: numeric("target_value", { precision: 10, scale: 4 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    measurementPeriod: varchar("measurement_period", { length: 20 }).notNull(),
    penaltyClause: text("penalty_clause"),
    evidenceSource: text("evidence_source"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("vsd_vendor_idx").on(table.vendorId),
    index("vsd_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 44.5 vendor_sla_measurement — Periodic measurements
// ──────────────────────────────────────────────────────────────

export const vendorSlaMeasurement = pgTable(
  "vendor_sla_measurement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slaDefinitionId: uuid("sla_definition_id")
      .notNull()
      .references(() => vendorSlaDefinition.id),
    orgId: uuid("org_id").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    actualValue: numeric("actual_value", {
      precision: 10,
      scale: 4,
    }).notNull(),
    targetValue: numeric("target_value", {
      precision: 10,
      scale: 4,
    }).notNull(),
    isMet: boolean("is_met").notNull(),
    breachSeverity: varchar("breach_severity", { length: 20 }),
    evidence: text("evidence"),
    notes: text("notes"),
    measuredBy: uuid("measured_by").references(() => user.id),
    measuredAt: timestamp("measured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("vsm_sla_idx").on(table.slaDefinitionId),
    index("vsm_period_idx").on(table.slaDefinitionId, table.periodStart),
  ],
);

// ──────────────────────────────────────────────────────────────
// 44.6 vendor_exit_plan — Exit strategy per vendor
// ──────────────────────────────────────────────────────────────

export const vendorExitPlan = pgTable(
  "vendor_exit_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id),
    transitionApproach: varchar("transition_approach", {
      length: 30,
    }).notNull(),
    dataMigrationPlan: text("data_migration_plan"),
    knowledgeTransferRequirements: text("knowledge_transfer_requirements"),
    terminationNoticeDays: integer("termination_notice_days"),
    estimatedTimelineMonths: integer("estimated_timeline_months"),
    estimatedCost: numeric("estimated_cost", { precision: 15, scale: 2 }),
    alternativeVendorIds: uuid("alternative_vendor_ids").array().default([]),
    keyRisks: text("key_risks"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    nextReviewDate: date("next_review_date", { mode: "string" }),
    reviewCycleMonths: integer("review_cycle_months").notNull().default(12),
    exitReadinessScore: integer("exit_readiness_score"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("vep_vendor_idx").on(table.vendorId),
    index("vep_org_idx").on(table.orgId),
    index("vep_review_idx").on(table.nextReviewDate),
  ],
);

// ──────────────────────────────────────────────────────────────
// 44.7 vendor_sub_processor — Sub-processor registry
// ──────────────────────────────────────────────────────────────

export const vendorSubProcessor = pgTable(
  "vendor_sub_processor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id),
    name: varchar("name", { length: 500 }).notNull(),
    serviceDescription: text("service_description"),
    dataCategories: text("data_categories").array().default([]),
    hostingCountry: varchar("hosting_country", { length: 5 }),
    isEu: boolean("is_eu").notNull().default(false),
    isAdequateCountry: boolean("is_adequate_country").notNull().default(false),
    requiresTia: boolean("requires_tia").notNull().default(false),
    tiaId: uuid("tia_id"),
    approvalStatus: varchar("approval_status", { length: 20 })
      .notNull()
      .default("pending_review"),
    approvalJustification: text("approval_justification"),
    approvedBy: uuid("approved_by").references(() => user.id),
    dateAdded: date("date_added", { mode: "string" }),
    dateNotified: date("date_notified", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("vsp_vendor_idx").on(table.vendorId),
    index("vsp_org_idx").on(table.orgId),
    index("vsp_approval_idx").on(table.orgId, table.approvalStatus),
  ],
);

// ──────────────────────────────────────────────────────────────
// 44.8 vendor_sub_processor_notification — Change notifications
// ──────────────────────────────────────────────────────────────

export const vendorSubProcessorNotification = pgTable(
  "vendor_sub_processor_notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id),
    notificationType: varchar("notification_type", { length: 20 }).notNull(),
    subProcessorName: varchar("sub_processor_name", { length: 500 }).notNull(),
    changeDescription: text("change_description"),
    receivedAt: date("received_at", { mode: "string" }).notNull(),
    reviewDeadline: date("review_deadline", { mode: "string" }),
    reviewStatus: varchar("review_status", { length: 20 })
      .notNull()
      .default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);
