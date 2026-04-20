// Sprint 76: Certification und Audit Prep Wizard
// Tables: cert_readiness_assessment, cert_evidence_package, cert_mock_audit

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
  uniqueIndex,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 76.1 Cert Readiness Assessment — Multi-framework readiness
// ──────────────────────────────────────────────────────────────

export const certReadinessAssessment = pgTable(
  "cert_readiness_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    assessmentCode: varchar("assessment_code", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    framework: varchar("framework", { length: 50 }).notNull(), // iso_27001 | bsi_grundschutz | nis2 | soc2_type2 | tisax | iso_22301 | iso_9001
    frameworkVersion: varchar("framework_version", { length: 50 }),
    scope: text("scope"),
    targetCertDate: date("target_cert_date"),
    // Assessment results
    totalControls: integer("total_controls").notNull().default(0),
    implementedControls: integer("implemented_controls").notNull().default(0),
    partialControls: integer("partial_controls").notNull().default(0),
    notImplemented: integer("not_implemented").notNull().default(0),
    notApplicable: integer("not_applicable").notNull().default(0),
    readinessScore: numeric("readiness_score", { precision: 5, scale: 2 }), // 0-100
    controlDetails: jsonb("control_details").default("[]"), // [{controlRef, title, status, gaps, evidence, priority}]
    gapAnalysis: jsonb("gap_analysis").default("[]"), // [{area, gap, severity, recommendation, effort}]
    timeline: jsonb("timeline").default("[]"), // [{phase, startDate, endDate, tasks, status}]
    risks: jsonb("risks").default("[]"), // [{risk, impact, mitigation}]
    // Ownership
    leadAssessorId: uuid("lead_assessor_id").references(() => user.id),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    nextReviewDate: date("next_review_date"),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | in_progress | completed | approved | expired
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("cra_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("cra_code_idx").on(table.orgId, table.assessmentCode),
    fwIdx: index("cra_fw_idx").on(table.orgId, table.framework),
    statusIdx: index("cra_status_idx").on(table.orgId, table.status),
    scoreIdx: index("cra_score_idx").on(table.orgId, table.readinessScore),
  }),
);

export const certReadinessAssessmentRelations = relations(
  certReadinessAssessment,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [certReadinessAssessment.orgId],
      references: [organization.id],
    }),
    leadAssessor: one(user, {
      fields: [certReadinessAssessment.leadAssessorId],
      references: [user.id],
    }),
    evidencePackages: many(certEvidencePackage),
    mockAudits: many(certMockAudit),
  }),
);

// ──────────────────────────────────────────────────────────────
// 76.2 Cert Evidence Package — Evidence Package Generator
// ──────────────────────────────────────────────────────────────

export const certEvidencePackage = pgTable(
  "cert_evidence_package",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    assessmentId: uuid("assessment_id").references(
      () => certReadinessAssessment.id,
      { onDelete: "cascade" },
    ),
    packageCode: varchar("package_code", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    framework: varchar("framework", { length: 50 }).notNull(),
    controlRefs: text("control_refs").array(), // ["A.5.1", "A.5.2"]
    evidenceItems: jsonb("evidence_items").default("[]"), // [{documentId, title, type, controlRef, uploadedAt, status}]
    completeness: numeric("completeness", { precision: 5, scale: 2 }), // 0-100
    missingEvidence: jsonb("missing_evidence").default("[]"), // [{controlRef, requiredType, description}]
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    generatedBy: uuid("generated_by").references(() => user.id),
    exportFormat: varchar("export_format", { length: 20 }), // pdf | zip | xlsx
    exportUrl: varchar("export_url", { length: 2000 }),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | generating | complete | submitted
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("cep_org_idx").on(table.orgId),
    assessIdx: index("cep_assess_idx").on(table.assessmentId),
    codeIdx: uniqueIndex("cep_code_idx").on(table.orgId, table.packageCode),
    fwIdx: index("cep_fw_idx").on(table.orgId, table.framework),
    statusIdx: index("cep_status_idx").on(table.orgId, table.status),
  }),
);

export const certEvidencePackageRelations = relations(
  certEvidencePackage,
  ({ one }) => ({
    organization: one(organization, {
      fields: [certEvidencePackage.orgId],
      references: [organization.id],
    }),
    assessment: one(certReadinessAssessment, {
      fields: [certEvidencePackage.assessmentId],
      references: [certReadinessAssessment.id],
    }),
    generator: one(user, {
      fields: [certEvidencePackage.generatedBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 76.3 Cert Mock Audit — Mock Audit with AI Questions
// ──────────────────────────────────────────────────────────────

export const certMockAudit = pgTable(
  "cert_mock_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    assessmentId: uuid("assessment_id").references(
      () => certReadinessAssessment.id,
      { onDelete: "cascade" },
    ),
    auditCode: varchar("audit_code", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    framework: varchar("framework", { length: 50 }).notNull(),
    auditType: varchar("audit_type", { length: 50 }).notNull(), // stage_1 | stage_2 | surveillance | recertification
    scope: text("scope"),
    // AI-generated questions
    questions: jsonb("questions").default("[]"), // [{controlRef, question, expectedAnswer, difficulty, category}]
    totalQuestions: integer("total_questions").notNull().default(0),
    answeredQuestions: integer("answered_questions").notNull().default(0),
    // Responses
    responses: jsonb("responses").default("[]"), // [{questionIndex, response, aiScore, aiFeedback, evidence}]
    overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
    findings: jsonb("findings").default("[]"), // [{severity, controlRef, finding, recommendation}]
    strengths: jsonb("strengths").default("[]"), // [{area, description}]
    weaknesses: jsonb("weaknesses").default("[]"), // [{area, description, remediation}]
    // Execution
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    auditorId: uuid("auditor_id").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | in_progress | completed | reviewed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("cma_org_idx").on(table.orgId),
    assessIdx: index("cma_assess_idx").on(table.assessmentId),
    codeIdx: uniqueIndex("cma_code_idx").on(table.orgId, table.auditCode),
    fwIdx: index("cma_fw_idx").on(table.orgId, table.framework),
    statusIdx: index("cma_status_idx").on(table.orgId, table.status),
  }),
);

export const certMockAuditRelations = relations(certMockAudit, ({ one }) => ({
  organization: one(organization, {
    fields: [certMockAudit.orgId],
    references: [organization.id],
  }),
  assessment: one(certReadinessAssessment, {
    fields: [certMockAudit.assessmentId],
    references: [certReadinessAssessment.id],
  }),
  auditor: one(user, {
    fields: [certMockAudit.auditorId],
    references: [user.id],
  }),
}));
