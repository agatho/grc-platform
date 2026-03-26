// Sprint 5a: ISMS Module Schema (Drizzle ORM)
// Entities: asset_classification, threat, vulnerability, risk_scenario,
//           security_incident, incident_timeline_entry, process_asset

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
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";
import { asset } from "./asset";
import { risk } from "./risk";
import { workItem } from "./work-item";
import { riskCatalogEntry } from "./catalog";
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
    catalogEntryId: uuid("catalog_entry_id").references(
      () => riskCatalogEntry.id,
    ),
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
