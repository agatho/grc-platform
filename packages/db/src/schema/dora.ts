// Sprint 72: DORA Compliance Module
// Tables: dora_ict_risk, dora_tlpt_plan, dora_ict_incident, dora_ict_provider,
//         dora_information_sharing, dora_nis2_cross_ref

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
// 72.1 DORA ICT Risk — ICT Risk Register (Art. 6-16)
// ──────────────────────────────────────────────────────────────

export const doraIctRisk = pgTable(
  "dora_ict_risk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskCode: varchar("risk_code", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    doraArticleRef: varchar("dora_article_ref", { length: 50 }), // e.g. "Art. 6", "Art. 9(2)"
    ictAssetType: varchar("ict_asset_type", { length: 50 }).notNull(), // network | hardware | software | data | cloud_service | third_party
    threatCategory: varchar("threat_category", { length: 100 }), // cyber_attack | system_failure | human_error | natural_disaster | third_party_failure
    vulnerabilityDescription: text("vulnerability_description"),
    likelihood: varchar("likelihood", { length: 20 }).notNull(), // very_low | low | medium | high | very_high
    impact: varchar("impact", { length: 20 }).notNull(), // very_low | low | medium | high | very_high
    riskLevel: varchar("risk_level", { length: 20 }).notNull(), // low | medium | high | critical
    residualRiskLevel: varchar("residual_risk_level", { length: 20 }),
    treatmentStrategy: varchar("treatment_strategy", { length: 20 }), // mitigate | accept | transfer | avoid
    treatmentPlan: text("treatment_plan"),
    existingControls: jsonb("existing_controls").default("[]"), // [{controlId, controlName, effectiveness}]
    affectedServices: jsonb("affected_services").default("[]"), // [{serviceId, serviceName, criticality}]
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
    orgIdx: index("dora_ict_risk_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("dora_ict_risk_code_idx").on(
      table.orgId,
      table.riskCode,
    ),
    levelIdx: index("dora_ict_risk_level_idx").on(table.orgId, table.riskLevel),
    statusIdx: index("dora_ict_risk_status_idx").on(table.orgId, table.status),
    ownerIdx: index("dora_ict_risk_owner_idx").on(table.ownerId),
  }),
);

export const doraIctRiskRelations = relations(doraIctRisk, ({ one }) => ({
  organization: one(organization, {
    fields: [doraIctRisk.orgId],
    references: [organization.id],
  }),
  owner: one(user, {
    fields: [doraIctRisk.ownerId],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 72.2 DORA TLPT Plan — Threat-Led Penetration Testing
// ──────────────────────────────────────────────────────────────

export const doraTlptPlan = pgTable(
  "dora_tlpt_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    planCode: varchar("plan_code", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    testType: varchar("test_type", { length: 50 }).notNull(), // red_team | purple_team | scenario_based | full_tlpt
    scope: text("scope"),
    targetSystems: jsonb("target_systems").default("[]"), // [{systemId, systemName, criticality}]
    threatScenarios: jsonb("threat_scenarios").default("[]"), // [{scenario, threatActor, technique}]
    testProvider: varchar("test_provider", { length: 200 }),
    leaderId: uuid("leader_id").references(() => user.id),
    plannedStartDate: date("planned_start_date"),
    plannedEndDate: date("planned_end_date"),
    actualStartDate: date("actual_start_date"),
    actualEndDate: date("actual_end_date"),
    findings: jsonb("findings").default("[]"), // [{severity, description, recommendation}]
    findingsSummary: text("findings_summary"),
    remediationDeadline: date("remediation_deadline"),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | planned | in_progress | completed | remediation
    regulatoryNotified: boolean("regulatory_notified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("dora_tlpt_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("dora_tlpt_code_idx").on(table.orgId, table.planCode),
    statusIdx: index("dora_tlpt_status_idx").on(table.orgId, table.status),
    dateIdx: index("dora_tlpt_date_idx").on(
      table.orgId,
      table.plannedStartDate,
    ),
  }),
);

export const doraTlptPlanRelations = relations(doraTlptPlan, ({ one }) => ({
  organization: one(organization, {
    fields: [doraTlptPlan.orgId],
    references: [organization.id],
  }),
  leader: one(user, {
    fields: [doraTlptPlan.leaderId],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 72.3 DORA ICT Incident — Incident Classification & Reporting
// ──────────────────────────────────────────────────────────────

export const doraIctIncident = pgTable(
  "dora_ict_incident",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    incidentCode: varchar("incident_code", { length: 30 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description").notNull(),
    incidentType: varchar("incident_type", { length: 50 }).notNull(), // cyber_attack | system_outage | data_breach | third_party_failure | operational_disruption
    classification: varchar("classification", { length: 20 }).notNull(), // major | significant | minor
    affectedServices: jsonb("affected_services").default("[]"),
    affectedClients: integer("affected_clients").default(0),
    financialImpact: numeric("financial_impact", { precision: 15, scale: 2 }),
    geographicScope: text("geographic_scope").array(),
    rootCause: text("root_cause"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    // Reporting Deadlines (4h / 72h / 1M)
    initialReportDue: timestamp("initial_report_due", { withTimezone: true }), // +4h
    initialReportSent: timestamp("initial_report_sent", { withTimezone: true }),
    intermediateReportDue: timestamp("intermediate_report_due", {
      withTimezone: true,
    }), // +72h
    intermediateReportSent: timestamp("intermediate_report_sent", {
      withTimezone: true,
    }),
    finalReportDue: timestamp("final_report_due", { withTimezone: true }), // +1 month
    finalReportSent: timestamp("final_report_sent", { withTimezone: true }),
    reportingAuthority: varchar("reporting_authority", { length: 200 }),
    remediationActions: jsonb("remediation_actions").default("[]"), // [{action, assignee, deadline, status}]
    lessonsLearned: text("lessons_learned"),
    handlerId: uuid("handler_id").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("detected"), // detected | investigating | contained | resolved | closed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("dora_ict_inc_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("dora_ict_inc_code_idx").on(
      table.orgId,
      table.incidentCode,
    ),
    classIdx: index("dora_ict_inc_class_idx").on(
      table.orgId,
      table.classification,
    ),
    statusIdx: index("dora_ict_inc_status_idx").on(table.orgId, table.status),
    detectedIdx: index("dora_ict_inc_detected_idx").on(
      table.orgId,
      table.detectedAt,
    ),
  }),
);

export const doraIctIncidentRelations = relations(
  doraIctIncident,
  ({ one }) => ({
    organization: one(organization, {
      fields: [doraIctIncident.orgId],
      references: [organization.id],
    }),
    handler: one(user, {
      fields: [doraIctIncident.handlerId],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 72.4 DORA ICT Provider — Third-Party Provider Register (Art. 28)
// ──────────────────────────────────────────────────────────────

export const doraIctProvider = pgTable(
  "dora_ict_provider",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    providerCode: varchar("provider_code", { length: 30 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    legalEntity: varchar("legal_entity", { length: 500 }),
    jurisdiction: varchar("jurisdiction", { length: 100 }),
    serviceDescription: text("service_description"),
    serviceType: varchar("service_type", { length: 50 }).notNull(), // cloud | software | infrastructure | network | data_processing | consulting
    criticality: varchar("criticality", { length: 20 }).notNull(), // critical | important | standard
    contractRef: varchar("contract_ref", { length: 200 }),
    contractStartDate: date("contract_start_date"),
    contractEndDate: date("contract_end_date"),
    dataProcessed: jsonb("data_processed").default("[]"), // [{dataCategory, volume, sensitivity}]
    subcontractors: jsonb("subcontractors").default("[]"), // [{name, jurisdiction, service}]
    exitStrategy: text("exit_strategy"),
    riskAssessment: jsonb("risk_assessment").default("{}"), // {riskLevel, concentrationRisk, substitutability}
    lastAuditDate: date("last_audit_date"),
    nextAuditDate: date("next_audit_date"),
    complianceStatus: varchar("compliance_status", { length: 20 })
      .notNull()
      .default("pending"), // compliant | partially_compliant | non_compliant | pending
    ownerId: uuid("owner_id").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | under_review | terminated | pending
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("dora_prov_org_idx").on(table.orgId),
    codeIdx: uniqueIndex("dora_prov_code_idx").on(
      table.orgId,
      table.providerCode,
    ),
    critIdx: index("dora_prov_crit_idx").on(table.orgId, table.criticality),
    statusIdx: index("dora_prov_status_idx").on(table.orgId, table.status),
    complianceIdx: index("dora_prov_compliance_idx").on(
      table.orgId,
      table.complianceStatus,
    ),
  }),
);

export const doraIctProviderRelations = relations(
  doraIctProvider,
  ({ one }) => ({
    organization: one(organization, {
      fields: [doraIctProvider.orgId],
      references: [organization.id],
    }),
    owner: one(user, {
      fields: [doraIctProvider.ownerId],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 72.5 DORA Information Sharing — Art. 45
// ──────────────────────────────────────────────────────────────

export const doraInformationSharing = pgTable(
  "dora_information_sharing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    sharingType: varchar("sharing_type", { length: 50 }).notNull(), // threat_intelligence | vulnerability | incident_info | best_practice
    content: text("content").notNull(),
    classification: varchar("classification", { length: 20 }).notNull(), // tlp_white | tlp_green | tlp_amber | tlp_red
    recipientGroups: jsonb("recipient_groups").default("[]"), // [{groupName, contactEmails}]
    sourceIncidentId: uuid("source_incident_id").references(
      () => doraIctIncident.id,
    ),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    sharedBy: uuid("shared_by").references(() => user.id),
    anonymized: boolean("anonymized").notNull().default(true),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | approved | shared | revoked
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("dora_is_org_idx").on(table.orgId),
    typeIdx: index("dora_is_type_idx").on(table.orgId, table.sharingType),
    statusIdx: index("dora_is_status_idx").on(table.orgId, table.status),
  }),
);

export const doraInformationSharingRelations = relations(
  doraInformationSharing,
  ({ one }) => ({
    organization: one(organization, {
      fields: [doraInformationSharing.orgId],
      references: [organization.id],
    }),
    sourceIncident: one(doraIctIncident, {
      fields: [doraInformationSharing.sourceIncidentId],
      references: [doraIctIncident.id],
    }),
    sharer: one(user, {
      fields: [doraInformationSharing.sharedBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 72.6 DORA NIS2 Cross-Reference
// ──────────────────────────────────────────────────────────────

export const doraNis2CrossRef = pgTable(
  "dora_nis2_cross_ref",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    doraArticle: varchar("dora_article", { length: 50 }).notNull(),
    doraRequirement: text("dora_requirement").notNull(),
    nis2Article: varchar("nis2_article", { length: 50 }),
    nis2Requirement: text("nis2_requirement"),
    overlapType: varchar("overlap_type", { length: 20 }).notNull(), // full_overlap | partial_overlap | dora_only | nis2_only
    complianceStatus: varchar("compliance_status", { length: 20 })
      .notNull()
      .default("not_assessed"), // compliant | partially_compliant | non_compliant | not_assessed
    notes: text("notes"),
    assessedBy: uuid("assessed_by").references(() => user.id),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("dora_nis2_org_idx").on(table.orgId),
    doraIdx: index("dora_nis2_dora_idx").on(table.orgId, table.doraArticle),
    overlapIdx: index("dora_nis2_overlap_idx").on(
      table.orgId,
      table.overlapType,
    ),
    complianceIdx: index("dora_nis2_compliance_idx").on(
      table.orgId,
      table.complianceStatus,
    ),
  }),
);

export const doraNis2CrossRefRelations = relations(
  doraNis2CrossRef,
  ({ one }) => ({
    organization: one(organization, {
      fields: [doraNis2CrossRef.orgId],
      references: [organization.id],
    }),
    assessor: one(user, {
      fields: [doraNis2CrossRef.assessedBy],
      references: [user.id],
    }),
  }),
);
