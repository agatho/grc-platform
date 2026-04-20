// Approval, Review, Attestation (ADR-014 Phase 3)
//
// Generic Workflow-Engines fuer:
// - approval_workflow / approval_request / approval_decision -- formal
//   n-step Approval mit sequential/parallel/unanimous-Logik
// - review_cycle / review_decision -- leichtere Review-Runden mit
//   Eskalation nach X Tagen
// - attestation_campaign / attestation_response -- Policy-Attestation-
//   Kampagnen pro Rolle/User
//
// Migration-Quellen: 0079_round2_features.sql, 0080_round3_features.sql

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ─────────── Approval ───────────

export const approvalWorkflow = pgTable("approval_workflow", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // sequential | parallel | unanimous | quorum
  workflowType: varchar("workflow_type", { length: 50 })
    .default("sequential")
    .notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  // Array<{ role: string; userId?: string; approvers?: string[] }>
  steps: jsonb("steps").default([]).notNull(),
  isTemplate: boolean("is_template").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const approvalRequest = pgTable("approval_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  workflowId: uuid("workflow_id").references(() => approvalWorkflow.id),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  currentStep: integer("current_step").default(0).notNull(),
  // pending | approved | rejected | cancelled | expired
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => user.id),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  dueDate: date("due_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const approvalDecision = pgTable("approval_decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => approvalRequest.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  approverId: uuid("approver_id")
    .notNull()
    .references(() => user.id),
  // approved | rejected | delegated | abstained
  decision: varchar("decision", { length: 20 }).notNull(),
  comment: text("comment"),
  decidedAt: timestamp("decided_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  delegatedFrom: uuid("delegated_from").references(() => user.id),
});

// ─────────── Review ───────────

export const reviewCycle = pgTable("review_cycle", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  // Array<{ userId: string; order: number }>
  reviewers: jsonb("reviewers").default([]).notNull(),
  currentReviewerIndex: integer("current_reviewer_index").default(0),
  // pending | in_progress | completed | escalated | cancelled
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  escalationDays: integer("escalation_days").default(5),
  escalationTo: uuid("escalation_to").references(() => user.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  dueDate: date("due_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => user.id),
});

export const reviewDecision = pgTable("review_decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id")
    .notNull()
    .references(() => reviewCycle.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id")
    .notNull()
    .references(() => user.id),
  // approved | rejected | abstained | request_changes
  decision: varchar("decision", { length: 20 }).notNull(),
  comment: text("comment"),
  decidedAt: timestamp("decided_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────── Attestation ───────────

export const attestationCampaign = pgTable("attestation_campaign", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // policy | training | rights_recertification | access_review
  campaignType: varchar("campaign_type", { length: 30 })
    .default("policy")
    .notNull(),
  targetRole: varchar("target_role", { length: 50 }),
  dueDate: date("due_date").notNull(),
  // draft | active | completed | cancelled
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const attestationResponse = pgTable("attestation_response", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => attestationCampaign.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  policyId: uuid("policy_id"),
  // pending | acknowledged | declined | expired
  response: varchar("response", { length: 20 }).default("pending").notNull(),
  comment: text("comment"),
  attestedAt: timestamp("attested_at", { withTimezone: true }),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
