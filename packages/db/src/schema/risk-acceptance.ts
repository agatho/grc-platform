// Risk Acceptance + ERM-Sync-Config (ADR-014 Phase 3)
//
// - risk_acceptance -- formelle Risk-Acceptance-Decisions mit Revoke-Flow
//   (ISO 27005 Clause 10)
// - risk_acceptance_authority -- Authority-Matrix: wer darf welchen
//   Risk-Score akzeptieren (z. B. bis 15 = risk_manager, bis 25 = admin)
// - erm_sync_config -- Per-Modul-Config fuer automatische Risk-Erstellung
//   aus Findings/Incidents/Vulnerabilities
//
// Migration: 0088_risk_acceptance.sql (Tabellen), 0345 (RLS FORCE),
// 0360_risk_acceptance_repair.sql (Repair: 0088 rollte auf Dev-DBs wegen
// Seed-FK-Violation zurueck — siehe MIGRATIONS_KNOWN_ISSUES.md Kategorie A).
//
// 2026-07-10: Schema an die tatsaechliche Tabellendefinition aus 0088
// angeglichen — accepted_by, acceptance_conditions, valid_until,
// risk_score_at_acceptance, justification, status und tags fehlten hier
// (Drift), wodurch die Acceptance-API NOT-NULL-Spalten nicht befuellen
// konnte.

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  // Wer akzeptiert hat (ISO 27005: Akzeptanz ist eine personengebundene
  // Management-Entscheidung)
  acceptedBy: uuid("accepted_by")
    .notNull()
    .references(() => user.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Auflagen/Bedingungen unter denen akzeptiert wurde
  acceptanceConditions: text("acceptance_conditions"),
  // Zeitlich befristete Akzeptanz — Cron `risk-acceptance-expiry`
  // setzt status=expired nach Ablauf
  validUntil: date("valid_until"),
  // Score-/Level-Snapshot zum Zeitpunkt der Akzeptanz (Audit-Trail)
  riskScoreAtAcceptance: integer("risk_score_at_acceptance").notNull(),
  // low | medium | high | critical -- Snapshot zum Zeitpunkt der Akzeptanz
  riskLevelAtAcceptance: varchar("risk_level_at_acceptance", {
    length: 20,
  }).notNull(),
  // Begruendung (Pflicht nach ISO 27005)
  justification: text("justification").notNull(),
  // active | expired | revoked — siehe @grc/shared state-machines/risk-acceptance
  status: varchar("status", { length: 20 }).default("active").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: uuid("revoked_by").references(() => user.id),
  revokeReason: text("revoke_reason"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
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
  // Band-Regel: min_score <= risk_score <= max_score -> required_role
  minScore: integer("min_score").default(0).notNull(),
  // maxScore = hoechster Risk-Score den diese Rolle akzeptieren darf
  maxScore: integer("max_score").default(25).notNull(),
  requiredRole: varchar("required_role", { length: 50 }).notNull(),
  requiredRoleLabel: varchar("required_role_label", { length: 200 }),
  // Optional: Akzeptanz nur durch eine bestimmte Person
  requiredApproverId: uuid("required_approver_id").references(() => user.id),
  description: text("description"),
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
