// Sprint 68: AI Evidence Review Agent
// Tables: evidence_review_job, evidence_review_result, evidence_review_gap

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
// 68.1 Evidence Review Job — Batch review request
// ──────────────────────────────────────────────────────────────

export const evidenceReviewJob = pgTable(
  "evidence_review_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    scope: varchar("scope", { length: 50 }).notNull().default("all"), // all | control | framework | custom
    scopeFilter: jsonb("scope_filter").default("{}"), // {controlIds, frameworkIds, ...}
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | running | completed | failed | cancelled
    totalArtifacts: integer("total_artifacts").notNull().default(0),
    reviewedArtifacts: integer("reviewed_artifacts").notNull().default(0),
    compliantArtifacts: integer("compliant_artifacts").notNull().default(0),
    nonCompliantArtifacts: integer("non_compliant_artifacts")
      .notNull()
      .default(0),
    gapsIdentified: integer("gaps_identified").notNull().default(0),
    overallConfidence: numeric("overall_confidence", {
      precision: 5,
      scale: 2,
    }),
    model: varchar("model", { length: 100 }),
    totalTokensUsed: integer("total_tokens_used").notNull().default(0),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("erj_org_idx").on(table.orgId),
    statusIdx: index("erj_status_idx").on(table.orgId, table.status),
    createdIdx: index("erj_created_idx").on(table.orgId, table.createdAt),
  }),
);

export const evidenceReviewJobRelations = relations(
  evidenceReviewJob,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [evidenceReviewJob.orgId],
      references: [organization.id],
    }),
    creator: one(user, {
      fields: [evidenceReviewJob.createdBy],
      references: [user.id],
    }),
    results: many(evidenceReviewResult),
    gaps: many(evidenceReviewGap),
  }),
);

// ──────────────────────────────────────────────────────────────
// 68.2 Evidence Review Result — Per-artifact analysis
// ──────────────────────────────────────────────────────────────

export const evidenceReviewResult = pgTable(
  "evidence_review_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => evidenceReviewJob.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    evidenceId: uuid("evidence_id").notNull(),
    controlId: uuid("control_id"),
    artifactName: varchar("artifact_name", { length: 500 }).notNull(),
    classification: varchar("classification", { length: 30 }).notNull(), // compliant | partially_compliant | non_compliant | inconclusive
    confidenceScore: numeric("confidence_score", {
      precision: 5,
      scale: 2,
    }).notNull(), // 0-100
    reasoning: text("reasoning").notNull(),
    requirements: jsonb("requirements").default("[]"), // [{requirement, met, evidence_excerpt}]
    completenessScore: numeric("completeness_score", {
      precision: 5,
      scale: 2,
    }), // 0-100
    freshnessScore: numeric("freshness_score", { precision: 5, scale: 2 }), // 0-100
    qualityScore: numeric("quality_score", { precision: 5, scale: 2 }), // 0-100
    suggestedImprovements: jsonb("suggested_improvements").default("[]"),
    aiDecisionLog: jsonb("ai_decision_log").default("{}"), // full AI reasoning chain
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    jobIdx: index("err_job_idx").on(table.jobId),
    orgIdx: index("err_org_idx").on(table.orgId),
    evidenceIdx: index("err_evidence_idx").on(table.orgId, table.evidenceId),
    classIdx: index("err_class_idx").on(table.orgId, table.classification),
    controlIdx: index("err_control_idx").on(table.orgId, table.controlId),
  }),
);

export const evidenceReviewResultRelations = relations(
  evidenceReviewResult,
  ({ one }) => ({
    job: one(evidenceReviewJob, {
      fields: [evidenceReviewResult.jobId],
      references: [evidenceReviewJob.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 68.3 Evidence Review Gap — Identified gaps from review
// ──────────────────────────────────────────────────────────────

export const evidenceReviewGap = pgTable(
  "evidence_review_gap",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => evidenceReviewJob.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    controlId: uuid("control_id"),
    gapType: varchar("gap_type", { length: 50 }).notNull(), // missing_evidence | outdated | incomplete | quality_issue
    severity: varchar("severity", { length: 20 }).notNull(), // critical | high | medium | low
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description").notNull(),
    affectedRequirements: jsonb("affected_requirements").default("[]"),
    suggestedRemediation: text("suggested_remediation"),
    findingId: uuid("finding_id"), // auto-created finding reference
    status: varchar("status", { length: 20 }).notNull().default("open"), // open | acknowledged | remediated | false_positive
    acknowledgedBy: uuid("acknowledged_by").references(() => user.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    jobIdx: index("erg_job_idx").on(table.jobId),
    orgIdx: index("erg_org_idx").on(table.orgId),
    severityIdx: index("erg_severity_idx").on(table.orgId, table.severity),
    statusIdx: index("erg_status_idx").on(table.orgId, table.status),
  }),
);

export const evidenceReviewGapRelations = relations(
  evidenceReviewGap,
  ({ one }) => ({
    job: one(evidenceReviewJob, {
      fields: [evidenceReviewGap.jobId],
      references: [evidenceReviewJob.id],
    }),
    acknowledger: one(user, {
      fields: [evidenceReviewGap.acknowledgedBy],
      references: [user.id],
    }),
  }),
);
