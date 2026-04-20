// Sprint 9: TPRM + Contract Management Schema (Drizzle ORM)
// 11 entities: vendor, vendor_contact, vendor_risk_assessment, vendor_due_diligence,
// vendor_due_diligence_question, contract, contract_obligation, contract_amendment,
// contract_sla, contract_sla_measurement, lksg_assessment

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  numeric,
  char,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { workItem } from "./work-item";
import { document } from "./document";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const vendorStatusEnum = pgEnum("vendor_status", [
  "prospect",
  "onboarding",
  "active",
  "under_review",
  "suspended",
  "terminated",
]);

export const vendorTierEnum = pgEnum("vendor_tier", [
  "critical",
  "important",
  "standard",
  "low_risk",
]);

export const vendorCategoryEnum = pgEnum("vendor_category", [
  "it_services",
  "cloud_provider",
  "consulting",
  "facility",
  "logistics",
  "raw_materials",
  "financial",
  "hr_services",
  "other",
]);

export const ddStatusEnum = pgEnum("dd_status", [
  "pending",
  "in_progress",
  "completed",
  "expired",
]);

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "negotiation",
  "pending_approval",
  "active",
  "renewal",
  "expired",
  "terminated",
  "archived",
]);

export const contractTypeEnum = pgEnum("contract_type", [
  "master_agreement",
  "service_agreement",
  "nda",
  "dpa",
  "sla",
  "license",
  "maintenance",
  "consulting",
  "other",
]);

export const obligationStatusEnum = pgEnum("obligation_status", [
  "pending",
  "in_progress",
  "completed",
  "overdue",
]);

export const obligationTypeEnum = pgEnum("obligation_type", [
  "deliverable",
  "payment",
  "reporting",
  "compliance",
  "audit_right",
]);

// ──────────────────────────────────────────────────────────────
// 9.1 Vendor — Third-party vendor registry
// ──────────────────────────────────────────────────────────────

export const vendor = pgTable(
  "vendor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    name: varchar("name", { length: 500 }).notNull(),
    legalName: varchar("legal_name", { length: 500 }),
    description: text("description"),
    category: vendorCategoryEnum("category").notNull().default("other"),
    tier: vendorTierEnum("tier").notNull().default("standard"),
    status: vendorStatusEnum("status").notNull().default("prospect"),
    country: varchar("country", { length: 100 }),
    address: text("address"),
    website: varchar("website", { length: 500 }),
    taxId: varchar("tax_id", { length: 100 }),
    inherentRiskScore: integer("inherent_risk_score"),
    residualRiskScore: integer("residual_risk_score"),
    lastAssessmentDate: date("last_assessment_date", { mode: "string" }),
    nextAssessmentDate: date("next_assessment_date", { mode: "string" }),
    isLksgRelevant: boolean("is_lksg_relevant").notNull().default(false),
    lksgTier: varchar("lksg_tier", { length: 20 }),
    ownerId: uuid("owner_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("vendor_org_idx").on(table.orgId),
    index("vendor_status_idx").on(table.orgId, table.status),
    index("vendor_tier_idx").on(table.orgId, table.tier),
    index("vendor_owner_idx").on(table.ownerId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 9.2 VendorContact — Contacts at a vendor organization
// ──────────────────────────────────────────────────────────────

export const vendorContact = pgTable(
  "vendor_contact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    role: varchar("role", { length: 255 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("vendor_contact_vendor_idx").on(table.vendorId)],
);

// ──────────────────────────────────────────────────────────────
// 9.3 VendorRiskAssessment — Risk assessment history
// ──────────────────────────────────────────────────────────────

export const vendorRiskAssessment = pgTable(
  "vendor_risk_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    assessmentDate: date("assessment_date", { mode: "string" }).notNull(),
    inherentRiskScore: integer("inherent_risk_score").notNull(),
    residualRiskScore: integer("residual_risk_score").notNull(),
    confidentialityScore: integer("confidentiality_score"),
    integrityScore: integer("integrity_score"),
    availabilityScore: integer("availability_score"),
    complianceScore: integer("compliance_score"),
    financialScore: integer("financial_score"),
    reputationScore: integer("reputation_score"),
    controlsApplied: jsonb("controls_applied").default("[]"),
    riskTrend: varchar("risk_trend", { length: 20 }),
    assessedBy: uuid("assessed_by").references(() => user.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("vra_vendor_idx").on(table.vendorId),
    index("vra_date_idx").on(table.vendorId, table.assessmentDate),
  ],
);

// ──────────────────────────────────────────────────────────────
// 9.4 VendorDueDiligence — External questionnaire submissions
// ──────────────────────────────────────────────────────────────

export const vendorDueDiligence = pgTable(
  "vendor_due_diligence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    questionnaireVersion: varchar("questionnaire_version", { length: 50 }),
    status: ddStatusEnum("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    accessToken: varchar("access_token", { length: 255 }),
    responses: jsonb("responses").default("{}"),
    riskScore: integer("risk_score"),
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
    index("vdd_vendor_idx").on(table.vendorId),
    uniqueIndex("vdd_access_token_idx").on(table.accessToken),
  ],
);

// ──────────────────────────────────────────────────────────────
// 9.5 VendorDueDiligenceQuestion — Template questions for DD
// ──────────────────────────────────────────────────────────────

export const vendorDueDiligenceQuestion = pgTable(
  "vendor_due_diligence_question",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    category: varchar("category", { length: 100 }).notNull(),
    questionText: text("question_text").notNull(),
    answerType: varchar("answer_type", { length: 50 })
      .notNull()
      .default("text"),
    riskWeighting: numeric("risk_weighting", {
      precision: 5,
      scale: 2,
    }).default("1.00"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("vddq_org_category_idx").on(table.orgId, table.category)],
);

// ──────────────────────────────────────────────────────────────
// 9.6 Contract — Contract registry linked to vendors
// ──────────────────────────────────────────────────────────────

export const contract = pgTable(
  "contract",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    workItemId: uuid("work_item_id").references(() => workItem.id),
    vendorId: uuid("vendor_id").references(() => vendor.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    contractType: contractTypeEnum("contract_type")
      .notNull()
      .default("service_agreement"),
    status: contractStatusEnum("status").notNull().default("draft"),
    contractNumber: varchar("contract_number", { length: 100 }),
    effectiveDate: date("effective_date", { mode: "string" }),
    expirationDate: date("expiration_date", { mode: "string" }),
    noticePeriodDays: integer("notice_period_days").default(90),
    autoRenewal: boolean("auto_renewal").notNull().default(false),
    renewalPeriodMonths: integer("renewal_period_months"),
    totalValue: numeric("total_value", { precision: 15, scale: 2 }),
    currency: char("currency", { length: 3 }).default("EUR"),
    annualValue: numeric("annual_value", { precision: 15, scale: 2 }),
    paymentTerms: varchar("payment_terms", { length: 255 }),
    documentId: uuid("document_id").references(() => document.id),
    ownerId: uuid("owner_id").references(() => user.id),
    approverId: uuid("approver_id").references(() => user.id),
    signedDate: date("signed_date", { mode: "string" }),
    signedBy: uuid("signed_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("contract_vendor_idx").on(table.vendorId),
    index("contract_status_idx").on(table.orgId, table.status),
    index("contract_expiry_idx").on(table.expirationDate),
    index("contract_owner_idx").on(table.ownerId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 9.7 ContractObligation — Contractual obligations tracking
// ──────────────────────────────────────────────────────────────

export const contractObligation = pgTable(
  "contract_obligation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    obligationType: obligationTypeEnum("obligation_type").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    recurring: boolean("recurring").notNull().default(false),
    recurringIntervalMonths: integer("recurring_interval_months"),
    status: obligationStatusEnum("status").notNull().default("pending"),
    responsibleId: uuid("responsible_id").references(() => user.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("obligation_contract_idx").on(table.contractId),
    index("obligation_status_idx").on(table.orgId, table.status),
    index("obligation_due_idx").on(table.dueDate),
  ],
);

// ──────────────────────────────────────────────────────────────
// 9.8 ContractAmendment — Contract amendments / change orders
// ──────────────────────────────────────────────────────────────

export const contractAmendment = pgTable(
  "contract_amendment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    effectiveDate: date("effective_date", { mode: "string" }),
    documentId: uuid("document_id").references(() => document.id),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("amendment_contract_idx").on(table.contractId)],
);

// ──────────────────────────────────────────────────────────────
// 9.9 ContractSla — SLA definitions for contracts
// ──────────────────────────────────────────────────────────────

export const contractSla = pgTable(
  "contract_sla",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    metricName: varchar("metric_name", { length: 255 }).notNull(),
    targetValue: numeric("target_value", { precision: 10, scale: 4 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    measurementFrequency: varchar("measurement_frequency", {
      length: 20,
    }).notNull(),
    penaltyClause: text("penalty_clause"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sla_contract_idx").on(table.contractId)],
);

// ──────────────────────────────────────────────────────────────
// 9.10 ContractSlaMeasurement — SLA measurement records
// ──────────────────────────────────────────────────────────────

export const contractSlaMeasurement = pgTable(
  "contract_sla_measurement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slaId: uuid("sla_id")
      .notNull()
      .references(() => contractSla.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    actualValue: numeric("actual_value", { precision: 10, scale: 4 }).notNull(),
    isBreach: boolean("is_breach").notNull().default(false),
    notes: text("notes"),
    measuredBy: uuid("measured_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sla_measurement_sla_idx").on(table.slaId),
    index("sla_measurement_period_idx").on(table.slaId, table.periodStart),
  ],
);

// ──────────────────────────────────────────────────────────────
// 9.11 LksgAssessment — LkSG (Supply Chain Due Diligence Act)
// ──────────────────────────────────────────────────────────────

export const lksgAssessment = pgTable(
  "lksg_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    assessmentDate: date("assessment_date", { mode: "string" }).notNull(),
    lksgTier: varchar("lksg_tier", { length: 20 }).notNull(),
    riskAreas: jsonb("risk_areas").default("[]"),
    mitigationPlans: jsonb("mitigation_plans").default("[]"),
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    overallRiskLevel: varchar("overall_risk_level", { length: 20 }),
    assessedBy: uuid("assessed_by").references(() => user.id),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    nextReviewDate: date("next_review_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lksg_vendor_idx").on(table.vendorId),
    index("lksg_org_status_idx").on(table.orgId, table.status),
  ],
);
