// Sprint 16: Incident Response Playbooks Schema (Drizzle ORM)
// Tables: playbook_template, playbook_phase, playbook_task_template, playbook_activation

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { securityIncident } from "./isms";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const playbookTriggerCategoryEnum = pgEnum("playbook_trigger_category", [
  "ransomware",
  "data_breach",
  "ddos",
  "insider",
  "supply_chain",
  "phishing",
  "other",
]);

export const playbookTriggerSeverityEnum = pgEnum("playbook_trigger_severity", [
  "insignificant",
  "significant",
  "emergency",
  "crisis",
  "catastrophe",
]);

export const playbookActivationStatusEnum = pgEnum("playbook_activation_status", [
  "active",
  "completed",
  "aborted",
]);

// ──────────────────────────────────────────────────────────────
// 16.1 PlaybookTemplate — Reusable incident response template
// ──────────────────────────────────────────────────────────────

export const playbookTemplate = pgTable(
  "playbook_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    triggerCategory: playbookTriggerCategoryEnum("trigger_category").notNull(),
    triggerMinSeverity: playbookTriggerSeverityEnum("trigger_min_severity")
      .notNull()
      .default("significant"),
    isActive: boolean("is_active").notNull().default(true),
    estimatedDurationHours: integer("estimated_duration_hours"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    index("pt_org_idx").on(t.orgId),
    index("pt_trigger_idx").on(t.orgId, t.triggerCategory),
  ],
);

export const playbookTemplateRelations = relations(playbookTemplate, ({ one, many }) => ({
  organization: one(organization, {
    fields: [playbookTemplate.orgId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [playbookTemplate.createdBy],
    references: [user.id],
  }),
  phases: many(playbookPhase),
  activations: many(playbookActivation),
}));

// ──────────────────────────────────────────────────────────────
// 16.2 PlaybookPhase — A phase within a playbook template
// ──────────────────────────────────────────────────────────────

export const playbookPhase = pgTable(
  "playbook_phase",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => playbookTemplate.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
    deadlineHoursRelative: integer("deadline_hours_relative").notNull(),
    escalationRoleOnOverdue: varchar("escalation_role_on_overdue", { length: 50 }),
    communicationTemplateKey: varchar("communication_template_key", { length: 100 }),
  },
  (t) => [
    index("pp_template_idx").on(t.templateId),
    index("pp_sort_idx").on(t.templateId, t.sortOrder),
  ],
);

export const playbookPhaseRelations = relations(playbookPhase, ({ one, many }) => ({
  template: one(playbookTemplate, {
    fields: [playbookPhase.templateId],
    references: [playbookTemplate.id],
  }),
  tasks: many(playbookTaskTemplate),
}));

// ──────────────────────────────────────────────────────────────
// 16.3 PlaybookTaskTemplate — A task template within a phase
// ──────────────────────────────────────────────────────────────

export const playbookTaskTemplate = pgTable(
  "playbook_task_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phaseId: uuid("phase_id")
      .notNull()
      .references(() => playbookPhase.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    assignedRole: varchar("assigned_role", { length: 50 }).notNull(),
    deadlineHoursRelative: integer("deadline_hours_relative").notNull(),
    isCriticalPath: boolean("is_critical_path").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    checklistItems: jsonb("checklist_items").default([]),
  },
  (t) => [
    index("ptt_phase_idx").on(t.phaseId),
    index("ptt_sort_idx").on(t.phaseId, t.sortOrder),
  ],
);

export const playbookTaskTemplateRelations = relations(playbookTaskTemplate, ({ one }) => ({
  phase: one(playbookPhase, {
    fields: [playbookTaskTemplate.phaseId],
    references: [playbookPhase.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 16.4 PlaybookActivation — An activated playbook for an incident
// ──────────────────────────────────────────────────────────────

export const playbookActivation = pgTable(
  "playbook_activation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => playbookTemplate.id),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => securityIncident.id),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedBy: uuid("activated_by")
      .notNull()
      .references(() => user.id),
    status: playbookActivationStatusEnum("status").notNull().default("active"),
    currentPhaseId: uuid("current_phase_id").references(() => playbookPhase.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    totalTasksCount: integer("total_tasks_count").notNull().default(0),
    completedTasksCount: integer("completed_tasks_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("pba_incident_idx").on(t.incidentId),
    index("pba_org_idx").on(t.orgId, t.status),
    index("pba_template_idx").on(t.templateId),
  ],
);

export const playbookActivationRelations = relations(playbookActivation, ({ one }) => ({
  organization: one(organization, {
    fields: [playbookActivation.orgId],
    references: [organization.id],
  }),
  template: one(playbookTemplate, {
    fields: [playbookActivation.templateId],
    references: [playbookTemplate.id],
  }),
  incident: one(securityIncident, {
    fields: [playbookActivation.incidentId],
    references: [securityIncident.id],
  }),
  activator: one(user, {
    fields: [playbookActivation.activatedBy],
    references: [user.id],
  }),
  currentPhase: one(playbookPhase, {
    fields: [playbookActivation.currentPhaseId],
    references: [playbookPhase.id],
  }),
}));
