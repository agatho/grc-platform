// Sprint 39: ERM Advanced — Bow-Tie, Treatment Tracking, Interconnections,
// Emerging Risks, Risk Events

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
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { risk } from "./risk";
import { control } from "./control";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const bowtieElementTypeEnum = pgEnum("bowtie_element_type", [
  "cause",
  "consequence",
  "barrier",
]);

// ──────────────────────────────────────────────────────────────
// bowtie_element — Causes, consequences, and barriers for a risk
// ──────────────────────────────────────────────────────────────

export const bowtieElement = pgTable(
  "bowtie_element",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    type: bowtieElementTypeEnum("type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    controlId: uuid("control_id").references(() => control.id),
    effectiveness: varchar("effectiveness", { length: 20 }),
    likelihood: integer("likelihood"),
    impact: integer("impact"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("be_risk_idx").on(table.riskId),
    index("be_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// bowtie_path — Paths from cause→risk→consequence with barriers
// ──────────────────────────────────────────────────────────────

export const bowtiePath = pgTable(
  "bowtie_path",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    sourceElementId: uuid("source_element_id")
      .notNull()
      .references(() => bowtieElement.id, { onDelete: "cascade" }),
    targetElementId: uuid("target_element_id")
      .notNull()
      .references(() => bowtieElement.id, { onDelete: "cascade" }),
    barrierIds: jsonb("barrier_ids").default("[]"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("bp_risk_idx").on(table.riskId)],
);

// ──────────────────────────────────────────────────────────────
// treatment_milestone — Tracking milestones for risk treatments
// ──────────────────────────────────────────────────────────────

export const treatmentMilestone = pgTable(
  "treatment_milestone",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treatmentId: uuid("treatment_id").notNull(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    deadline: date("deadline").notNull(),
    responsibleId: uuid("responsible_id").references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("planned"),
    percentComplete: integer("percent_complete").notNull().default(0),
    plannedEffortHours: numeric("planned_effort_hours", {
      precision: 8,
      scale: 2,
    }),
    actualEffortHours: numeric("actual_effort_hours", {
      precision: 8,
      scale: 2,
    }),
    dependsOnMilestoneId: uuid("depends_on_milestone_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tm_treatment_idx").on(table.treatmentId),
    index("tm_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// risk_interconnection — Connections between risks
// ──────────────────────────────────────────────────────────────

export const riskInterconnection = pgTable(
  "risk_interconnection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceRiskId: uuid("source_risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    targetRiskId: uuid("target_risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    correlationType: varchar("correlation_type", { length: 30 }).notNull(),
    strength: varchar("strength", { length: 20 }).notNull(),
    direction: varchar("direction", { length: 20 })
      .notNull()
      .default("unidirectional"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ri_unique_idx").on(table.sourceRiskId, table.targetRiskId),
    index("ri_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// emerging_risk — Emerging risk radar
// ──────────────────────────────────────────────────────────────

export const emergingRisk = pgTable(
  "emerging_risk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 50 }).notNull(),
    timeHorizon: varchar("time_horizon", { length: 10 }).notNull(),
    potentialImpact: varchar("potential_impact", { length: 20 }).notNull(),
    probabilityTrend: varchar("probability_trend", { length: 20 }).notNull(),
    monitoringTriggers: text("monitoring_triggers"),
    responsibleId: uuid("responsible_id").references(() => user.id),
    nextReviewDate: date("next_review_date"),
    status: varchar("status", { length: 20 }).notNull().default("monitoring"),
    promotedToRiskId: uuid("promoted_to_risk_id").references(() => risk.id),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("erev_org_idx").on(table.orgId),
    index("erev_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// risk_event — Materialized risks and near-misses
// ──────────────────────────────────────────────────────────────

export const riskEvent = pgTable(
  "risk_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id").references(() => risk.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    eventDate: date("event_date").notNull(),
    eventType: varchar("event_type", { length: 20 }).notNull(),
    actualImpactEur: numeric("actual_impact_eur", {
      precision: 15,
      scale: 2,
    }),
    actualImpactQualitative: varchar("actual_impact_qualitative", {
      length: 20,
    }),
    affectedEntities: jsonb("affected_entities").default("[]"),
    rootCause: text("root_cause"),
    responseActions: text("response_actions"),
    durationDays: integer("duration_days"),
    category: varchar("category", { length: 50 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rev_org_idx").on(table.orgId),
    index("rev_risk_idx").on(table.riskId),
    index("rev_date_idx").on(table.orgId, table.eventDate),
  ],
);

// ──────────────────────────────────────────────────────────────
// risk_event_lesson — Lessons learned from risk events
// ──────────────────────────────────────────────────────────────

export const riskEventLesson = pgTable(
  "risk_event_lesson",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => riskEvent.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    lesson: text("lesson").notNull(),
    category: varchar("category", { length: 50 }),
    linkedRiskIds: jsonb("linked_risk_ids").default("[]"),
    linkedControlIds: jsonb("linked_control_ids").default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rel_event_idx").on(table.eventId),
    index("rel_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// bowtie_template — Pre-built bow-tie templates (seed data)
// ──────────────────────────────────────────────────────────────

export const bowtieTemplate = pgTable("bowtie_template", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: jsonb("name").notNull(),
  description: jsonb("description").notNull(),
  riskCategory: varchar("risk_category", { length: 50 }).notNull(),
  templateData: jsonb("template_data").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// ──────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────

export const bowtieElementRelations = relations(
  bowtieElement,
  ({ one }) => ({
    organization: one(organization, {
      fields: [bowtieElement.orgId],
      references: [organization.id],
    }),
    risk: one(risk, {
      fields: [bowtieElement.riskId],
      references: [risk.id],
    }),
    control: one(control, {
      fields: [bowtieElement.controlId],
      references: [control.id],
    }),
  }),
);

export const treatmentMilestoneRelations = relations(
  treatmentMilestone,
  ({ one }) => ({
    organization: one(organization, {
      fields: [treatmentMilestone.orgId],
      references: [organization.id],
    }),
    responsible: one(user, {
      fields: [treatmentMilestone.responsibleId],
      references: [user.id],
    }),
  }),
);

export const riskInterconnectionRelations = relations(
  riskInterconnection,
  ({ one }) => ({
    organization: one(organization, {
      fields: [riskInterconnection.orgId],
      references: [organization.id],
    }),
  }),
);

export const emergingRiskRelations = relations(emergingRisk, ({ one }) => ({
  organization: one(organization, {
    fields: [emergingRisk.orgId],
    references: [organization.id],
  }),
  responsible: one(user, {
    fields: [emergingRisk.responsibleId],
    references: [user.id],
  }),
  promotedRisk: one(risk, {
    fields: [emergingRisk.promotedToRiskId],
    references: [risk.id],
  }),
}));

export const riskEventRelations = relations(riskEvent, ({ one, many }) => ({
  organization: one(organization, {
    fields: [riskEvent.orgId],
    references: [organization.id],
  }),
  risk: one(risk, {
    fields: [riskEvent.riskId],
    references: [risk.id],
  }),
  lessons: many(riskEventLesson),
}));

export const riskEventLessonRelations = relations(
  riskEventLesson,
  ({ one }) => ({
    event: one(riskEvent, {
      fields: [riskEventLesson.eventId],
      references: [riskEvent.id],
    }),
  }),
);
