// Sprint 74: Tax CMS und Financial Compliance
// Tables: tax_cms_element, tax_risk, tax_gobd_archive, tax_icfr_control, tax_audit_prep

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
// 74.1 Tax CMS Element — IDW PS 980 (7 Grundelemente)
// ──────────────────────────────────────────────────────────────

export const taxCmsElement = pgTable(
  "tax_cms_element",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    elementCode: varchar("element_code", { length: 30 }).notNull(),
    elementNumber: integer("element_number").notNull(), // 1-7 (IDW PS 980 elements)
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    // IDW PS 980 elements: 1=Tax CMS Culture, 2=Goals, 3=Risks, 4=Program, 5=Organization, 6=Communication, 7=Monitoring
    elementType: varchar("element_type", { length: 50 }).notNull(), // culture | goals | risks | program | org_structure | communication | monitoring
    requirements: jsonb("requirements").default("[]"), // [{requirementId, description, status, evidence}]
    maturityLevel: integer("maturity_level").default(0), // 0-5
    maturityJustification: text("maturity_justification"),
    responsibleId: uuid("responsible_id").references(() => user.id),
    lastAssessedAt: timestamp("last_assessed_at", { withTimezone: true }),
    nextAssessmentDate: date("next_assessment_date"),
    status: varchar("status", { length: 20 }).notNull().default("not_started"), // not_started | in_progress | implemented | effective | needs_improvement
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("tcms_el_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("tcms_el_code_idx").on(table.orgId, table.elementCode),
    typeIdx: index("tcms_el_type_idx").on(table.orgId, table.elementType),
    statusIdx: index("tcms_el_status_idx").on(table.orgId, table.status),
  }),
);

export const taxCmsElementRelations = relations(taxCmsElement, ({ one }) => ({
  organization: one(organization, {
    fields: [taxCmsElement.orgId],
    references: [organization.id],
  }),
  responsible: one(user, {
    fields: [taxCmsElement.responsibleId],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 74.2 Tax Risk — Tax Risk Register
// ──────────────────────────────────────────────────────────────

export const taxRisk = pgTable(
  "tax_risk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskCode: varchar("risk_code", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    taxType: varchar("tax_type", { length: 50 }).notNull(), // corporate_tax | vat | trade_tax | withholding_tax | transfer_pricing | customs | payroll_tax | real_estate_tax
    riskCategory: varchar("risk_category", { length: 50 }).notNull(), // compliance | reporting | assessment | process | legal_change | interpretation
    jurisdiction: varchar("jurisdiction", { length: 100 }).notNull(),
    affectedEntities: jsonb("affected_entities").default("[]"), // [{entityId, entityName}]
    likelihood: varchar("likelihood", { length: 20 }).notNull(), // very_low | low | medium | high | very_high
    financialExposure: numeric("financial_exposure", { precision: 15, scale: 2 }),
    impact: varchar("impact", { length: 20 }).notNull(), // very_low | low | medium | high | very_high
    riskLevel: varchar("risk_level", { length: 20 }).notNull(), // low | medium | high | critical
    treatmentStrategy: varchar("treatment_strategy", { length: 20 }), // mitigate | accept | transfer | avoid
    treatmentPlan: text("treatment_plan"),
    controls: jsonb("controls").default("[]"), // [{controlId, description, effectiveness}]
    legalBasis: text("legal_basis"), // e.g. "§ 153 AO", "IDW PS 340"
    hgb91Reference: boolean("hgb91_reference").notNull().default(false), // HGB § 91 Abs. 2 relevance
    ownerId: uuid("owner_id").references(() => user.id),
    reviewDate: date("review_date"),
    status: varchar("status", { length: 20 }).notNull().default("identified"), // identified | assessed | treated | accepted | closed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index("tax_risk_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("tax_risk_code_idx").on(table.orgId, table.riskCode),
    typeIdx: index("tax_risk_type_idx").on(table.orgId, table.taxType),
    levelIdx: index("tax_risk_level_idx").on(table.orgId, table.riskLevel),
    statusIdx: index("tax_risk_status_idx").on(table.orgId, table.status),
  }),
);

export const taxRiskRelations = relations(taxRisk, ({ one }) => ({
  organization: one(organization, {
    fields: [taxRisk.orgId],
    references: [organization.id],
  }),
  owner: one(user, {
    fields: [taxRisk.ownerId],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 74.3 Tax GoBD Archive — GoBD-konforme Archivierung
// ──────────────────────────────────────────────────────────────

export const taxGobdArchive = pgTable(
  "tax_gobd_archive",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    archiveCode: varchar("archive_code", { length: 30 }).notNull(),
    documentTitle: varchar("document_title", { length: 500 }).notNull(),
    documentType: varchar("document_type", { length: 50 }).notNull(), // invoice | receipt | contract | correspondence | booking_record | tax_return | assessment_notice
    taxYear: integer("tax_year").notNull(),
    retentionYears: integer("retention_years").notNull().default(10),
    retentionEndDate: date("retention_end_date"),
    storageLocation: varchar("storage_location", { length: 500 }),
    hashValue: varchar("hash_value", { length: 128 }), // SHA-256 for integrity
    originalFormat: varchar("original_format", { length: 50 }),
    fileSize: integer("file_size"),
    gobdCompliant: boolean("gobd_compliant").notNull().default(false),
    complianceChecks: jsonb("compliance_checks").default("{}"), // {immutability, traceability, completeness, availability}
    archivedBy: uuid("archived_by").references(() => user.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | under_review | expired | destroyed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("gobd_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("gobd_code_idx").on(table.orgId, table.archiveCode),
    yearIdx: index("gobd_year_idx").on(table.orgId, table.taxYear),
    typeIdx: index("gobd_type_idx").on(table.orgId, table.documentType),
    retentionIdx: index("gobd_retention_idx").on(table.orgId, table.retentionEndDate),
    statusIdx: index("gobd_status_idx").on(table.orgId, table.status),
  }),
);

export const taxGobdArchiveRelations = relations(taxGobdArchive, ({ one }) => ({
  organization: one(organization, {
    fields: [taxGobdArchive.orgId],
    references: [organization.id],
  }),
  archiver: one(user, {
    fields: [taxGobdArchive.archivedBy],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 74.4 Tax ICFR Control — Internal Controls over Financial Reporting
// ──────────────────────────────────────────────────────────────

export const taxIcfrControl = pgTable(
  "tax_icfr_control",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlCode: varchar("control_code", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    controlType: varchar("control_type", { length: 50 }).notNull(), // preventive | detective | corrective
    processArea: varchar("process_area", { length: 100 }).notNull(), // revenue | procurement | payroll | financial_close | tax_reporting | treasury
    assertion: varchar("assertion", { length: 50 }), // existence | completeness | valuation | rights | presentation
    frequency: varchar("frequency", { length: 20 }).notNull(), // daily | weekly | monthly | quarterly | annually
    automationLevel: varchar("automation_level", { length: 20 }).notNull(), // manual | semi_automated | automated
    keyControl: boolean("key_control").notNull().default(false),
    idwPs340Ref: varchar("idw_ps340_ref", { length: 100 }),
    testProcedure: text("test_procedure"),
    lastTestDate: date("last_test_date"),
    lastTestResult: varchar("last_test_result", { length: 20 }), // effective | partially_effective | not_effective | not_tested
    ownerId: uuid("owner_id").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | inactive | under_review | remediation
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("icfr_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("icfr_code_idx").on(table.orgId, table.controlCode),
    areaIdx: index("icfr_area_idx").on(table.orgId, table.processArea),
    keyIdx: index("icfr_key_idx").on(table.orgId, table.keyControl),
    statusIdx: index("icfr_status_idx").on(table.orgId, table.status),
  }),
);

export const taxIcfrControlRelations = relations(taxIcfrControl, ({ one }) => ({
  organization: one(organization, {
    fields: [taxIcfrControl.orgId],
    references: [organization.id],
  }),
  owner: one(user, {
    fields: [taxIcfrControl.ownerId],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 74.5 Tax Audit Prep — Steuerliche Betriebspruefung Preparation
// ──────────────────────────────────────────────────────────────

export const taxAuditPrep = pgTable(
  "tax_audit_prep",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    prepCode: varchar("prep_code", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    auditType: varchar("audit_type", { length: 50 }).notNull(), // regular | special | follow_up | vat_audit | transfer_pricing
    taxYears: jsonb("tax_years").default("[]"), // [2023, 2024]
    taxTypes: text("tax_types").array(),
    auditAuthority: varchar("audit_authority", { length: 200 }),
    auditorName: varchar("auditor_name", { length: 200 }),
    expectedStartDate: date("expected_start_date"),
    actualStartDate: date("actual_start_date"),
    endDate: date("end_date"),
    documentChecklist: jsonb("document_checklist").default("[]"), // [{document, required, provided, notes}]
    openItems: jsonb("open_items").default("[]"), // [{item, status, assignee, dueDate}]
    findings: jsonb("findings").default("[]"), // [{finding, taxImpact, status}]
    totalExposure: numeric("total_exposure", { precision: 15, scale: 2 }),
    coordinatorId: uuid("coordinator_id").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("preparation"), // preparation | active | fieldwork | closing | completed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("tax_prep_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("tax_prep_code_idx").on(table.orgId, table.prepCode),
    typeIdx: index("tax_prep_type_idx").on(table.orgId, table.auditType),
    statusIdx: index("tax_prep_status_idx").on(table.orgId, table.status),
    dateIdx: index("tax_prep_date_idx").on(table.orgId, table.expectedStartDate),
  }),
);

export const taxAuditPrepRelations = relations(taxAuditPrep, ({ one }) => ({
  organization: one(organization, {
    fields: [taxAuditPrep.orgId],
    references: [organization.id],
  }),
  coordinator: one(user, {
    fields: [taxAuditPrep.coordinatorId],
    references: [user.id],
  }),
}));
