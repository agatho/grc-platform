// Stakeholder Register Schema (REQ-ISMS-005)
//
// Bezug: ISO 27001:2022 §4.2 — Verstehen der Erfordernisse und Erwartungen
// interessierter Parteien. ISO 22301:2019 §4.2 (analog).
//
// Pro Organisation ein Register interessierter Parteien (Stakeholder) mit
// dokumentierten Erwartungen und Frist-getriebenen Reviews. Wird im
// Management-Review (§9.3.2 c) als Pflicht-Input verwendet.

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  pgEnum,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

export const stakeholderTypeEnum = pgEnum("stakeholder_type", [
  "regulator",
  "customer",
  "supplier",
  "employee",
  "investor",
  "board",
  "auditor",
  "community",
  "media",
  "partner",
  "other",
]);

export const stakeholderInfluenceEnum = pgEnum("stakeholder_influence", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const stakeholderInterestEnum = pgEnum("stakeholder_interest", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const stakeholderEngagementStrategyEnum = pgEnum(
  "stakeholder_engagement_strategy",
  ["monitor", "keep_informed", "keep_satisfied", "manage_closely"],
);

export const stakeholder = pgTable(
  "stakeholder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 200 }).notNull(),
    type: stakeholderTypeEnum("type").notNull(),
    description: text("description"),
    contactName: varchar("contact_name", { length: 200 }),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    influence: stakeholderInfluenceEnum("influence").notNull().default("medium"),
    interest: stakeholderInterestEnum("interest").notNull().default("medium"),
    // Power/Interest-Matrix Quadrant — abgeleitet, kann auch manuell überschrieben werden
    engagementStrategy: stakeholderEngagementStrategyEnum(
      "engagement_strategy",
    ).default("keep_informed"),
    // optionale Tags für Segmentierung (z.B. "gdpr","nis2","dora","esg")
    tags: jsonb("tags").default([]).notNull(),
    // Review-Lifecycle
    lastReviewedAt: date("last_reviewed_at"),
    nextReviewDue: date("next_review_due"),
    reviewIntervalMonths: varchar("review_interval_months", { length: 10 })
      .default("12")
      .notNull(),
    // Audit
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
    index("stakeholder_org_idx").on(t.orgId),
    index("stakeholder_type_idx").on(t.orgId, t.type),
    index("stakeholder_review_idx").on(t.orgId, t.nextReviewDue),
  ],
);

export const stakeholderExpectation = pgTable(
  "stakeholder_expectation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholder.id, { onDelete: "cascade" }),
    expectation: text("expectation").notNull(),
    // open | acknowledged | in_progress | met | unmet | obsolete
    status: varchar("status", { length: 30 }).notNull().default("open"),
    priority: varchar("priority", { length: 20 }).notNull().default("medium"),
    sourceType: varchar("source_type", { length: 50 }),
    sourceReference: varchar("source_reference", { length: 200 }),
    // optionale Verknüpfung in andere Module (Risk, NC, Audit-Finding, …)
    linkedEntityType: varchar("linked_entity_type", { length: 50 }),
    linkedEntityId: uuid("linked_entity_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (t) => [
    index("stakeholder_exp_org_idx").on(t.orgId),
    index("stakeholder_exp_stakeholder_idx").on(t.stakeholderId),
    index("stakeholder_exp_status_idx").on(t.orgId, t.status),
  ],
);

export type Stakeholder = typeof stakeholder.$inferSelect;
export type StakeholderInsert = typeof stakeholder.$inferInsert;
export type StakeholderExpectation = typeof stakeholderExpectation.$inferSelect;
export type StakeholderExpectationInsert =
  typeof stakeholderExpectation.$inferInsert;

// Power/Interest-Matrix-Helper — pure function, kann ohne DB importiert werden
export function recommendEngagementStrategy(
  influence: "low" | "medium" | "high" | "critical",
  interest: "low" | "medium" | "high" | "critical",
): "monitor" | "keep_informed" | "keep_satisfied" | "manage_closely" {
  const i = influence === "critical" || influence === "high";
  const t = interest === "critical" || interest === "high";
  if (i && t) return "manage_closely";
  if (i && !t) return "keep_satisfied";
  if (!i && t) return "keep_informed";
  return "monitor";
}

export const STAKEHOLDER_EXPECTATION_STATUSES = [
  "open",
  "acknowledged",
  "in_progress",
  "met",
  "unmet",
  "obsolete",
] as const;

export const STAKEHOLDER_EXPECTATION_TRANSITIONS: Record<
  (typeof STAKEHOLDER_EXPECTATION_STATUSES)[number],
  Array<(typeof STAKEHOLDER_EXPECTATION_STATUSES)[number]>
> = {
  open: ["acknowledged", "obsolete"],
  acknowledged: ["in_progress", "obsolete"],
  in_progress: ["met", "unmet", "obsolete"],
  met: ["obsolete"],
  unmet: ["in_progress", "obsolete"],
  obsolete: [],
};
// `sql` muss importiert sein, damit die Default-Werte auf SQL-Ebene auflösbar sind.
void sql;
