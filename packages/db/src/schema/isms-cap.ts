// ISMS Corrective Action Plan (CAP) (ADR-014 Phase 3)
//
// Umsetzt ISO 27001 Clause 10 (Improvement):
// - 10.1 Nonconformity and corrective action -- isms_nonconformity +
//   isms_corrective_action
// - 10.2 Continual improvement -- via Metadaten in CAP-Status-Trail
//
// Ergaenzt isms.ts um die konkreten CAP-Tabellen. Das generische
// root_cause_analysis kann auch in anderen Kontexten (Incidents ohne
// direkten NC-Bezug) genutzt werden.
//
// Migration: 0079_round2_features.sql, 0086_isms_corrective_actions.sql

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

export const ismsNonconformity = pgTable("isms_nonconformity", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  // Identifikation
  ncCode: varchar("nc_code", { length: 30 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  // internal_audit | management_review | incident | assessment |
  // external_audit | complaint
  sourceType: varchar("source_type", { length: 50 }).default("internal_audit").notNull(),
  sourceId: uuid("source_id"),
  sourceReference: varchar("source_reference", { length: 200 }),
  // minor | major | observation
  severity: varchar("severity", { length: 20 }).default("minor").notNull(),
  category: varchar("category", { length: 100 }),
  isoClause: varchar("iso_clause", { length: 50 }),
  // Zeitschiene
  identifiedAt: timestamp("identified_at", { withTimezone: true }).defaultNow().notNull(),
  dueDate: date("due_date"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  // Zuweisung
  identifiedBy: uuid("identified_by").references(() => user.id),
  assignedTo: uuid("assigned_to").references(() => user.id),
  // Root-Cause (optional — kann auch ueber root_cause_analysis verlinkt werden)
  rootCause: text("root_cause"),
  // 5_why | fishbone | pareto | fault_tree
  rootCauseMethod: varchar("root_cause_method", { length: 50 }),
  // open | analysis | action_planned | in_progress | verification |
  // closed | reopened
  status: varchar("status", { length: 30 }).default("open").notNull(),
  // DB-Typ: TEXT[] -- jsonb erspart einen weiteren Drizzle-Import
  tags: jsonb("tags").default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ismsCorrectiveAction = pgTable("isms_corrective_action", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  nonconformityId: uuid("nonconformity_id").notNull().references(() => ismsNonconformity.id, { onDelete: "cascade" }),
  // Aktion
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  // corrective | preventive | containment
  actionType: varchar("action_type", { length: 50 }).default("corrective").notNull(),
  assignedTo: uuid("assigned_to").references(() => user.id),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // Verifikation (ISO 27001 10.1 e)
  verificationRequired: boolean("verification_required").default(true).notNull(),
  verifiedBy: uuid("verified_by").references(() => user.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  // effective | not_effective | partial | pending
  verificationResult: varchar("verification_result", { length: 50 }),
  verificationNotes: text("verification_notes"),
  // Effectiveness (ISO 27001 10.1 f)
  effectivenessReviewDate: date("effectiveness_review_date"),
  effectivenessRating: varchar("effectiveness_rating", { length: 50 }),
  effectivenessNotes: text("effectiveness_notes"),
  // planned | in_progress | completed | verified | closed | failed
  status: varchar("status", { length: 30 }).default("planned").notNull(),
  tags: jsonb("tags").default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rootCauseAnalysis = pgTable("root_cause_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  findingId: uuid("finding_id"),
  incidentId: uuid("incident_id"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  // 5_why | fishbone | pareto | fault_tree | ishikawa
  methodology: varchar("methodology", { length: 50 }).default("5_why").notNull(),
  rootCauses: jsonb("root_causes").default([]).notNull(),
  contributingFactors: jsonb("contributing_factors").default([]),
  correctiveActions: jsonb("corrective_actions").default([]),
  preventiveActions: jsonb("preventive_actions").default([]),
  status: varchar("status", { length: 20 }).default("open").notNull(),
  ownerId: uuid("owner_id").references(() => user.id),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});
