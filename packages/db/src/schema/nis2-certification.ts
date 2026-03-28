// Sprint 24: NIS2 Compliance Tracker + Certification Readiness Schema (Drizzle ORM)
// Tables: certification_readiness_snapshot, nis2_incident_report

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";
import { securityIncident } from "./isms";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const nis2ReportTypeEnum = pgEnum("nis2_report_type", [
  "early_warning",
  "full_notification",
  "intermediate_report",
  "final_report",
]);

export const nis2ReportStatusEnum = pgEnum("nis2_report_status", [
  "draft",
  "submitted",
  "acknowledged",
  "rejected",
]);

// ──────────────────────────────────────────────────────────────
// 24.1 CertificationReadinessSnapshot — Immutable periodic score
// ──────────────────────────────────────────────────────────────

export const certificationReadinessSnapshot = pgTable(
  "certification_readiness_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    framework: varchar("framework", { length: 100 }).notNull(),
    score: integer("score").notNull(),
    checksJson: jsonb("checks_json").notNull(),
    gapCount: integer("gap_count").notNull().default(0),
    passedCount: integer("passed_count").notNull().default(0),
    totalChecks: integer("total_checks").notNull().default(0),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    index("crs_org_idx").on(t.orgId),
    index("crs_framework_idx").on(t.orgId, t.framework),
    index("crs_created_idx").on(t.orgId, t.createdAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 24.2 NIS2IncidentReport — Art. 23 Meldepflichten
//      Links to existing security_incident (Sprint 5a)
// ──────────────────────────────────────────────────────────────

export const nis2IncidentReport = pgTable(
  "nis2_incident_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => securityIncident.id, { onDelete: "cascade" }),
    reportType: nis2ReportTypeEnum("report_type").notNull(),
    status: nis2ReportStatusEnum("status").notNull().default("draft"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    bsiReference: varchar("bsi_reference", { length: 200 }),
    reportContent: text("report_content"),
    contactPerson: varchar("contact_person", { length: 500 }),
    contactEmail: varchar("contact_email", { length: 500 }),
    contactPhone: varchar("contact_phone", { length: 100 }),
    affectedServicesDescription: text("affected_services_description"),
    crossBorderImpact: text("cross_border_impact"),
    estimatedImpactCount: integer("estimated_impact_count"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    index("nir_org_idx").on(t.orgId),
    index("nir_incident_idx").on(t.incidentId),
    index("nir_type_idx").on(t.orgId, t.reportType),
    index("nir_status_idx").on(t.orgId, t.status),
    index("nir_deadline_idx").on(t.orgId, t.deadlineAt),
  ],
);
