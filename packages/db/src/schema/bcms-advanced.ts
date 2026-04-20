// Sprint 41: BCMS Advanced — Crisis Communication, Exercise Management,
// Recovery Procedures, Resilience Score

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
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { task } from "./task";
import { bcExercise } from "./bcms";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const bcExerciseTypeEnum = pgEnum("bc_exercise_type", [
  "tabletop",
  "walkthrough",
  "functional",
  "full_scale",
]);

// ──────────────────────────────────────────────────────────────
// crisis_contact_tree — Per-crisis-type notification tree
// ──────────────────────────────────────────────────────────────

export const crisisContactTree = pgTable(
  "crisis_contact_tree",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    crisisType: varchar("crisis_type", { length: 30 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReviewAt: date("next_review_at"),
    reviewCycleMonths: integer("review_cycle_months").default(6),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cct_org_idx").on(table.orgId),
    index("cct_type_idx").on(table.orgId, table.crisisType),
  ],
);

// ──────────────────────────────────────────────────────────────
// crisis_contact_node — Hierarchical contact tree nodes
// ──────────────────────────────────────────────────────────────

export const crisisContactNode = pgTable(
  "crisis_contact_node",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => crisisContactTree.id, { onDelete: "cascade" }),
    parentNodeId: uuid("parent_node_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    userId: uuid("user_id").references(() => user.id),
    roleTitle: varchar("role_title", { length: 200 }).notNull(),
    name: varchar("name", { length: 300 }),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),
    escalationMinutes: integer("escalation_minutes").notNull().default(15),
    deputyUserId: uuid("deputy_user_id").references(() => user.id),
    deputyName: varchar("deputy_name", { length: 300 }),
    deputyPhone: varchar("deputy_phone", { length: 50 }),
    deputyEmail: varchar("deputy_email", { length: 255 }),
  },
  (table) => [
    index("ccn_tree_idx").on(table.treeId),
    index("ccn_parent_idx").on(table.parentNodeId),
  ],
);

// ──────────────────────────────────────────────────────────────
// crisis_communication_log — IMMUTABLE communication log
// ──────────────────────────────────────────────────────────────

export const crisisCommunicationLog = pgTable(
  "crisis_communication_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    crisisId: uuid("crisis_id").notNull(),
    treeId: uuid("tree_id").references(() => crisisContactTree.id),
    nodeId: uuid("node_id").references(() => crisisContactNode.id),
    channel: varchar("channel", { length: 20 }).notNull(),
    messageTemplateKey: varchar("message_template_key", { length: 100 }),
    messageContent: text("message_content").notNull(),
    recipientName: varchar("recipient_name", { length: 300 }),
    recipientContact: varchar("recipient_contact", { length: 255 }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    escalatedToNodeId: uuid("escalated_to_node_id").references(
      () => crisisContactNode.id,
    ),
    status: varchar("status", { length: 20 }).notNull().default("sent"),
    failureReason: text("failure_reason"),
  },
  (table) => [
    index("ccl_crisis_idx").on(table.crisisId),
    index("ccl_org_idx").on(table.orgId),
    index("ccl_sent_idx").on(table.crisisId, table.sentAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// bc_exercise_scenario — Pre-built scenario templates (no org_id)
// ──────────────────────────────────────────────────────────────

export const bcExerciseScenario = pgTable("bc_exercise_scenario", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: jsonb("name").notNull(),
  description: jsonb("description").notNull(),
  crisisType: varchar("crisis_type", { length: 30 }).notNull(),
  durationHours: integer("duration_hours").notNull(),
  difficulty: varchar("difficulty", { length: 20 }).notNull(),
  injects: jsonb("injects").notNull(),
  isTemplate: boolean("is_template").notNull().default(true),
});

// bc_exercise is imported from ./bcms (Sprint 6)
// Sprint 41 adds new columns via migration: exercise_type enum, scenario_id, etc.

// ──────────────────────────────────────────────────────────────
// bc_exercise_inject_log — Per-inject response and scoring
// ──────────────────────────────────────────────────────────────

export const bcExerciseInjectLog = pgTable(
  "bc_exercise_inject_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => bcExercise.id, { onDelete: "cascade" }),
    injectIndex: integer("inject_index").notNull(),
    triggeredAt: timestamp("triggered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    teamResponse: text("team_response"),
    observerNotes: text("observer_notes"),
    scores: jsonb("scores").default("{}"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [index("beil_exercise_idx").on(table.exerciseId)],
);

// ──────────────────────────────────────────────────────────────
// bc_exercise_lesson — Lessons learned with improvement actions
// ──────────────────────────────────────────────────────────────

export const bcExerciseLesson = pgTable(
  "bc_exercise_lesson",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => bcExercise.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    lesson: text("lesson").notNull(),
    category: varchar("category", { length: 30 }),
    severity: varchar("severity", { length: 20 }).default("medium"),
    improvementAction: text("improvement_action"),
    actionOwnerId: uuid("action_owner_id").references(() => user.id),
    actionDeadline: date("action_deadline"),
    taskId: uuid("task_id").references(() => task.id),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bel_exercise_idx").on(table.exerciseId),
    index("bel_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// recovery_procedure — Recovery playbooks with versioning
// ──────────────────────────────────────────────────────────────

export const recoveryProcedure = pgTable(
  "recovery_procedure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    version: integer("version").notNull().default(1),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    reviewCycleMonths: integer("review_cycle_months").notNull().default(6),
    nextReviewDate: date("next_review_date"),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    lastValidatedExerciseId: uuid("last_validated_exercise_id").references(
      () => bcExercise.id,
    ),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rprc_org_idx").on(table.orgId),
    index("rprc_entity_idx").on(table.entityType, table.entityId),
    index("rp_review_idx").on(table.orgId, table.nextReviewDate),
  ],
);

// ──────────────────────────────────────────────────────────────
// recovery_procedure_step — Steps with dependencies
// ──────────────────────────────────────────────────────────────

export const recoveryProcedureStep = pgTable(
  "recovery_procedure_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => recoveryProcedure.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    responsibleRole: varchar("responsible_role", { length: 100 }),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    requiredResources: text("required_resources"),
    dependsOnStepId: uuid("depends_on_step_id"),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    actualDurationMinutes: integer("actual_duration_minutes"),
    executionNotes: text("execution_notes"),
  },
  (table) => [index("rps_procedure_idx").on(table.procedureId)],
);

// ──────────────────────────────────────────────────────────────
// resilience_score_snapshot — Monthly resilience computation
// ──────────────────────────────────────────────────────────────

export const resilienceScoreSnapshot = pgTable(
  "resilience_score_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    overallScore: integer("overall_score").notNull(),
    biaCompleteness: integer("bia_completeness").notNull(),
    bcpCurrency: integer("bcp_currency").notNull(),
    exerciseCompletion: integer("exercise_completion").notNull(),
    recoverCapability: integer("recover_capability").notNull(),
    communicationReadiness: integer("communication_readiness").notNull(),
    procedureCompleteness: integer("procedure_completeness").notNull(),
    supplyChainResilience: integer("supply_chain_resilience").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("rss_org_idx").on(table.orgId, table.snapshotAt)],
);

// ──────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────

export const crisisContactTreeRelations = relations(
  crisisContactTree,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [crisisContactTree.orgId],
      references: [organization.id],
    }),
    nodes: many(crisisContactNode),
  }),
);

export const crisisContactNodeRelations = relations(
  crisisContactNode,
  ({ one }) => ({
    tree: one(crisisContactTree, {
      fields: [crisisContactNode.treeId],
      references: [crisisContactTree.id],
    }),
  }),
);

// bcExercise relations are managed in bcms.ts (Sprint 6)
// Sprint 41 adds inject logs and lessons via separate tables with FK to bcExercise

export const bcExerciseInjectLogRelations = relations(
  bcExerciseInjectLog,
  ({ one }) => ({
    exercise: one(bcExercise, {
      fields: [bcExerciseInjectLog.exerciseId],
      references: [bcExercise.id],
    }),
  }),
);

export const bcExerciseLessonRelations = relations(
  bcExerciseLesson,
  ({ one }) => ({
    exercise: one(bcExercise, {
      fields: [bcExerciseLesson.exerciseId],
      references: [bcExercise.id],
    }),
  }),
);

export const recoveryProcedureRelations = relations(
  recoveryProcedure,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [recoveryProcedure.orgId],
      references: [organization.id],
    }),
    steps: many(recoveryProcedureStep),
  }),
);

export const recoveryProcedureStepRelations = relations(
  recoveryProcedureStep,
  ({ one }) => ({
    procedure: one(recoveryProcedure, {
      fields: [recoveryProcedureStep.procedureId],
      references: [recoveryProcedure.id],
    }),
  }),
);

export const resilienceScoreSnapshotRelations = relations(
  resilienceScoreSnapshot,
  ({ one }) => ({
    organization: one(organization, {
      fields: [resilienceScoreSnapshot.orgId],
      references: [organization.id],
    }),
  }),
);
