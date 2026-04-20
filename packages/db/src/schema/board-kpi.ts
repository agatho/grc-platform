// Sprint 23: Board KPIs — Risk Appetite Framework, Assurance Confidence Score, Security Posture Score
// 3 tables: risk_appetite_threshold, assurance_score_snapshot, security_posture_snapshot

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 23.1 Risk Appetite Threshold — Per org + risk category
// ──────────────────────────────────────────────────────────────

export const riskAppetiteThreshold = pgTable(
  "risk_appetite_threshold",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskCategory: varchar("risk_category", { length: 50 }).notNull(),
    maxResidualScore: integer("max_residual_score").notNull(),
    maxResidualAle: numeric("max_residual_ale", { precision: 15, scale: 2 }),
    escalationRole: varchar("escalation_role", { length: 50 }).default("admin"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    uniqueIndex("rat_org_cat_idx").on(table.orgId, table.riskCategory),
    index("brat_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 23.2 Assurance Score Snapshot — Periodic score per module
// ──────────────────────────────────────────────────────────────

export const assuranceScoreSnapshot = pgTable(
  "assurance_score_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    module: varchar("module", { length: 20 }).notNull(),
    score: integer("score").notNull(),
    factors: jsonb("factors").notNull(),
    recommendations: jsonb("recommendations").default("[]"),
    snapshotDate: date("snapshot_date").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ass_org_mod_date_idx").on(
      table.orgId,
      table.module,
      table.snapshotDate,
    ),
    index("ass_org_idx").on(table.orgId),
    index("ass_org_date_idx").on(table.orgId, table.snapshotDate),
  ],
);

// ──────────────────────────────────────────────────────────────
// 23.3 Security Posture Snapshot — Periodic posture score
// ──────────────────────────────────────────────────────────────

export const securityPostureSnapshot = pgTable(
  "security_posture_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    overallScore: integer("overall_score").notNull(),
    factors: jsonb("factors").notNull(),
    domainScores: jsonb("domain_scores").default("{}"),
    snapshotDate: date("snapshot_date").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sps_org_date_idx").on(table.orgId, table.snapshotDate),
    index("sps_org_idx").on(table.orgId),
  ],
);
