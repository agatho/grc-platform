// EU AI Act -- Extended Tables (ADR-014 Phase 3)
//
// Erweitert ai-act.ts um Authority-Kommunikation, Corrective-Actions,
// GPAI-Modelle, Incidents, Penalties, Prohibited-Screening und QMS.
// Migration-Quellen: drizzle/0085_ai_act_complete.sql + _full_compliance.sql

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { aiSystem } from "./ai-act";

export const aiGpaiModel = pgTable("ai_gpai_model", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  name: varchar("name", { length: 500 }).notNull(),
  provider: varchar("provider", { length: 500 }).notNull(),
  modelType: varchar("model_type", { length: 50 })
    .default("general_purpose")
    .notNull(),
  systemicRiskJustification: text("systemic_risk_justification"),
  trainingDataSummary: text("training_data_summary"),
  computationalResources: text("computational_resources"),
  energyConsumptionKwh: numeric("energy_consumption_kwh"),
  adversarialTestingResults: jsonb("adversarial_testing_results").default({}),
  incidentReportingEnabled: boolean("incident_reporting_enabled")
    .default(false)
    .notNull(),
  cybersecurityMeasures: text("cybersecurity_measures"),
  euRepresentativeContact: varchar("eu_representative_contact", {
    length: 500,
  }),
  codeOfPracticeNotes: text("code_of_practice_notes"),
  releaseDate: date("release_date"),
  status: varchar("status", { length: 50 }).default("registered").notNull(),
  capabilitiesSummary: text("capabilities_summary"),
  limitationsSummary: text("limitations_summary"),
  intendedUse: text("intended_use"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
  updatedBy: uuid("updated_by").references(() => user.id),
});

export const aiIncident = pgTable("ai_incident", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  aiSystemId: uuid("ai_system_id").references(() => aiSystem.id),
  gpaiModelId: uuid("gpai_model_id").references(() => aiGpaiModel.id),
  incidentCode: varchar("incident_code", { length: 50 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 50 }).default("medium").notNull(),
  isSerious: boolean("is_serious").default(false).notNull(),
  seriousCriteria: jsonb("serious_criteria").default([]),
  detectedAt: timestamp("detected_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  authorityDeadline: timestamp("authority_deadline", { withTimezone: true }),
  authorityNotifiedAt: timestamp("authority_notified_at", {
    withTimezone: true,
  }),
  authorityReference: varchar("authority_reference", { length: 200 }),
  affectedPersonsCount: integer("affected_persons_count"),
  harmType: varchar("harm_type", { length: 100 }),
  harmDescription: text("harm_description"),
  rootCause: text("root_cause"),
  rootCauseCategory: varchar("root_cause_category", { length: 100 }),
  remediationActions: text("remediation_actions"),
  preventiveMeasures: text("preventive_measures"),
  status: varchar("status", { length: 50 }).default("detected").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  lessonsLearned: text("lessons_learned"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const aiCorrectiveAction = pgTable("ai_corrective_action", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  aiSystemId: uuid("ai_system_id").references(() => aiSystem.id),
  sourceType: varchar("source_type", { length: 50 })
    .default("non_conformity")
    .notNull(),
  sourceId: uuid("source_id"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  nonConformityDescription: text("non_conformity_description"),
  actionType: varchar("action_type", { length: 50 })
    .default("corrective")
    .notNull(),
  isRecall: boolean("is_recall").default(false).notNull(),
  isWithdrawal: boolean("is_withdrawal").default(false).notNull(),
  recallReason: text("recall_reason"),
  priority: varchar("priority", { length: 50 }).default("medium").notNull(),
  assignedTo: uuid("assigned_to").references(() => user.id),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  authorityNotified: boolean("authority_notified").default(false).notNull(),
  authorityNotifiedAt: timestamp("authority_notified_at", {
    withTimezone: true,
  }),
  authorityReference: varchar("authority_reference", { length: 200 }),
  verificationRequired: boolean("verification_required")
    .default(true)
    .notNull(),
  verifiedBy: uuid("verified_by").references(() => user.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationNotes: text("verification_notes"),
  status: varchar("status", { length: 50 }).default("open").notNull(),
  effectivenessRating: varchar("effectiveness_rating", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const aiAuthorityCommunication = pgTable("ai_authority_communication", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  aiSystemId: uuid("ai_system_id").references(() => aiSystem.id),
  authorityName: varchar("authority_name", { length: 500 }).notNull(),
  authorityCountry: varchar("authority_country", { length: 10 }),
  communicationType: varchar("communication_type", { length: 50 })
    .default("notification")
    .notNull(),
  direction: varchar("direction", { length: 20 }).default("outgoing").notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  content: text("content"),
  referenceNumber: varchar("reference_number", { length: 200 }),
  relatedIncidentId: uuid("related_incident_id").references(
    () => aiIncident.id,
  ),
  relatedActionId: uuid("related_action_id").references(
    () => aiCorrectiveAction.id,
  ),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  responseDeadline: timestamp("response_deadline", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const aiPenalty = pgTable("ai_penalty", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  aiSystemId: uuid("ai_system_id").references(() => aiSystem.id),
  authorityName: varchar("authority_name", { length: 500 }).notNull(),
  penaltyType: varchar("penalty_type", { length: 50 })
    .default("fine")
    .notNull(),
  articleReference: varchar("article_reference", { length: 100 }),
  fineAmount: numeric("fine_amount"),
  fineCurrency: varchar("fine_currency", { length: 10 }).default("EUR"),
  finePercentageTurnover: numeric("fine_percentage_turnover"),
  penaltyBracket: varchar("penalty_bracket", { length: 50 }),
  status: varchar("status", { length: 50 }).default("imposed").notNull(),
  appealFiled: boolean("appeal_filed").default(false),
  appealStatus: varchar("appeal_status", { length: 50 }),
  appealDeadline: date("appeal_deadline"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  description: text("description"),
  violationDescription: text("violation_description"),
  // DB-Default: CURRENT_DATE. Drizzle-Migrations koennen das nicht
  // auto-emitten, setzen wir im Code beim Insert.
  imposedAt: date("imposed_at").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const aiProhibitedScreening = pgTable("ai_prohibited_screening", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  aiSystemId: uuid("ai_system_id")
    .notNull()
    .references(() => aiSystem.id),
  screeningDate: timestamp("screening_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  screenedBy: uuid("screened_by").references(() => user.id),
  subliminalManipulation: boolean("subliminal_manipulation")
    .default(false)
    .notNull(),
  exploitationVulnerable: boolean("exploitation_vulnerable")
    .default(false)
    .notNull(),
  socialScoring: boolean("social_scoring").default(false).notNull(),
  predictivePolicingIndividual: boolean("predictive_policing_individual")
    .default(false)
    .notNull(),
  facialRecognitionScraping: boolean("facial_recognition_scraping")
    .default(false)
    .notNull(),
  emotionInferenceWorkplace: boolean("emotion_inference_workplace")
    .default(false)
    .notNull(),
  biometricCategorization: boolean("biometric_categorization")
    .default(false)
    .notNull(),
  realTimeBiometricPublic: boolean("real_time_biometric_public")
    .default(false)
    .notNull(),
  // DB-Spalte ist GENERATED ALWAYS AS (OR der 8 Booleans) STORED. Drizzle
  // kann sie nicht schreiben -- beim INSERT weglassen, beim SELECT lesen.
  hasProhibitedPractice: boolean("has_prohibited_practice"),
  justification: text("justification"),
  exceptionApplied: boolean("exception_applied").default(false),
  exceptionJustification: text("exception_justification"),
  status: varchar("status", { length: 50 }).default("completed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const aiProviderQms = pgTable("ai_provider_qms", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  aiSystemId: uuid("ai_system_id").references(() => aiSystem.id),
  riskManagementProcedure: boolean("risk_management_procedure")
    .default(false)
    .notNull(),
  dataGovernanceProcedure: boolean("data_governance_procedure")
    .default(false)
    .notNull(),
  technicalDocumentationProcedure: boolean("technical_documentation_procedure")
    .default(false)
    .notNull(),
  recordKeepingProcedure: boolean("record_keeping_procedure")
    .default(false)
    .notNull(),
  transparencyProcedure: boolean("transparency_procedure")
    .default(false)
    .notNull(),
  humanOversightProcedure: boolean("human_oversight_procedure")
    .default(false)
    .notNull(),
  accuracyRobustnessProcedure: boolean("accuracy_robustness_procedure")
    .default(false)
    .notNull(),
  cybersecurityProcedure: boolean("cybersecurity_procedure")
    .default(false)
    .notNull(),
  incidentReportingProcedure: boolean("incident_reporting_procedure")
    .default(false)
    .notNull(),
  thirdPartyManagementProcedure: boolean("third_party_management_procedure")
    .default(false)
    .notNull(),
  overallMaturity: integer("overall_maturity").default(0),
  lastAuditDate: date("last_audit_date"),
  nextAuditDate: date("next_audit_date"),
  status: varchar("status", { length: 50 }).default("draft").notNull(),
  responsibleId: uuid("responsible_id").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
