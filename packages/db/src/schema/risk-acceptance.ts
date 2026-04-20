// Risk Acceptance + ERM-Sync-Config (ADR-014 Phase 3)
//
// - risk_acceptance -- formelle Risk-Acceptance-Decisions mit Revoke-Flow
//   (ISO 27005 Clause 10)
// - risk_acceptance_authority -- Authority-Matrix: wer darf welchen
//   Risk-Score akzeptieren (z. B. bis 15 = risk_manager, bis 25 = admin)
// - erm_sync_config -- Per-Modul-Config fuer automatische Risk-Erstellung
//   aus Findings/Incidents/Vulnerabilities
//
// Migration: 0079_round2_features.sql, 0087_risk_acceptance.sql

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { risk } from "./risk";

export const riskAcceptance = pgTable("risk_acceptance", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  riskId: uuid("risk_id")
    .notNull()
    .references(() => risk.id, { onDelete: "cascade" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // low | medium | high | critical -- Snapshot zum Zeitpunkt der Akzeptanz
  riskLevelAtAcceptance: varchar("risk_level_at_acceptance", {
    length: 20,
  }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: uuid("revoked_by").references(() => user.id),
  revokeReason: text("revoke_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const riskAcceptanceAuthority = pgTable("risk_acceptance_authority", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  // maxScore = hoechster Risk-Score den diese Rolle akzeptieren darf
  maxScore: integer("max_score").default(25).notNull(),
  requiredRole: varchar("required_role", { length: 50 }).notNull(),
  requiredRoleLabel: varchar("required_role_label", { length: 200 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const ermSyncConfig = pgTable("erm_sync_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  moduleKey: varchar("module_key", { length: 50 }).notNull(),
  syncEnabled: boolean("sync_enabled").default(true).notNull(),
  // Score ab dem automatisch ein Risk angelegt wird
  scoreThreshold: integer("score_threshold").default(15).notNull(),
  autoCreateRisk: boolean("auto_create_risk").default(true).notNull(),
  // operational | strategic | compliance | financial | reputational
  defaultRiskCategory: varchar("default_risk_category", { length: 50 })
    .default("operational")
    .notNull(),
  // avoid | mitigate | transfer | accept
  defaultTreatmentStrategy: varchar("default_treatment_strategy", {
    length: 20,
  })
    .default("mitigate")
    .notNull(),
  notifyRiskManager: boolean("notify_risk_manager").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
