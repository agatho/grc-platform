// Programme Cockpit Schema (Sprint Y1-Cross-Cutting)
//
// Norm-übergreifender geführter Einführungsprozess für Managementsysteme.
// Bezug: docs/isms-bcms/10-programme-cockpit-implementation-plan.md
//
// 7 Tabellen:
//   programme_template          (norm-templates, global lesbar)
//   programme_template_phase    (phasen pro template)
//   programme_template_step     (schritte pro template + phase)
//   programme_journey           (instanz pro org)
//   programme_journey_phase     (phase-status pro journey)
//   programme_journey_step      (schritt-status pro journey)
//   programme_journey_event     (append-only event-log)

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  numeric,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const msTypeEnum = pgEnum("ms_type", [
  "isms",
  "bcms",
  "dpms",
  "aims",
  "esg",
  "tcms",
  "iccs",
  "other",
]);

export const pdcaPhaseEnum = pgEnum("pdca_phase", [
  "plan",
  "do",
  "check",
  "act",
  "continuous",
]);

export const programmeJourneyStatusEnum = pgEnum("programme_journey_status", [
  "planned",
  "active",
  "on_track",
  "at_risk",
  "blocked",
  "completed",
  "archived",
]);

export const programmeStepStatusEnum = pgEnum("programme_step_status", [
  "pending",
  "blocked",
  "in_progress",
  "review",
  "completed",
  "skipped",
  "cancelled",
]);

// ──────────────────────────────────────────────────────────────
// programme_template — global, immutable nach publication
// ──────────────────────────────────────────────────────────────

export const programmeTemplate = pgTable(
  "programme_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull(),
    msType: msTypeEnum("ms_type").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    version: varchar("version", { length: 20 }).notNull().default("1.0"),
    frameworkCodes: jsonb("framework_codes").default([]).notNull(),
    locale: varchar("locale", { length: 10 }).notNull().default("de"),
    estimatedDurationDays: integer("estimated_duration_days")
      .notNull()
      .default(365),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    uniqueIndex("programme_template_code_version_idx").on(t.code, t.version),
    index("programme_template_ms_type_idx").on(t.msType, t.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// programme_template_phase
// ──────────────────────────────────────────────────────────────

export const programmeTemplatePhase = pgTable(
  "programme_template_phase",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => programmeTemplate.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    sequence: integer("sequence").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    pdcaPhase: pdcaPhaseEnum("pdca_phase").notNull(),
    defaultDurationDays: integer("default_duration_days").notNull().default(30),
    isGate: boolean("is_gate").notNull().default(false),
    gateCriteria: jsonb("gate_criteria").default([]).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("programme_template_phase_seq_idx").on(t.templateId, t.sequence),
    uniqueIndex("programme_template_phase_code_idx").on(t.templateId, t.code),
  ],
);

// ──────────────────────────────────────────────────────────────
// programme_template_step
// ──────────────────────────────────────────────────────────────

export const programmeTemplateStep = pgTable(
  "programme_template_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => programmeTemplate.id, { onDelete: "cascade" }),
    phaseId: uuid("phase_id")
      .notNull()
      .references(() => programmeTemplatePhase.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 80 }).notNull(),
    sequence: integer("sequence").notNull(),
    name: varchar("name", { length: 300 }).notNull(),
    description: text("description"),
    isoClause: varchar("iso_clause", { length: 50 }),
    defaultOwnerRole: varchar("default_owner_role", { length: 50 }),
    defaultDurationDays: integer("default_duration_days").notNull().default(7),
    prerequisiteStepCodes: jsonb("prerequisite_step_codes")
      .default([])
      .notNull(),
    targetModuleLink: jsonb("target_module_link").default({}).notNull(),
    requiredEvidenceCount: integer("required_evidence_count")
      .notNull()
      .default(0),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    isMilestone: boolean("is_milestone").notNull().default(false),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("programme_template_step_code_idx").on(t.templateId, t.code),
    uniqueIndex("programme_template_step_phase_seq_idx").on(
      t.phaseId,
      t.sequence,
    ),
    index("programme_template_step_template_idx").on(t.templateId),
  ],
);

// ──────────────────────────────────────────────────────────────
// programme_journey — instanz pro organisation
// ──────────────────────────────────────────────────────────────

export const programmeJourney = pgTable(
  "programme_journey",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => programmeTemplate.id),
    templateCode: varchar("template_code", { length: 50 }).notNull(),
    templateVersion: varchar("template_version", { length: 20 }).notNull(),
    msType: msTypeEnum("ms_type").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    status: programmeJourneyStatusEnum("status").notNull().default("planned"),
    healthReason: text("health_reason"),
    progressPercent: numeric("progress_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    ownerId: uuid("owner_id").references(() => user.id),
    sponsorId: uuid("sponsor_id").references(() => user.id),
    startedAt: date("started_at"),
    targetCompletionDate: date("target_completion_date"),
    actualCompletionDate: date("actual_completion_date"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    lastHealthEvalAt: timestamp("last_health_eval_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}).notNull(),
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
    uniqueIndex("programme_journey_org_name_idx").on(t.orgId, t.name),
    index("programme_journey_org_status_idx").on(t.orgId, t.status),
    index("programme_journey_org_ms_idx").on(t.orgId, t.msType),
    index("programme_journey_target_date_idx").on(
      t.orgId,
      t.targetCompletionDate,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// programme_journey_phase
// ──────────────────────────────────────────────────────────────

export const programmeJourneyPhase = pgTable(
  "programme_journey_phase",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => programmeJourney.id, { onDelete: "cascade" }),
    templatePhaseId: uuid("template_phase_id")
      .notNull()
      .references(() => programmeTemplatePhase.id),
    code: varchar("code", { length: 50 }).notNull(),
    sequence: integer("sequence").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    pdcaPhase: pdcaPhaseEnum("pdca_phase").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    progressPercent: numeric("progress_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    plannedStartDate: date("planned_start_date"),
    plannedEndDate: date("planned_end_date"),
    actualStartDate: date("actual_start_date"),
    actualEndDate: date("actual_end_date"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("programme_journey_phase_journey_seq_idx").on(
      t.journeyId,
      t.sequence,
    ),
    index("programme_journey_phase_org_idx").on(t.orgId),
    index("programme_journey_phase_status_idx").on(t.orgId, t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// programme_journey_step
// ──────────────────────────────────────────────────────────────

export const programmeJourneyStep = pgTable(
  "programme_journey_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => programmeJourney.id, { onDelete: "cascade" }),
    phaseId: uuid("phase_id")
      .notNull()
      .references(() => programmeJourneyPhase.id, { onDelete: "cascade" }),
    templateStepId: uuid("template_step_id")
      .notNull()
      .references(() => programmeTemplateStep.id),
    code: varchar("code", { length: 80 }).notNull(),
    sequence: integer("sequence").notNull(),
    name: varchar("name", { length: 300 }).notNull(),
    description: text("description"),
    isoClause: varchar("iso_clause", { length: 50 }),
    status: programmeStepStatusEnum("status").notNull().default("pending"),
    ownerId: uuid("owner_id").references(() => user.id),
    dueDate: date("due_date"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    skipReason: text("skip_reason"),
    blockReason: text("block_reason"),
    completionNotes: text("completion_notes"),
    evidenceLinks: jsonb("evidence_links").default([]).notNull(),
    targetModuleLink: jsonb("target_module_link").default({}).notNull(),
    requiredEvidenceCount: integer("required_evidence_count")
      .notNull()
      .default(0),
    isMilestone: boolean("is_milestone").notNull().default(false),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by").references(() => user.id),
  },
  (t) => [
    uniqueIndex("programme_journey_step_journey_code_idx").on(
      t.journeyId,
      t.code,
    ),
    index("programme_journey_step_phase_idx").on(t.phaseId, t.sequence),
    index("programme_journey_step_org_status_idx").on(t.orgId, t.status),
    index("programme_journey_step_due_idx").on(t.orgId, t.dueDate),
    index("programme_journey_step_owner_idx").on(t.ownerId, t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// programme_journey_event — append-only audit-/event-log
// ──────────────────────────────────────────────────────────────

export const programmeJourneyEvent = pgTable(
  "programme_journey_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => programmeJourney.id, { onDelete: "cascade" }),
    stepId: uuid("step_id"),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    actorId: uuid("actor_id").references(() => user.id),
    payload: jsonb("payload").default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("programme_journey_event_journey_idx").on(t.journeyId, t.occurredAt),
    index("programme_journey_event_org_type_idx").on(t.orgId, t.eventType),
    index("programme_journey_event_step_idx").on(t.stepId),
  ],
);

// ──────────────────────────────────────────────────────────────
// programme_subtask_status / programme_link_kind / programme_link_type
// ──────────────────────────────────────────────────────────────

export const programmeSubtaskStatusEnum = pgEnum("programme_subtask_status", [
  "pending",
  "in_progress",
  "completed",
  "skipped",
]);

export const programmeLinkKindEnum = pgEnum("programme_link_kind", [
  "risk",
  "control",
  "document",
  "asset",
  "incident",
  "treatment",
  "finding",
  "process",
  "work_item",
  "catalog_entry",
  "url",
]);

export const programmeLinkTypeEnum = pgEnum("programme_link_type", [
  "related",
  "mitigates",
  "evidences",
  "deliverable",
  "reference",
]);

// ──────────────────────────────────────────────────────────────
// programme_template_subtask
// ──────────────────────────────────────────────────────────────

export const programmeTemplateSubtask = pgTable(
  "programme_template_subtask",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateStepId: uuid("template_step_id")
      .notNull()
      .references(() => programmeTemplateStep.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    defaultOwnerRole: varchar("default_owner_role", { length: 50 }),
    defaultDurationDays: integer("default_duration_days").notNull().default(1),
    deliverableType: varchar("deliverable_type", { length: 80 }),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("programme_template_subtask_step_idx").on(
      t.templateStepId,
      t.sequence,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// programme_journey_subtask
// ──────────────────────────────────────────────────────────────

export const programmeJourneySubtask = pgTable(
  "programme_journey_subtask",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    journeyStepId: uuid("journey_step_id")
      .notNull()
      .references(() => programmeJourneyStep.id, { onDelete: "cascade" }),
    templateSubtaskId: uuid("template_subtask_id").references(
      () => programmeTemplateSubtask.id,
    ),
    sequence: integer("sequence").notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    status: programmeSubtaskStatusEnum("status").notNull().default("pending"),
    ownerId: uuid("owner_id").references(() => user.id),
    dueDate: date("due_date"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completionNotes: text("completion_notes"),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    deliverableType: varchar("deliverable_type", { length: 80 }),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by").references(() => user.id),
  },
  (t) => [
    index("programme_journey_subtask_step_idx").on(t.journeyStepId, t.sequence),
    index("programme_journey_subtask_owner_idx").on(t.ownerId, t.status),
    index("programme_journey_subtask_org_idx").on(t.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// programme_step_link
// ──────────────────────────────────────────────────────────────

export const programmeStepLink = pgTable(
  "programme_step_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    journeyStepId: uuid("journey_step_id")
      .notNull()
      .references(() => programmeJourneyStep.id, { onDelete: "cascade" }),
    targetKind: programmeLinkKindEnum("target_kind").notNull(),
    targetId: uuid("target_id"),
    targetLabel: varchar("target_label", { length: 300 }).notNull(),
    targetUrl: varchar("target_url", { length: 1000 }),
    linkType: programmeLinkTypeEnum("link_type").notNull().default("related"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("programme_step_link_step_idx").on(t.journeyStepId),
    index("programme_step_link_org_idx").on(t.orgId),
    index("programme_step_link_target_idx").on(t.targetKind, t.targetId),
  ],
);

// ──────────────────────────────────────────────────────────────
// Type Exports
// ──────────────────────────────────────────────────────────────

export type ProgrammeTemplate = typeof programmeTemplate.$inferSelect;
export type ProgrammeTemplateInsert = typeof programmeTemplate.$inferInsert;
export type ProgrammeTemplatePhase = typeof programmeTemplatePhase.$inferSelect;
export type ProgrammeTemplatePhaseInsert =
  typeof programmeTemplatePhase.$inferInsert;
export type ProgrammeTemplateStep = typeof programmeTemplateStep.$inferSelect;
export type ProgrammeTemplateStepInsert =
  typeof programmeTemplateStep.$inferInsert;
export type ProgrammeJourney = typeof programmeJourney.$inferSelect;
export type ProgrammeJourneyInsert = typeof programmeJourney.$inferInsert;
export type ProgrammeJourneyPhase = typeof programmeJourneyPhase.$inferSelect;
export type ProgrammeJourneyPhaseInsert =
  typeof programmeJourneyPhase.$inferInsert;
export type ProgrammeJourneyStep = typeof programmeJourneyStep.$inferSelect;
export type ProgrammeJourneyStepInsert =
  typeof programmeJourneyStep.$inferInsert;
export type ProgrammeJourneyEvent = typeof programmeJourneyEvent.$inferSelect;
export type ProgrammeJourneyEventInsert =
  typeof programmeJourneyEvent.$inferInsert;
export type ProgrammeTemplateSubtask =
  typeof programmeTemplateSubtask.$inferSelect;
export type ProgrammeTemplateSubtaskInsert =
  typeof programmeTemplateSubtask.$inferInsert;
export type ProgrammeJourneySubtask =
  typeof programmeJourneySubtask.$inferSelect;
export type ProgrammeJourneySubtaskInsert =
  typeof programmeJourneySubtask.$inferInsert;
export type ProgrammeStepLink = typeof programmeStepLink.$inferSelect;
export type ProgrammeStepLinkInsert = typeof programmeStepLink.$inferInsert;

export const PROGRAMME_SUBTASK_STATUS_VALUES = [
  "pending",
  "in_progress",
  "completed",
  "skipped",
] as const;
export type ProgrammeSubtaskStatus =
  (typeof PROGRAMME_SUBTASK_STATUS_VALUES)[number];

export const PROGRAMME_LINK_KIND_VALUES = [
  "risk",
  "control",
  "document",
  "asset",
  "incident",
  "treatment",
  "finding",
  "process",
  "work_item",
  "catalog_entry",
  "url",
] as const;
export type ProgrammeLinkKind = (typeof PROGRAMME_LINK_KIND_VALUES)[number];

export const PROGRAMME_LINK_TYPE_VALUES = [
  "related",
  "mitigates",
  "evidences",
  "deliverable",
  "reference",
] as const;
export type ProgrammeLinkType = (typeof PROGRAMME_LINK_TYPE_VALUES)[number];

// ──────────────────────────────────────────────────────────────
// Hilfs-Tupel — als readonly Konstanten exportiert für Zod/UI
// ──────────────────────────────────────────────────────────────

export const MS_TYPE_VALUES = [
  "isms",
  "bcms",
  "dpms",
  "aims",
  "esg",
  "tcms",
  "iccs",
  "other",
] as const;
export type MsType = (typeof MS_TYPE_VALUES)[number];

export const PDCA_PHASE_VALUES = [
  "plan",
  "do",
  "check",
  "act",
  "continuous",
] as const;
export type PdcaPhase = (typeof PDCA_PHASE_VALUES)[number];

export const PROGRAMME_JOURNEY_STATUS_VALUES = [
  "planned",
  "active",
  "on_track",
  "at_risk",
  "blocked",
  "completed",
  "archived",
] as const;
export type ProgrammeJourneyStatus =
  (typeof PROGRAMME_JOURNEY_STATUS_VALUES)[number];

export const PROGRAMME_STEP_STATUS_VALUES = [
  "pending",
  "blocked",
  "in_progress",
  "review",
  "completed",
  "skipped",
  "cancelled",
] as const;
export type ProgrammeStepStatus = (typeof PROGRAMME_STEP_STATUS_VALUES)[number];

void sql;
