// Sprint 78: GRC Benchmarking und Maturity Model
// 5 entities: maturity_model, maturity_assessment, maturity_roadmap_item,
//             benchmark_pool, benchmark_submission

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

export const maturityLevelEnum = pgEnum("maturity_level", [
  "initial",
  "managed",
  "defined",
  "quantitatively_managed",
  "optimizing",
]);

export const maturityModuleKeyEnum = pgEnum("maturity_module_key", [
  "erm",
  "isms",
  "bcms",
  "dpms",
  "audit",
  "ics",
  "esg",
  "tprm",
  "bpm",
  "overall",
]);

export const maturityAssessmentStatusEnum = pgEnum("maturity_assessment_status", [
  "draft",
  "in_progress",
  "completed",
  "approved",
]);

export const roadmapItemStatusEnum = pgEnum("maturity_roadmap_item_status", [
  "planned",
  "in_progress",
  "completed",
  "deferred",
]);

export const roadmapItemPriorityEnum = pgEnum("maturity_roadmap_item_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const benchmarkIndustryEnum = pgEnum("benchmark_industry", [
  "financial_services",
  "healthcare",
  "manufacturing",
  "technology",
  "energy",
  "retail",
  "public_sector",
  "insurance",
  "automotive",
  "other",
]);

// ──────────────────────────────────────────────────────────────
// 78.1 MaturityModel — CMMI-based 5-level model definition per module
// ──────────────────────────────────────────────────────────────

export const maturityModel = pgTable(
  "maturity_model",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    moduleKey: maturityModuleKeyEnum("module_key").notNull(),
    currentLevel: maturityLevelEnum("current_level").notNull().default("initial"),
    targetLevel: maturityLevelEnum("target_level"),
    targetDate: timestamp("target_date", { withTimezone: true }),
    scoreBreakdown: jsonb("score_breakdown").notNull().default(sql`'{}'::jsonb`),
    autoCalculated: boolean("auto_calculated").notNull().default(true),
    lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mm_org_idx").on(t.orgId),
    unique("mm_org_module_unique").on(t.orgId, t.moduleKey),
  ],
);

// ──────────────────────────────────────────────────────────────
// 78.2 MaturityAssessment — Point-in-time assessment snapshots
// ──────────────────────────────────────────────────────────────

export const maturityAssessment = pgTable(
  "maturity_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    moduleKey: maturityModuleKeyEnum("module_key").notNull(),
    status: maturityAssessmentStatusEnum("status").notNull().default("draft"),
    assessorId: uuid("assessor_id").references(() => user.id),
    overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
    level: maturityLevelEnum("level"),
    criteriaScores: jsonb("criteria_scores").notNull().default(sql`'[]'::jsonb`),
    evidenceRefs: jsonb("evidence_refs").notNull().default(sql`'[]'::jsonb`),
    findings: jsonb("findings").notNull().default(sql`'[]'::jsonb`),
    recommendations: jsonb("recommendations").notNull().default(sql`'[]'::jsonb`),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ma_org_idx").on(t.orgId),
    index("ma_module_idx").on(t.orgId, t.moduleKey),
    index("ma_status_idx").on(t.orgId, t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 78.3 MaturityRoadmapItem — Improvement actions for target level
// ──────────────────────────────────────────────────────────────

export const maturityRoadmapItem = pgTable(
  "maturity_roadmap_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    moduleKey: maturityModuleKeyEnum("module_key").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    fromLevel: maturityLevelEnum("from_level").notNull(),
    toLevel: maturityLevelEnum("to_level").notNull(),
    status: roadmapItemStatusEnum("status").notNull().default("planned"),
    priority: roadmapItemPriorityEnum("priority").notNull().default("medium"),
    assigneeId: uuid("assignee_id").references(() => user.id),
    estimatedEffortDays: integer("estimated_effort_days"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mri_org_idx").on(t.orgId),
    index("mri_module_idx").on(t.orgId, t.moduleKey),
    index("mri_status_idx").on(t.orgId, t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 78.4 BenchmarkPool — Anonymous cross-org benchmark pool
// ──────────────────────────────────────────────────────────────

export const benchmarkPool = pgTable(
  "benchmark_pool",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleKey: maturityModuleKeyEnum("module_key").notNull(),
    industry: benchmarkIndustryEnum("industry").notNull(),
    orgSizeRange: varchar("org_size_range", { length: 50 }).notNull(),
    participantCount: integer("participant_count").notNull().default(0),
    avgScore: numeric("avg_score", { precision: 5, scale: 2 }),
    medianScore: numeric("median_score", { precision: 5, scale: 2 }),
    p25Score: numeric("p25_score", { precision: 5, scale: 2 }),
    p75Score: numeric("p75_score", { precision: 5, scale: 2 }),
    distribution: jsonb("distribution").notNull().default(sql`'{}'::jsonb`),
    periodLabel: varchar("period_label", { length: 50 }).notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bp_module_idx").on(t.moduleKey),
    index("bp_industry_idx").on(t.industry),
    index("bp_period_idx").on(t.periodLabel),
  ],
);

// ──────────────────────────────────────────────────────────────
// 78.5 BenchmarkSubmission — Opt-in anonymized data from org
// ──────────────────────────────────────────────────────────────

export const benchmarkSubmission = pgTable(
  "benchmark_submission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    moduleKey: maturityModuleKeyEnum("module_key").notNull(),
    industry: benchmarkIndustryEnum("industry").notNull(),
    orgSizeRange: varchar("org_size_range", { length: 50 }).notNull(),
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    level: maturityLevelEnum("level").notNull(),
    anonymizedData: jsonb("anonymized_data").notNull().default(sql`'{}'::jsonb`),
    consentGiven: boolean("consent_given").notNull().default(false),
    submittedBy: uuid("submitted_by").references(() => user.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bs_org_idx").on(t.orgId),
    index("bs_module_idx").on(t.orgId, t.moduleKey),
  ],
);
