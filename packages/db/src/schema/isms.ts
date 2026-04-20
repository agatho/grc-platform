// Sprint 5a + 5b: ISMS Module Schema (Drizzle ORM)
// 5a: asset_classification, threat, vulnerability, risk_scenario,
//     security_incident, incident_timeline_entry, process_asset
// 5b: assessment_run, assessment_control_eval, assessment_risk_eval,
//     control_maturity, soa_entry, management_review

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";
import { asset } from "./asset";
import { risk } from "./risk";
import { workItem } from "./work-item";
import { catalogEntry } from "./catalog";
import { control } from "./control";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const protectionLevelEnum = pgEnum("protection_level", [
  "normal",
  "high",
  "very_high",
]);

export const incidentSeverityEnum = pgEnum("incident_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "detected",
  "triaged",
  "contained",
  "eradicated",
  "recovered",
  "lessons_learned",
  "closed",
]);

// ──────────────────────────────────────────────────────────────
// 5a.1 AssetClassification — PRQ per asset (C/I/A levels)
//      One record per asset. Overall protection = max(C, I, A).
// ──────────────────────────────────────────────────────────────

export const assetClassification = pgTable(
  "asset_classification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" })
      .unique(),
    confidentialityLevel: protectionLevelEnum("confidentiality_level")
      .notNull()
      .default("normal"),
    confidentialityReason: text("confidentiality_reason"),
    integrityLevel: protectionLevelEnum("integrity_level")
      .notNull()
      .default("normal"),
    integrityReason: text("integrity_reason"),
    availabilityLevel: protectionLevelEnum("availability_level")
      .notNull()
      .default("normal"),
    availabilityReason: text("availability_reason"),
    overallProtection: protectionLevelEnum("overall_protection")
      .notNull()
      .default("normal"),
    classifiedAt: timestamp("classified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    classifiedBy: uuid("classified_by")
      .notNull()
      .references(() => user.id),
    reviewDate: date("review_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ac_org_idx").on(t.orgId),
    index("ac_overall_idx").on(t.orgId, t.overallProtection),
  ],
);

// ──────────────────────────────────────────────────────────────
// NOTE: process_asset already exists in process.ts (Sprint 3 Gap 1).
// Sprint 5a enhances it with dependency_type, criticality, notes
// columns via ALTER TABLE in post-migration SQL.
// ──────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// 5a.3 Threat — Threat entity (BSI Elementargefaehrdungen)
// ──────────────────────────────────────────────────────────────

export const threat = pgTable(
  "threat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    catalogEntryId: uuid("catalog_entry_id").references(() => catalogEntry.id),
    code: varchar("code", { length: 50 }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    threatCategory: varchar("threat_category", { length: 100 }),
    likelihoodRating: integer("likelihood_rating"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    index("threat_org_idx").on(t.orgId),
    index("threat_category_idx").on(t.orgId, t.threatCategory),
  ],
);

// ──────────────────────────────────────────────────────────────
// 5a.4 Vulnerability — Vulnerability on asset
// ──────────────────────────────────────────────────────────────

export const vulnerability = pgTable(
  "vulnerability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    cveReference: varchar("cve_reference", { length: 50 }),
    affectedAssetId: uuid("affected_asset_id").references(() => asset.id),
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    mitigationControlId: uuid("mitigation_control_id").references(
      () => control.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("vuln_org_idx").on(t.orgId),
    index("vuln_asset_idx").on(t.affectedAssetId),
    index("vuln_severity_idx").on(t.orgId, t.severity),
  ],
);

// ──────────────────────────────────────────────────────────────
// 5a.5 RiskScenario — threat x vulnerability -> risk scoring
// ──────────────────────────────────────────────────────────────

export const riskScenario = pgTable(
  "risk_scenario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id").references(() => risk.id),
    threatId: uuid("threat_id").references(() => threat.id),
    vulnerabilityId: uuid("vulnerability_id").references(
      () => vulnerability.id,
    ),
    assetId: uuid("asset_id").references(() => asset.id),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rs_org_idx").on(t.orgId),
    index("rs_threat_idx").on(t.threatId),
    index("rs_vuln_idx").on(t.vulnerabilityId),
    index("rs_asset_idx").on(t.assetId),
    index("rs_risk_idx").on(t.riskId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 5a.6 SecurityIncident — Incident lifecycle + CIA impact
// ──────────────────────────────────────────────────────────────

export const securityIncident = pgTable(
  "security_incident",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    elementId: varchar("element_id", { length: 50 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    severity: incidentSeverityEnum("severity").notNull().default("medium"),
    status: incidentStatusEnum("status").notNull().default("detected"),
    incidentType: varchar("incident_type", { length: 100 }),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reportedBy: uuid("reported_by").references(() => user.id),
    assignedTo: uuid("assigned_to").references(() => user.id),
    affectedAssetIds: uuid("affected_asset_ids")
      .array()
      .default(sql`'{}'`),
    affectedProcessIds: uuid("affected_process_ids")
      .array()
      .default(sql`'{}'`),
    isDataBreach: boolean("is_data_breach").notNull().default(false),
    dataBreachDeadline: timestamp("data_breach_72h_deadline", {
      withTimezone: true,
    }),
    rootCause: text("root_cause"),
    remediationActions: text("remediation_actions"),
    lessonsLearned: text("lessons_learned"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    updatedBy: uuid("updated_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("si_org_idx").on(t.orgId),
    index("si_status_idx").on(t.orgId, t.status),
    index("si_severity_idx").on(t.orgId, t.severity),
    index("si_breach_idx")
      .on(t.orgId)
      .where(sql`is_data_breach = true`),
  ],
);

// ──────────────────────────────────────────────────────────────
// 5a.7 IncidentTimelineEntry — Event log within incident
// ──────────────────────────────────────────────────────────────

export const incidentTimelineEntry = pgTable(
  "incident_timeline_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => securityIncident.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    actionType: varchar("action_type", { length: 50 }).notNull(),
    description: text("description").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ite_incident_idx").on(t.incidentId),
    index("ite_org_idx").on(t.orgId),
  ],
);

// ══════════════════════════════════════════════════════════════
// Sprint 5b: ISMS Assessment — Enums
// ══════════════════════════════════════════════════════════════

export const assessmentStatusEnum = pgEnum("assessment_status", [
  "planning",
  "in_progress",
  "review",
  "completed",
  "cancelled",
]);

export const assessmentScopeTypeEnum = pgEnum("assessment_scope_type", [
  "full",
  "department",
  "asset_group",
  "custom",
]);

export const evalResultEnum = pgEnum("eval_result", [
  "effective",
  "partially_effective",
  "ineffective",
  "not_applicable",
  "not_evaluated",
]);

export const riskDecisionEnum = pgEnum("risk_decision", [
  "accept",
  "mitigate",
  "transfer",
  "avoid",
  "pending",
]);

export const soaApplicabilityEnum = pgEnum("soa_applicability", [
  "applicable",
  "not_applicable",
  "partially_applicable",
]);

export const soaImplementationEnum = pgEnum("soa_implementation", [
  "implemented",
  "partially_implemented",
  "planned",
  "not_implemented",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

// ══════════════════════════════════════════════════════════════
// 5b.1 AssessmentRun — A scoped ISMS assessment cycle
// ══════════════════════════════════════════════════════════════

export const assessmentRun = pgTable(
  "assessment_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    status: assessmentStatusEnum("status").notNull().default("planning"),
    scopeType: assessmentScopeTypeEnum("scope_type").notNull().default("full"),
    scopeFilter: jsonb("scope_filter"),
    framework: varchar("framework", { length: 100 })
      .notNull()
      .default("iso27001"),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    leadAssessorId: uuid("lead_assessor_id").references(() => user.id),
    completionPercentage: integer("completion_percentage").notNull().default(0),
    completedEvaluations: integer("completed_evaluations").notNull().default(0),
    totalEvaluations: integer("total_evaluations").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    index("arun_org_idx").on(t.orgId),
    index("ar_status_idx").on(t.orgId, t.status),
    index("ar_lead_idx").on(t.leadAssessorId),
  ],
);

// ══════════════════════════════════════════════════════════════
// 5b.2 AssessmentControlEval — Per-control evaluation within a run
// ══════════════════════════════════════════════════════════════

export const assessmentControlEval = pgTable(
  "assessment_control_eval",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    assessmentRunId: uuid("assessment_run_id")
      .notNull()
      .references(() => assessmentRun.id, { onDelete: "cascade" }),
    controlId: uuid("control_id")
      .notNull()
      .references(() => control.id),
    assetId: uuid("asset_id").references(() => asset.id),
    result: evalResultEnum("result").notNull().default("not_evaluated"),
    evidence: text("evidence"),
    notes: text("notes"),
    evidenceDocumentIds: uuid("evidence_document_ids")
      .array()
      .default(sql`'{}'`),
    currentMaturity: integer("current_maturity"),
    targetMaturity: integer("target_maturity"),
    assessedBy: uuid("assessed_by").references(() => user.id),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ace_org_idx").on(t.orgId),
    index("ace_run_idx").on(t.assessmentRunId),
    index("ace_control_idx").on(t.controlId),
    index("ace_asset_idx").on(t.assetId),
  ],
);

// ══════════════════════════════════════════════════════════════
// 5b.3 AssessmentRiskEval — Per-risk-scenario eval within a run
// ══════════════════════════════════════════════════════════════

export const assessmentRiskEval = pgTable(
  "assessment_risk_eval",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    assessmentRunId: uuid("assessment_run_id")
      .notNull()
      .references(() => assessmentRun.id, { onDelete: "cascade" }),
    riskScenarioId: uuid("risk_scenario_id")
      .notNull()
      .references(() => riskScenario.id),
    residualLikelihood: integer("residual_likelihood"),
    residualImpact: integer("residual_impact"),
    decision: riskDecisionEnum("decision").notNull().default("pending"),
    justification: text("justification"),
    evaluatedBy: uuid("evaluated_by").references(() => user.id),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("are_org_idx").on(t.orgId),
    index("are_run_idx").on(t.assessmentRunId),
    index("are_scenario_idx").on(t.riskScenarioId),
  ],
);

// ══════════════════════════════════════════════════════════════
// 5b.4 ControlMaturity — Maturity tracking per control
// ══════════════════════════════════════════════════════════════

export const controlMaturity = pgTable(
  "control_maturity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id")
      .notNull()
      .references(() => control.id, { onDelete: "cascade" }),
    assessmentRunId: uuid("assessment_run_id").references(
      () => assessmentRun.id,
    ),
    currentMaturity: integer("current_maturity").notNull(),
    targetMaturity: integer("target_maturity").notNull(),
    justification: text("justification"),
    assessedBy: uuid("assessed_by").references(() => user.id),
    assessedAt: timestamp("assessed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("cm_control_run_uniq").on(t.controlId, t.assessmentRunId),
    index("cmat_org_idx").on(t.orgId),
    index("cm_control_idx").on(t.controlId),
    index("cm_run_idx").on(t.assessmentRunId),
  ],
);

// ══════════════════════════════════════════════════════════════
// 5b.5 SoaEntry — Statement of Applicability row
// ══════════════════════════════════════════════════════════════

export const soaEntry = pgTable(
  "soa_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    catalogEntryId: uuid("catalog_entry_id")
      .notNull()
      .references(() => catalogEntry.id),
    controlId: uuid("control_id").references(() => control.id),
    applicability: soaApplicabilityEnum("applicability")
      .notNull()
      .default("applicable"),
    applicabilityJustification: text("applicability_justification"),
    implementation: soaImplementationEnum("implementation")
      .notNull()
      .default("not_implemented"),
    implementationNotes: text("implementation_notes"),
    responsibleId: uuid("responsible_id").references(() => user.id),
    lastReviewed: timestamp("last_reviewed", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("soa_org_catalog_uniq").on(t.orgId, t.catalogEntryId),
    index("soa_org_idx").on(t.orgId),
    index("soa_catalog_idx").on(t.catalogEntryId),
    index("soa_control_idx").on(t.controlId),
    index("soa_applicability_idx").on(t.orgId, t.applicability),
  ],
);

// ══════════════════════════════════════════════════════════════
// 5b.6 ManagementReview — ISO 27001 Clause 9.3 reviews
// ══════════════════════════════════════════════════════════════

export const managementReview = pgTable(
  "management_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    reviewDate: date("review_date", { mode: "string" }).notNull(),
    status: reviewStatusEnum("status").notNull().default("planned"),
    chairId: uuid("chair_id").references(() => user.id),
    participantIds: uuid("participant_ids")
      .array()
      .default(sql`'{}'`),
    changesInContext: text("changes_in_context"),
    performanceFeedback: text("performance_feedback"),
    riskAssessmentResults: text("risk_assessment_results"),
    auditResults: text("audit_results"),
    improvementOpportunities: text("improvement_opportunities"),
    decisions: jsonb("decisions"),
    actionItems: jsonb("action_items"),
    minutes: text("minutes"),
    nextReviewDate: date("next_review_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    index("mr_org_idx").on(t.orgId),
    index("mr_status_idx").on(t.orgId, t.status),
    index("mr_date_idx").on(t.orgId, t.reviewDate),
  ],
);
