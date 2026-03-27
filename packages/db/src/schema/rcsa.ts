// Sprint 14: Risk & Control Self-Assessment (RCSA) Schema (Drizzle ORM)
// 4 entities: rcsaCampaign, rcsaAssignment, rcsaResponse, rcsaResult

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { risk } from "./risk";
import { control } from "./control";

// ──────────────────────────────────────────────────────────────
// 14.1 RCSA Campaign — Campaign definition (scope, period, frequency)
// ──────────────────────────────────────────────────────────────

export const rcsaCampaign = pgTable(
  "rcsa_campaign",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    periodStart: varchar("period_start", { length: 10 }).notNull(), // YYYY-MM-DD
    periodEnd: varchar("period_end", { length: 10 }).notNull(), // YYYY-MM-DD
    frequency: varchar("frequency", { length: 20 }).notNull(), // quarterly|semi_annual|annual
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft|active|closed|archived
    targetScope: jsonb("target_scope").notNull(), // { departments: [], orgIds: [], roles: [] }
    questionSetId: uuid("question_set_id"), // optional custom question set
    reminderDaysBefore: integer("reminder_days_before").default(7),
    cesWeight: integer("ces_weight").default(15), // % weight in CES calculation
    createdBy: uuid("created_by").references(() => user.id),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rc_org_idx").on(table.orgId),
    index("rc_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 14.2 RCSA Assignment — Assignment per user per entity
// ──────────────────────────────────────────────────────────────

export const rcsaAssignment = pgTable(
  "rcsa_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => rcsaCampaign.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    entityType: varchar("entity_type", { length: 20 }).notNull(), // risk|control
    entityId: uuid("entity_id").notNull(), // FK to risk or control
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending|in_progress|submitted|overdue
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    remindersSent: integer("reminders_sent").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ra_campaign_idx").on(table.campaignId),
    index("ra_user_idx").on(table.userId, table.status),
    index("ra_entity_idx").on(table.entityType, table.entityId),
    uniqueIndex("ra_unique_idx").on(
      table.campaignId,
      table.userId,
      table.entityType,
      table.entityId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 14.3 RCSA Response — Split fields for risk vs control
// ──────────────────────────────────────────────────────────────

export const rcsaResponse = pgTable(
  "rcsa_response",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => rcsaAssignment.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    // Risk assessment fields (when entity_type = 'risk')
    riskStillRelevant: boolean("risk_still_relevant"),
    likelihoodAssessment: integer("likelihood_assessment"), // 1-5
    impactAssessment: integer("impact_assessment"), // 1-5
    riskTrend: varchar("risk_trend", { length: 15 }), // increasing|stable|decreasing
    // Control assessment fields (when entity_type = 'control')
    controlEffectiveness: varchar("control_effectiveness", { length: 20 }), // effective|partially_effective|ineffective
    controlOperating: boolean("control_operating"), // Is the control actually operating?
    controlWeaknesses: text("control_weaknesses"),
    // Common fields
    comment: text("comment"),
    evidenceIds: jsonb("evidence_ids").default([]), // links to document uploads
    confidence: integer("confidence"), // 1-5 self-assessed confidence level
    respondedAt: timestamp("responded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rr_assignment_idx").on(table.assignmentId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 14.4 RCSA Result — Aggregated results per campaign
// ──────────────────────────────────────────────────────────────

export const rcsaResult = pgTable(
  "rcsa_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => rcsaCampaign.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    // Aggregation
    totalAssignments: integer("total_assignments").notNull(),
    completedCount: integer("completed_count").notNull(),
    completionRate: numeric("completion_rate", { precision: 5, scale: 2 }).notNull(),
    // Risk results
    avgLikelihood: numeric("avg_likelihood", { precision: 3, scale: 2 }),
    avgImpact: numeric("avg_impact", { precision: 3, scale: 2 }),
    risksIncreasing: integer("risks_increasing").default(0),
    risksStable: integer("risks_stable").default(0),
    risksDecreasing: integer("risks_decreasing").default(0),
    // Control results
    controlsEffective: integer("controls_effective").default(0),
    controlsPartial: integer("controls_partial").default(0),
    controlsIneffective: integer("controls_ineffective").default(0),
    // Discrepancy analysis
    discrepancyCount: integer("discrepancy_count").default(0),
    discrepancies: jsonb("discrepancies").default([]), // [{ entityType, entityId, rcsaRating, auditRating, type }]
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("rr_campaign_uniq_idx").on(table.campaignId),
  ],
);

// ──────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────

export const rcsaCampaignRelations = relations(rcsaCampaign, ({ one, many }) => ({
  organization: one(organization, {
    fields: [rcsaCampaign.orgId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [rcsaCampaign.createdBy],
    references: [user.id],
  }),
  assignments: many(rcsaAssignment),
  result: one(rcsaResult, {
    fields: [rcsaCampaign.id],
    references: [rcsaResult.campaignId],
  }),
}));

export const rcsaAssignmentRelations = relations(rcsaAssignment, ({ one, many }) => ({
  campaign: one(rcsaCampaign, {
    fields: [rcsaAssignment.campaignId],
    references: [rcsaCampaign.id],
  }),
  user: one(user, {
    fields: [rcsaAssignment.userId],
    references: [user.id],
  }),
  responses: many(rcsaResponse),
}));

export const rcsaResponseRelations = relations(rcsaResponse, ({ one }) => ({
  assignment: one(rcsaAssignment, {
    fields: [rcsaResponse.assignmentId],
    references: [rcsaAssignment.id],
  }),
}));

export const rcsaResultRelations = relations(rcsaResult, ({ one }) => ({
  campaign: one(rcsaCampaign, {
    fields: [rcsaResult.campaignId],
    references: [rcsaCampaign.id],
  }),
}));
