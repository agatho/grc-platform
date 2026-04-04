// Sprint 42: DPMS Advanced — Retention, TIA, Processor Agreements,
// Privacy by Design, Consent Management

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
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// retention_schedule — Data retention rules per category
// ──────────────────────────────────────────────────────────────

export const retentionSchedule = pgTable(
  "retention_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    dataCategory: varchar("data_category", { length: 50 }).notNull(),
    legalBasisReference: varchar("legal_basis_reference", { length: 500 }),
    retentionPeriodMonths: integer("retention_period_months").notNull(),
    retentionStartEvent: varchar("retention_start_event", {
      length: 30,
    }).notNull(),
    responsibleDepartment: varchar("responsible_department", { length: 200 }),
    responsibleId: uuid("responsible_id").references(() => user.id),
    deletionMethod: varchar("deletion_method", { length: 20 }).notNull(),
    affectedSystems: jsonb("affected_systems").default("[]"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rsch_org_idx").on(table.orgId),
    index("rs_category_idx").on(table.orgId, table.dataCategory),
  ],
);

// ──────────────────────────────────────────────────────────────
// retention_exception — Litigation holds and regulatory exceptions
// ──────────────────────────────────────────────────────────────

export const retentionException = pgTable(
  "retention_exception",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => retentionSchedule.id),
    reason: varchar("reason", { length: 30 }).notNull(),
    legalBasis: varchar("legal_basis", { length: 500 }),
    description: text("description"),
    expiresAt: date("expires_at").notNull(),
    responsibleId: uuid("responsible_id").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    releasedBy: uuid("released_by").references(() => user.id),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("re_schedule_idx").on(table.scheduleId),
    index("re_status_idx").on(table.orgId, table.status),
    index("re_expiry_idx").on(table.expiresAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// deletion_request — Deletion workflow with approval
// ──────────────────────────────────────────────────────────────

export const deletionRequest = pgTable(
  "deletion_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => retentionSchedule.id),
    title: varchar("title", { length: 500 }).notNull(),
    dataCategory: varchar("data_category", { length: 50 }).notNull(),
    recordCountEstimate: integer("record_count_estimate"),
    affectedSystemIds: jsonb("affected_system_ids").default("[]"),
    status: varchar("status", { length: 30 }).notNull().default("identified"),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedBy: uuid("rejected_by").references(() => user.id),
    rejectionReason: text("rejection_reason"),
    deletionStartedAt: timestamp("deletion_started_at", {
      withTimezone: true,
    }),
    deletionCompletedAt: timestamp("deletion_completed_at", {
      withTimezone: true,
    }),
    verifiedBy: uuid("verified_by").references(() => user.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verificationMethod: varchar("verification_method", { length: 30 }),
    evidenceDescription: text("evidence_description"),
    evidenceDocumentId: uuid("evidence_document_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("dr_org_idx").on(table.orgId),
    index("drun_status_idx").on(table.orgId, table.status),
    index("dr_schedule_idx").on(table.scheduleId),
  ],
);

// ──────────────────────────────────────────────────────────────
// transfer_impact_assessment — TIA with country risk
// ──────────────────────────────────────────────────────────────

export const transferImpactAssessment = pgTable(
  "transfer_impact_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    dataFlowId: uuid("data_flow_id"),
    title: varchar("title", { length: 500 }).notNull(),
    transferDescription: text("transfer_description"),
    dataCategories: jsonb("data_categories").notNull().default("[]"),
    legalTransferBasis: varchar("legal_transfer_basis", {
      length: 30,
    }).notNull(),
    recipientCountry: varchar("recipient_country", { length: 5 }).notNull(),
    countryRiskLevel: varchar("country_risk_level", { length: 20 }),
    surveillanceLawAssessment: text("surveillance_law_assessment"),
    governmentAccessRisk: text("government_access_risk"),
    ruleOfLawAssessment: text("rule_of_law_assessment"),
    dpaIndependenceAssessment: text("dpa_independence_assessment"),
    judicialRedressAssessment: text("judicial_redress_assessment"),
    overallCountryRiskScore: integer("overall_country_risk_score"),
    supplementaryMeasuresRequired: boolean("supplementary_measures_required")
      .notNull()
      .default(false),
    technicalMeasures: jsonb("technical_measures").default("[]"),
    contractualMeasures: jsonb("contractual_measures").default("[]"),
    organizationalMeasures: jsonb("organizational_measures").default("[]"),
    assessmentResult: varchar("assessment_result", { length: 50 }),
    assessorId: uuid("assessor_id").references(() => user.id),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    nextReviewDate: date("next_review_date"),
    reviewTriggerNotes: text("review_trigger_notes"),
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
    index("tiaa_org_idx").on(table.orgId),
    index("tia_flow_idx").on(table.dataFlowId),
    index("tiaa_country_idx").on(table.recipientCountry),
    index("tia_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// country_risk_profile — Shared reference data (NOT org-scoped)
// ──────────────────────────────────────────────────────────────

export const countryRiskProfile = pgTable(
  "country_risk_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryCode: varchar("country_code", { length: 5 }).notNull(),
    countryName: varchar("country_name", { length: 200 }).notNull(),
    euAdequacyDecision: boolean("eu_adequacy_decision")
      .notNull()
      .default(false),
    adequacyDecisionDate: date("adequacy_decision_date"),
    surveillanceLawsSummary: text("surveillance_laws_summary"),
    governmentAccessSummary: text("government_access_summary"),
    ruleOfLawIndex: numeric("rule_of_law_index", {
      precision: 5,
      scale: 2,
    }),
    dpaIndependent: boolean("dpa_independent"),
    judicialRedressAvailable: boolean("judicial_redress_available"),
    overallRiskLevel: varchar("overall_risk_level", { length: 20 }).notNull(),
    edpbAssessmentNotes: text("edpb_assessment_notes"),
    lastUpdated: date("last_updated").notNull(),
  },
  (table) => [uniqueIndex("crp_country_idx").on(table.countryCode)],
);

// ──────────────────────────────────────────────────────────────
// processor_agreement — Art. 28 processor management
// ──────────────────────────────────────────────────────────────

export const processorAgreement = pgTable(
  "processor_agreement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    vendorId: uuid("vendor_id"),
    processorName: varchar("processor_name", { length: 500 }).notNull(),
    processorDpoContact: text("processor_dpo_contact"),
    processingActivities: jsonb("processing_activities").default("[]"),
    agreementStatus: varchar("agreement_status", { length: 20 })
      .notNull()
      .default("pending"),
    agreementDocumentId: uuid("agreement_document_id"),
    effectiveDate: date("effective_date"),
    expiryDate: date("expiry_date"),
    reviewDate: date("review_date"),
    complianceChecklist: jsonb("compliance_checklist").default("[]"),
    overallComplianceStatus: varchar("overall_compliance_status", {
      length: 20,
    }),
    authorizedSubProcessors: jsonb("authorized_sub_processors").default("[]"),
    subProcessorNotificationRequired: boolean(
      "sub_processor_notification_required",
    )
      .notNull()
      .default(true),
    lastAuditDate: date("last_audit_date"),
    nextAuditDate: date("next_audit_date"),
    auditFindingsCount: integer("audit_findings_count").notNull().default(0),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pa_org_idx").on(table.orgId),
    index("pa_vendor_idx").on(table.vendorId),
    index("pa_status_idx").on(table.orgId, table.agreementStatus),
  ],
);

// ──────────────────────────────────────────────────────────────
// sub_processor_notification — Change notifications
// ──────────────────────────────────────────────────────────────

export const subProcessorNotification = pgTable(
  "sub_processor_notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => processorAgreement.id, { onDelete: "cascade" }),
    notificationType: varchar("notification_type", { length: 30 }).notNull(),
    subProcessorName: varchar("sub_processor_name", { length: 500 }).notNull(),
    subProcessorCountry: varchar("sub_processor_country", { length: 5 }),
    processingScope: text("processing_scope"),
    notifiedAt: timestamp("notified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    responseDeadline: date("response_deadline").notNull(),
    response: varchar("response", { length: 20 }).notNull().default("pending"),
    responseBy: uuid("response_by").references(() => user.id),
    responseAt: timestamp("response_at", { withTimezone: true }),
    objectionReason: text("objection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("spn_agreement_idx").on(table.agreementId),
    index("spn_response_idx").on(table.orgId, table.response),
  ],
);

// ──────────────────────────────────────────────────────────────
// pbd_assessment — Privacy by Design assessments
// ──────────────────────────────────────────────────────────────

export const pbdAssessment = pgTable(
  "pbd_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    projectName: varchar("project_name", { length: 500 }).notNull(),
    projectDescription: text("project_description"),
    projectType: varchar("project_type", { length: 30 }).notNull(),
    assessmentData: jsonb("assessment_data").notNull().default("[]"),
    overallScore: integer("overall_score"),
    dpiaCriteriaMet: jsonb("dpia_criteria_met").default("[]"),
    dpiaRequired: boolean("dpia_required").notNull().default(false),
    dpiaId: uuid("dpia_id"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    assessedBy: uuid("assessed_by").references(() => user.id),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    improvementActions: jsonb("improvement_actions").default("[]"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pbd_org_idx").on(table.orgId),
    index("pbd_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// consent_type — Consent purpose registry
// ──────────────────────────────────────────────────────────────

export const consentType = pgTable(
  "consent_type",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    purpose: varchar("purpose", { length: 30 }).notNull(),
    description: text("description"),
    collectionPoint: varchar("collection_point", { length: 30 }).notNull(),
    legalRequirements: jsonb("legal_requirements").default("{}"),
    linkedRopaEntryIds: jsonb("linked_ropa_entry_ids").default("[]"),
    freelyGivenStatus: varchar("freely_given_status", { length: 20 }),
    specificStatus: varchar("specific_status", { length: 20 }),
    informedStatus: varchar("informed_status", { length: 20 }),
    unambiguousStatus: varchar("unambiguous_status", { length: 20 }),
    validityNotes: text("validity_notes"),
    validityAssessedBy: uuid("validity_assessed_by").references(
      () => user.id,
    ),
    validityAssessedAt: timestamp("validity_assessed_at", {
      withTimezone: true,
    }),
    totalGiven: integer("total_given").notNull().default(0),
    totalWithdrawn: integer("total_withdrawn").notNull().default(0),
    withdrawalRate: numeric("withdrawal_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    activeConsents: integer("active_consents").notNull().default(0),
    metricsUpdatedAt: timestamp("metrics_updated_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cnsnt_org_idx").on(table.orgId),
    index("ct_purpose_idx").on(table.orgId, table.purpose),
  ],
);

// ──────────────────────────────────────────────────────────────
// consent_record — Individual consent records (pseudonymized)
// ──────────────────────────────────────────────────────────────

export const consentRecord = pgTable(
  "consent_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    consentTypeId: uuid("consent_type_id")
      .notNull()
      .references(() => consentType.id),
    dataSubjectIdentifier: varchar("data_subject_identifier", {
      length: 256,
    }).notNull(),
    consentGivenAt: timestamp("consent_given_at", { withTimezone: true })
      .notNull(),
    consentMechanism: varchar("consent_mechanism", { length: 30 }).notNull(),
    consentTextVersion: varchar("consent_text_version", { length: 50 }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawalMechanism: varchar("withdrawal_mechanism", { length: 30 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    sourceSystem: varchar("source_system", { length: 200 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cr_type_idx").on(table.consentTypeId),
    index("cr_subject_idx").on(table.orgId, table.dataSubjectIdentifier),
    index("cr_given_idx").on(table.consentTypeId, table.consentGivenAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────

export const retentionScheduleRelations = relations(
  retentionSchedule,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [retentionSchedule.orgId],
      references: [organization.id],
    }),
    exceptions: many(retentionException),
  }),
);

export const retentionExceptionRelations = relations(
  retentionException,
  ({ one }) => ({
    schedule: one(retentionSchedule, {
      fields: [retentionException.scheduleId],
      references: [retentionSchedule.id],
    }),
  }),
);

export const deletionRequestRelations = relations(
  deletionRequest,
  ({ one }) => ({
    organization: one(organization, {
      fields: [deletionRequest.orgId],
      references: [organization.id],
    }),
    schedule: one(retentionSchedule, {
      fields: [deletionRequest.scheduleId],
      references: [retentionSchedule.id],
    }),
  }),
);

export const transferImpactAssessmentRelations = relations(
  transferImpactAssessment,
  ({ one }) => ({
    organization: one(organization, {
      fields: [transferImpactAssessment.orgId],
      references: [organization.id],
    }),
  }),
);

export const processorAgreementRelations = relations(
  processorAgreement,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [processorAgreement.orgId],
      references: [organization.id],
    }),
    notifications: many(subProcessorNotification),
  }),
);

export const subProcessorNotificationRelations = relations(
  subProcessorNotification,
  ({ one }) => ({
    agreement: one(processorAgreement, {
      fields: [subProcessorNotification.agreementId],
      references: [processorAgreement.id],
    }),
  }),
);

export const pbdAssessmentRelations = relations(
  pbdAssessment,
  ({ one }) => ({
    organization: one(organization, {
      fields: [pbdAssessment.orgId],
      references: [organization.id],
    }),
  }),
);

export const consentTypeRelations = relations(
  consentType,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [consentType.orgId],
      references: [organization.id],
    }),
    records: many(consentRecord),
  }),
);

export const consentRecordRelations = relations(consentRecord, ({ one }) => ({
  consentType: one(consentType, {
    fields: [consentRecord.consentTypeId],
    references: [consentType.id],
  }),
}));
