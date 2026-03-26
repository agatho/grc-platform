// Sprint 7: Data Protection Management System (DPMS) Schema (Drizzle ORM)
// 12 tables: ropaEntry, ropaDataCategory, ropaDataSubject, ropaRecipient,
// dpia, dpiaRisk, dpiaMeasure, dsr, dsrActivity,
// dataBreach, dataBreachNotification, tia

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
  index,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { workItem } from "./work-item";
import { securityIncident } from "./isms";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const ropaLegalBasisEnum = pgEnum("ropa_legal_basis", [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interest",
  "public_interest",
  "legitimate_interest",
]);

export const ropaStatusEnum = pgEnum("ropa_status", [
  "draft",
  "active",
  "under_review",
  "archived",
]);

export const dpiaStatusEnum = pgEnum("dpia_status", [
  "draft",
  "in_progress",
  "completed",
  "pending_dpo_review",
  "approved",
  "rejected",
]);

export const dsrTypeEnum = pgEnum("dsr_type", [
  "access",
  "erasure",
  "restriction",
  "portability",
  "objection",
]);

export const dsrStatusEnum = pgEnum("dsr_status", [
  "received",
  "verified",
  "processing",
  "response_sent",
  "closed",
  "rejected",
]);

export const breachSeverityEnum = pgEnum("breach_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const breachStatusEnum = pgEnum("breach_status", [
  "detected",
  "assessing",
  "notifying_dpa",
  "notifying_individuals",
  "remediation",
  "closed",
]);

export const tiaLegalBasisEnum = pgEnum("tia_legal_basis", [
  "adequacy",
  "sccs",
  "bcrs",
  "derogation",
]);

export const tiaRiskRatingEnum = pgEnum("tia_risk_rating", [
  "low",
  "medium",
  "high",
]);

// ──────────────────────────────────────────────────────────────
// 7.1 RopaEntry — Record of Processing Activities (Art. 30)
// ──────────────────────────────────────────────────────────────

export const ropaEntry = pgTable(
  "ropa_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    title: varchar("title", { length: 500 }).notNull(),
    purpose: text("purpose").notNull(),
    legalBasis: ropaLegalBasisEnum("legal_basis").notNull(),
    legalBasisDetail: text("legal_basis_detail"),
    controllerOrgId: uuid("controller_org_id").references(
      () => organization.id,
    ),
    processorName: varchar("processor_name", { length: 500 }),
    processingDescription: text("processing_description"),
    retentionPeriod: varchar("retention_period", { length: 255 }),
    retentionJustification: text("retention_justification"),
    technicalMeasures: text("technical_measures"),
    organizationalMeasures: text("organizational_measures"),
    internationalTransfer: boolean("international_transfer")
      .notNull()
      .default(false),
    transferCountry: varchar("transfer_country", { length: 100 }),
    transferSafeguard: varchar("transfer_safeguard", { length: 100 }),
    status: ropaStatusEnum("status").notNull().default("draft"),
    lastReviewed: timestamp("last_reviewed", { withTimezone: true }),
    nextReviewDate: date("next_review_date", { mode: "string" }),
    responsibleId: uuid("responsible_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("ropa_org_idx").on(t.orgId),
    index("ropa_status_idx").on(t.orgId, t.status),
    index("ropa_responsible_idx").on(t.responsibleId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.2 RopaDataCategory — Data categories per ROPA entry
// ──────────────────────────────────────────────────────────────

export const ropaDataCategory = pgTable(
  "ropa_data_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    ropaEntryId: uuid("ropa_entry_id")
      .notNull()
      .references(() => ropaEntry.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rdc_org_idx").on(t.orgId),
    index("rdc_ropa_idx").on(t.ropaEntryId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.3 RopaDataSubject — Data subject categories per ROPA entry
// ──────────────────────────────────────────────────────────────

export const ropaDataSubject = pgTable(
  "ropa_data_subject",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    ropaEntryId: uuid("ropa_entry_id")
      .notNull()
      .references(() => ropaEntry.id, { onDelete: "cascade" }),
    subjectCategory: varchar("subject_category", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rds_org_idx").on(t.orgId),
    index("rds_ropa_idx").on(t.ropaEntryId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.4 RopaRecipient — Data recipients per ROPA entry
// ──────────────────────────────────────────────────────────────

export const ropaRecipient = pgTable(
  "ropa_recipient",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    ropaEntryId: uuid("ropa_entry_id")
      .notNull()
      .references(() => ropaEntry.id, { onDelete: "cascade" }),
    recipientName: varchar("recipient_name", { length: 500 }).notNull(),
    recipientType: varchar("recipient_type", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rr_org_idx").on(t.orgId),
    index("rr_ropa_idx").on(t.ropaEntryId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.5 DPIA — Data Protection Impact Assessment (Art. 35)
// ──────────────────────────────────────────────────────────────

export const dpia = pgTable(
  "dpia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    title: varchar("title", { length: 500 }).notNull(),
    processingDescription: text("processing_description"),
    legalBasis: ropaLegalBasisEnum("legal_basis"),
    necessityAssessment: text("necessity_assessment"),
    dpoConsultationRequired: boolean("dpo_consultation_required")
      .notNull()
      .default(false),
    status: dpiaStatusEnum("status").notNull().default("draft"),
    residualRiskSignOffId: uuid("residual_risk_sign_off_id").references(
      () => user.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("dpia_org_idx").on(t.orgId),
    index("dpia_status_idx").on(t.orgId, t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.6 DpiaRisk — Identified risks within a DPIA
// ──────────────────────────────────────────────────────────────

export const dpiaRisk = pgTable(
  "dpia_risk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    dpiaId: uuid("dpia_id")
      .notNull()
      .references(() => dpia.id, { onDelete: "cascade" }),
    riskDescription: text("risk_description").notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    likelihood: varchar("likelihood", { length: 20 })
      .notNull()
      .default("medium"),
    impact: varchar("impact", { length: 20 }).notNull().default("medium"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("dpia_risk_org_idx").on(t.orgId),
    index("dpia_risk_dpia_idx").on(t.dpiaId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.7 DpiaMeasure — Mitigation measures within a DPIA
// ──────────────────────────────────────────────────────────────

export const dpiaMeasure = pgTable(
  "dpia_measure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    dpiaId: uuid("dpia_id")
      .notNull()
      .references(() => dpia.id, { onDelete: "cascade" }),
    measureDescription: text("measure_description").notNull(),
    implementationTimeline: varchar("implementation_timeline", {
      length: 255,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("dpia_measure_org_idx").on(t.orgId),
    index("dpia_measure_dpia_idx").on(t.dpiaId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.8 DSR — Data Subject Request (GDPR Art. 15-21)
// ──────────────────────────────────────────────────────────────

export const dsr = pgTable(
  "dsr",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    requestType: dsrTypeEnum("request_type").notNull(),
    status: dsrStatusEnum("status").notNull().default("received"),
    subjectName: varchar("subject_name", { length: 255 }),
    subjectEmail: varchar("subject_email", { length: 255 }),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    handlerId: uuid("handler_id").references(() => user.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    index("dsr_org_idx").on(t.orgId),
    index("dsr_status_idx").on(t.orgId, t.status),
    index("dsr_handler_idx").on(t.handlerId),
    index("dsr_deadline_idx").on(t.orgId, t.deadline),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.9 DsrActivity — Activity log within a DSR
// ──────────────────────────────────────────────────────────────

export const dsrActivity = pgTable(
  "dsr_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    dsrId: uuid("dsr_id")
      .notNull()
      .references(() => dsr.id, { onDelete: "cascade" }),
    activityType: varchar("activity_type", { length: 100 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    details: text("details"),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    index("dsr_act_org_idx").on(t.orgId),
    index("dsr_act_dsr_idx").on(t.dsrId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.10 DataBreach — Personal data breach (Art. 33/34)
// ──────────────────────────────────────────────────────────────

export const dataBreach = pgTable(
  "data_breach",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    incidentId: uuid("incident_id").references(() => securityIncident.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    severity: breachSeverityEnum("severity").notNull().default("medium"),
    status: breachStatusEnum("status").notNull().default("detected"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    dpaNotifiedAt: timestamp("dpa_notified_at", { withTimezone: true }),
    individualsNotifiedAt: timestamp("individuals_notified_at", {
      withTimezone: true,
    }),
    isDpaNotificationRequired: boolean("is_dpa_notification_required")
      .notNull()
      .default(true),
    isIndividualNotificationRequired: boolean(
      "is_individual_notification_required",
    )
      .notNull()
      .default(false),
    dataCategoriesAffected: text("data_categories_affected").array(),
    estimatedRecordsAffected: integer("estimated_records_affected"),
    affectedCountries: text("affected_countries").array(),
    containmentMeasures: text("containment_measures"),
    remediationMeasures: text("remediation_measures"),
    lessonsLearned: text("lessons_learned"),
    dpoId: uuid("dpo_id").references(() => user.id),
    assigneeId: uuid("assignee_id").references(() => user.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("db_org_idx").on(t.orgId),
    index("db_status_idx").on(t.orgId, t.status),
    index("db_severity_idx").on(t.orgId, t.severity),
    index("db_incident_idx").on(t.incidentId),
    index("db_dpo_idx").on(t.dpoId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.11 DataBreachNotification — Notification tracking per breach
// ──────────────────────────────────────────────────────────────

export const dataBreachNotification = pgTable(
  "data_breach_notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    dataBreachId: uuid("data_breach_id")
      .notNull()
      .references(() => dataBreach.id, { onDelete: "cascade" }),
    recipientType: varchar("recipient_type", { length: 100 }).notNull(),
    recipientEmail: varchar("recipient_email", { length: 255 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    responseStatus: varchar("response_status", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("dbn_org_idx").on(t.orgId),
    index("dbn_breach_idx").on(t.dataBreachId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 7.12 TIA — Transfer Impact Assessment (Schrems II)
// ──────────────────────────────────────────────────────────────

export const tia = pgTable(
  "tia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    title: varchar("title", { length: 500 }).notNull(),
    transferCountry: varchar("transfer_country", { length: 100 }).notNull(),
    legalBasis: tiaLegalBasisEnum("legal_basis").notNull(),
    schremsIiAssessment: text("schrems_ii_assessment"),
    riskRating: tiaRiskRatingEnum("risk_rating").notNull().default("medium"),
    supportingDocuments: text("supporting_documents"),
    responsibleId: uuid("responsible_id").references(() => user.id),
    assessmentDate: date("assessment_date", { mode: "string" }),
    nextReviewDate: date("next_review_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("tia_org_idx").on(t.orgId),
    index("tia_country_idx").on(t.orgId, t.transferCountry),
    index("tia_risk_idx").on(t.orgId, t.riskRating),
  ],
);
