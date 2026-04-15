// Sprint 45: ESG Advanced — Double Materiality, Carbon Calculator,
// ESRS Templates, Data Collection, Supply Chain ESG

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
// 45.1 materiality_assessment — CSRD double materiality
// ──────────────────────────────────────────────────────────────

export const materialityAssessment = pgTable(
  "materiality_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    reportingPeriodYear: integer("reporting_period_year").notNull(),
    status: varchar("status", { length: 30 })
      .notNull()
      .default("draft"),
    financialThreshold: jsonb("financial_threshold").default("{}"),
    impactThreshold: jsonb("impact_threshold").default("{}"),
    finalizedBy: uuid("finalized_by").references(() => user.id),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ma_org_idx").on(table.orgId),
    index("ma_year_idx").on(table.orgId, table.reportingPeriodYear),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.2 materiality_iro — IRO entries with dual materiality scores
// ──────────────────────────────────────────────────────────────

export const materialityIro = pgTable(
  "materiality_iro",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => materialityAssessment.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    esrsTopic: varchar("esrs_topic", { length: 10 }).notNull(),
    iroType: varchar("iro_type", { length: 20 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    affectedStakeholders: text("affected_stakeholders").array().default([]),
    valueChainStage: varchar("value_chain_stage", { length: 30 }),
    timeHorizon: varchar("time_horizon", { length: 20 }),
    financialMagnitude: varchar("financial_magnitude", { length: 20 }),
    financialLikelihood: varchar("financial_likelihood", { length: 20 }),
    impactScale: varchar("impact_scale", { length: 20 }),
    impactScope: varchar("impact_scope", { length: 20 }),
    impactIrremediable: varchar("impact_irremediable", { length: 30 }),
    isPositiveImpact: boolean("is_positive_impact").default(false),
    financialMaterialityScore: integer("financial_materiality_score"),
    impactMaterialityScore: integer("impact_materiality_score"),
    isMaterial: boolean("is_material"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("miro_assessment_idx").on(table.assessmentId),
    index("miro_topic_idx").on(table.assessmentId, table.esrsTopic),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.3 materiality_stakeholder_engagement
// ──────────────────────────────────────────────────────────────

export const materialityStakeholderEngagement = pgTable(
  "materiality_stakeholder_engagement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => materialityAssessment.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    stakeholderGroup: varchar("stakeholder_group", { length: 30 }).notNull(),
    engagementMethod: varchar("engagement_method", { length: 30 }).notNull(),
    keyConcerns: text("key_concerns"),
    participantCount: integer("participant_count"),
    engagementDate: date("engagement_date", { mode: "string" }),
    linkedIroIds: uuid("linked_iro_ids").array().default([]),
    evidenceDocumentId: uuid("evidence_document_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("mse_assessment_idx").on(table.assessmentId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.4 emission_source — Emission source registry
// ──────────────────────────────────────────────────────────────

export const emissionSource = pgTable(
  "emission_source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    scope: integer("scope").notNull(),
    scope3Category: integer("scope3_category"),
    sourceName: varchar("source_name", { length: 500 }).notNull(),
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    fuelType: varchar("fuel_type", { length: 100 }),
    facilityName: varchar("facility_name", { length: 200 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("emis_org_idx").on(table.orgId),
    index("es_scope_idx").on(table.orgId, table.scope),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.5 emission_activity_data — Activity data with auto-CO2e
// ──────────────────────────────────────────────────────────────

export const emissionActivityData = pgTable(
  "emission_activity_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => emissionSource.id),
    orgId: uuid("org_id").notNull(),
    reportingPeriodStart: date("reporting_period_start", {
      mode: "string",
    }).notNull(),
    reportingPeriodEnd: date("reporting_period_end", {
      mode: "string",
    }).notNull(),
    quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    dataQuality: varchar("data_quality", { length: 20 }).notNull(),
    evidenceReference: text("evidence_reference"),
    emissionFactorId: uuid("emission_factor_id"),
    computedCo2eTonnes: numeric("computed_co2e_tonnes", {
      precision: 15,
      scale: 4,
    }),
    computationMethod: varchar("computation_method", { length: 20 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ead_source_idx").on(table.sourceId),
    index("ead_org_period_idx").on(
      table.orgId,
      table.reportingPeriodStart,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.6 emission_factor — Global + custom factor library
// ──────────────────────────────────────────────────────────────

export const emissionFactor = pgTable(
  "emission_factor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    factorSource: varchar("factor_source", { length: 30 }).notNull(),
    activityType: varchar("activity_type", { length: 100 }).notNull(),
    fuelType: varchar("fuel_type", { length: 100 }),
    unit: varchar("unit", { length: 50 }).notNull(),
    co2eFactor: numeric("co2e_factor", { precision: 15, scale: 8 }).notNull(),
    co2Factor: numeric("co2_factor", { precision: 15, scale: 8 }),
    ch4Factor: numeric("ch4_factor", { precision: 15, scale: 8 }),
    n2oFactor: numeric("n2o_factor", { precision: 15, scale: 8 }),
    validYear: integer("valid_year").notNull(),
    country: varchar("country", { length: 5 }),
    isCustom: boolean("is_custom").notNull().default(false),
    orgId: uuid("org_id"),
  },
  (table) => [
    index("ef_lookup_idx").on(table.activityType, table.fuelType, table.validYear),
    index("ef_source_idx").on(table.factorSource),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.7 esg_collection_campaign — Collection campaign definitions
// ──────────────────────────────────────────────────────────────

export const esgCollectionCampaign = pgTable(
  "esg_collection_campaign",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    reportingPeriodStart: date("reporting_period_start", {
      mode: "string",
    }).notNull(),
    reportingPeriodEnd: date("reporting_period_end", {
      mode: "string",
    }).notNull(),
    deadline: date("deadline", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    templateId: uuid("template_id"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ecc_org_idx").on(table.orgId),
    index("ecc_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.8 esg_collection_assignment — Per-metric assignments
// ──────────────────────────────────────────────────────────────

export const esgCollectionAssignment = pgTable(
  "esg_collection_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => esgCollectionCampaign.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    metricId: uuid("metric_id").notNull(),
    assigneeId: uuid("assignee_id")
      .notNull()
      .references(() => user.id),
    reviewerId: uuid("reviewer_id").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    submittedValue: numeric("submitted_value", { precision: 20, scale: 4 }),
    submittedUnit: varchar("submitted_unit", { length: 50 }),
    submittedEvidence: text("submitted_evidence"),
    submittedNotes: text("submitted_notes"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    previousPeriodValue: numeric("previous_period_value", {
      precision: 20,
      scale: 4,
    }),
    validationWarnings: jsonb("validation_warnings").default("[]"),
    validationErrors: jsonb("validation_errors").default("[]"),
  },
  (table) => [
    index("eca_campaign_idx").on(table.campaignId),
    index("eca_assignee_idx").on(table.assigneeId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.9 supplier_esg_assessment — Supplier ESG questionnaire
// ──────────────────────────────────────────────────────────────

export const supplierEsgAssessment = pgTable(
  "supplier_esg_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id),
    assessmentDate: date("assessment_date", { mode: "string" }).notNull(),
    questionnaireVersion: integer("questionnaire_version").default(1),
    environmentalScore: integer("environmental_score"),
    socialScore: integer("social_score"),
    governanceScore: integer("governance_score"),
    overallScore: integer("overall_score"),
    riskClassification: varchar("risk_classification", { length: 20 }),
    industryRiskFactor: numeric("industry_risk_factor", {
      precision: 3,
      scale: 1,
    }),
    geographicRiskFactor: numeric("geographic_risk_factor", {
      precision: 3,
      scale: 1,
    }),
    responses: jsonb("responses").default("{}"),
    assessedBy: uuid("assessed_by").references(() => user.id),
    nextAssessmentDate: date("next_assessment_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sea_org_idx").on(table.orgId),
    index("sea_vendor_idx").on(table.vendorId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.10 supplier_esg_corrective_action
// ──────────────────────────────────────────────────────────────

export const supplierEsgCorrectiveAction = pgTable(
  "supplier_esg_corrective_action",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => supplierEsgAssessment.id),
    orgId: uuid("org_id").notNull(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id),
    finding: text("finding").notNull(),
    correctiveAction: text("corrective_action").notNull(),
    responsibleId: uuid("responsible_id").references(() => user.id),
    deadline: date("deadline", { mode: "string" }),
    followUpDate: date("follow_up_date", { mode: "string" }),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    verificationNotes: text("verification_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("seca_assessment_idx").on(table.assessmentId),
    index("seca_vendor_idx").on(table.vendorId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.11 lksg_due_diligence — LkSG documentation per supplier
// ──────────────────────────────────────────────────────────────

export const lksgDueDiligence = pgTable(
  "lksg_due_diligence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id),
    reportingYear: integer("reporting_year").notNull(),
    riskAnalysisStatus: varchar("risk_analysis_status", {
      length: 20,
    })
      .notNull()
      .default("not_started"),
    riskAnalysisDocumentId: uuid("risk_analysis_document_id"),
    preventiveMeasures: text("preventive_measures"),
    remedialMeasures: text("remedial_measures"),
    complaintsProcedureStatus: varchar("complaints_procedure_status", {
      length: 20,
    }),
    documentationStatus: varchar("documentation_status", {
      length: 20,
    })
      .notNull()
      .default("incomplete"),
    overallCompliance: varchar("overall_compliance", { length: 30 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ldd_org_idx").on(table.orgId),
    uniqueIndex("ldd_vendor_year_idx").on(
      table.vendorId,
      table.reportingYear,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 45.12 esrs_disclosure_template — Pre-structured ESRS templates
// ──────────────────────────────────────────────────────────────

export const esrsDisclosureTemplate = pgTable(
  "esrs_disclosure_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    standard: varchar("standard", { length: 10 }).notNull(),
    disclosureRequirement: varchar("disclosure_requirement", {
      length: 20,
    }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    requiredDataPoints: jsonb("required_data_points").default("[]"),
    content: text("content"),
    autoPopulatedValues: jsonb("auto_populated_values").default("{}"),
    status: varchar("status", { length: 20 }).notNull().default("not_started"),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("edt_org_idx").on(table.orgId),
    index("edt_standard_idx").on(table.orgId, table.standard),
  ],
);

// ──────────────────────────────────────────────────────────────
// TCFD Climate Risk Scenarios — Physical + Transition Risks
// ──────────────────────────────────────────────────────────────

export const climateRiskScenario = pgTable(
  "climate_risk_scenario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),

    // Scenario classification
    scenarioType: varchar("scenario_type", { length: 30 })
      .notNull(), // 'physical' | 'transition'
    riskCategory: varchar("risk_category", { length: 50 })
      .notNull(), // physical: acute/chronic; transition: policy/technology/market/reputation
    temperaturePathway: varchar("temperature_pathway", { length: 10 })
      .notNull(), // '1.5', '2.0', '3.0', '4.0'
    timeHorizon: varchar("time_horizon", { length: 20 })
      .notNull(), // 'short' (<2030), 'medium' (2030-2040), 'long' (2040-2050+)

    // Impact assessment
    likelihoodScore: integer("likelihood_score"), // 1-5
    impactScore: integer("impact_score"), // 1-5
    financialImpactMin: numeric("financial_impact_min", {
      precision: 15,
      scale: 2,
    }),
    financialImpactMax: numeric("financial_impact_max", {
      precision: 15,
      scale: 2,
    }),
    financialImpactCurrency: varchar("financial_impact_currency", {
      length: 3,
    }).default("EUR"),

    // Affected areas
    affectedAssets: text("affected_assets"), // description of affected assets/locations
    affectedBusinessLines: jsonb("affected_business_lines").default("[]"),
    geographicScope: varchar("geographic_scope", { length: 200 }),

    // Mitigation
    adaptationMeasures: text("adaptation_measures"),
    mitigationStrategy: text("mitigation_strategy"),
    residualRiskScore: integer("residual_risk_score"), // 1-5

    // TCFD alignment
    tcfdCategory: varchar("tcfd_category", { length: 50 }), // governance/strategy/risk_management/metrics_targets
    esrsDisclosure: varchar("esrs_disclosure", { length: 20 }), // e.g. E1-9, ESRS 2 IRO-1
    sbtiRelevance: boolean("sbti_relevance").default(false),

    // Status & ERM bridge
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    ermRiskId: uuid("erm_risk_id"), // FK to risk table for ERM sync
    ermSyncedAt: timestamp("erm_synced_at", { withTimezone: true }),

    // Audit
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("crs_org_idx").on(table.orgId),
    index("crs_type_idx").on(table.orgId, table.scenarioType),
    index("crs_pathway_idx").on(table.orgId, table.temperaturePathway),
  ],
);
