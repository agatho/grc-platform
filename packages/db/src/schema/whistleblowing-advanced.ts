// Sprint 46: Whistleblowing Advanced — Investigation Workflow,
// Protection Tracking, Multi-Channel, Routing, Ombudsperson Portal

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { wbCase } from "./whistleblowing";

// ──────────────────────────────────────────────────────────────
// 46.1 wb_investigation — Investigation lifecycle per case
// ──────────────────────────────────────────────────────────────

export const wbInvestigation = pgTable(
  "wb_investigation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => wbCase.id),
    phase: varchar("phase", { length: 20 }).notNull().default("intake"),
    priority: varchar("priority", { length: 20 }).notNull().default("medium"),
    assignedInvestigatorId: uuid("assigned_investigator_id").references(
      () => user.id,
    ),
    assignedTeamId: uuid("assigned_team_id"),
    triageDate: timestamp("triage_date", { withTimezone: true }),
    investigationStart: timestamp("investigation_start", {
      withTimezone: true,
    }),
    decisionDate: timestamp("decision_date", { withTimezone: true }),
    resolutionDate: timestamp("resolution_date", { withTimezone: true }),
    closedDate: timestamp("closed_date", { withTimezone: true }),
    decisionOutcome: varchar("decision_outcome", { length: 30 }),
    recommendedActions: text("recommended_actions"),
    finalReportDocumentId: uuid("final_report_document_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("wbi_org_idx").on(table.orgId),
    index("wbi_case_idx").on(table.caseId),
    index("wbi_phase_idx").on(table.orgId, table.phase),
    index("wbi_investigator_idx").on(table.assignedInvestigatorId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 46.2 wb_evidence — Secure evidence (NO DELETE)
// ──────────────────────────────────────────────────────────────

export const wbEvidence = pgTable(
  "wb_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => wbInvestigation.id),
    orgId: uuid("org_id").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    fileUrl: varchar("file_url", { length: 2000 }),
    fileType: varchar("file_type", { length: 50 }),
    fileSizeBytes: integer("file_size_bytes"),
    sourceType: varchar("source_type", { length: 30 }).notNull(),
    tags: text("tags").array().default([]),
    uploadedBy: uuid("uploaded_by").references(() => user.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    accessedLog: jsonb("accessed_log").default("[]"),
    isSuperseded: boolean("is_superseded").notNull().default(false),
    supersededBy: uuid("superseded_by"),
  },
  (table) => [
    index("wbe_investigation_idx").on(table.investigationId),
    index("wbe_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 46.3 wb_interview — Interview documentation
// ──────────────────────────────────────────────────────────────

export const wbInterview = pgTable(
  "wb_interview",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => wbInvestigation.id),
    orgId: uuid("org_id").notNull(),
    intervieweeReference: varchar("interviewee_reference", { length: 200 }),
    interviewerId: uuid("interviewer_id").references(() => user.id),
    interviewDate: date("interview_date", { mode: "string" }).notNull(),
    questionsAsked: text("questions_asked"),
    responses: text("responses"),
    observations: text("observations"),
    consentDocumented: boolean("consent_documented").default(false),
    recordingReference: varchar("recording_reference", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("wbint_investigation_idx").on(table.investigationId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 46.4 wb_investigation_log — IMMUTABLE activity timeline
// ──────────────────────────────────────────────────────────────

export const wbInvestigationLog = pgTable(
  "wb_investigation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => wbInvestigation.id),
    activityType: varchar("activity_type", { length: 30 }).notNull(),
    description: text("description"),
    performedBy: uuid("performed_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("wbil_investigation_idx").on(table.investigationId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 46.5 wb_protection_case — Reporter protection monitoring
// ──────────────────────────────────────────────────────────────

export const wbProtectionCase = pgTable(
  "wb_protection_case",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => wbCase.id),
    reporterReference: varchar("reporter_reference", { length: 200 }),
    reporterUserId: uuid("reporter_user_id"),
    protectionStartDate: date("protection_start_date", {
      mode: "string",
    }).notNull(),
    protectionStatus: varchar("protection_status", { length: 20 })
      .notNull()
      .default("active"),
    monitoringFrequency: varchar("monitoring_frequency", { length: 20 })
      .notNull()
      .default("monthly"),
    nextReviewDate: date("next_review_date", { mode: "string" }),
    concludedAt: timestamp("concluded_at", { withTimezone: true }),
    conclusionReason: text("conclusion_reason"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("wbpc_org_idx").on(table.orgId),
    index("wbpc_case_idx").on(table.caseId),
    index("wbpc_status_idx").on(table.orgId, table.protectionStatus),
  ],
);

// ──────────────────────────────────────────────────────────────
// 46.6 wb_protection_event — Employment change tracking
// ──────────────────────────────────────────────────────────────

export const wbProtectionEvent = pgTable(
  "wb_protection_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    protectionCaseId: uuid("protection_case_id")
      .notNull()
      .references(() => wbProtectionCase.id),
    orgId: uuid("org_id").notNull(),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    description: text("description"),
    flag: varchar("flag", { length: 20 }).notNull().default("normal"),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("wbpe_case_idx").on(table.protectionCaseId),
    index("wbpe_flag_idx").on(table.orgId, table.flag),
  ],
);

// ──────────────────────────────────────────────────────────────
// 46.7 wb_ombudsperson_assignment — Case assignment to external
// ──────────────────────────────────────────────────────────────

export const wbOmbudspersonAssignment = pgTable(
  "wb_ombudsperson_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    ombudspersonUserId: uuid("ombudsperson_user_id")
      .notNull()
      .references(() => user.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => wbCase.id),
    scope: varchar("scope", { length: 30 }).notNull(),
    assignedBy: uuid("assigned_by").references(() => user.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("wboa_ombudsperson_idx").on(table.ombudspersonUserId),
    index("wboa_case_idx").on(table.caseId),
    index("wboa_expiry_idx").on(table.expiresAt, table.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 46.8 wb_ombudsperson_activity — IMMUTABLE activity log
// ──────────────────────────────────────────────────────────────

export const wbOmbudspersonActivity = pgTable(
  "wb_ombudsperson_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    ombudspersonUserId: uuid("ombudsperson_user_id").notNull(),
    action: varchar("action", { length: 30 }).notNull(),
    caseId: uuid("case_id"),
    detail: jsonb("detail").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);
