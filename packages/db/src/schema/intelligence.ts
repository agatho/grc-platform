// Sprint 11: CCM + AI Intelligence Schema (Drizzle ORM)
// 6 entities: controlEffectivenessScore, findingSlaConfig, regulatoryFeedItem,
// regulatoryRelevanceScore, aiPromptLog, executiveKpiSnapshot

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { control } from "./control";

// ──────────────────────────────────────────────────────────────
// 11.1 ControlEffectivenessScore — CES per control (Sprint 11)
// ──────────────────────────────────────────────────────────────

export const controlEffectivenessScore = pgTable(
  "control_effectiveness_score",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id")
      .notNull()
      .references(() => control.id),
    score: integer("score").notNull(), // 0–100
    testScoreAvg: numeric("test_score_avg", { precision: 5, scale: 2 }),
    overduePenalty: numeric("overdue_penalty", { precision: 5, scale: 2 }),
    findingPenalty: numeric("finding_penalty", { precision: 5, scale: 2 }),
    automationBonus: numeric("automation_bonus", { precision: 5, scale: 2 }),
    openFindingsCount: integer("open_findings_count").default(0),
    lastTestAt: timestamp("last_test_at", { withTimezone: true }),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    trend: varchar("trend", { length: 20 }).default("stable"),
    previousScore: integer("previous_score"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ces_control_idx").on(table.orgId, table.controlId),
    index("ces_score_idx").on(table.orgId, table.score),
  ],
);

// ──────────────────────────────────────────────────────────────
// 11.2 FindingSlaConfig — SLA days per severity per org
// ──────────────────────────────────────────────────────────────

export const findingSlaConfig = pgTable(
  "finding_sla_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    severity: varchar("severity", { length: 50 }).notNull(),
    slaDays: integer("sla_days").notNull(),
  },
  (table) => [
    uniqueIndex("fsc_org_severity_idx").on(table.orgId, table.severity),
  ],
);

// ──────────────────────────────────────────────────────────────
// 11.3 RegulatoryFeedItem — Platform-wide regulatory feed (NO org_id)
// ──────────────────────────────────────────────────────────────

export const regulatoryFeedItem = pgTable("regulatory_feed_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: varchar("source", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary"),
  url: varchar("url", { length: 1000 }),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  category: varchar("category", { length: 100 }),
  jurisdictions: text("jurisdictions").array(),
  frameworks: text("frameworks").array(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ──────────────────────────────────────────────────────────────
// 11.4 RegulatoryRelevanceScore — Per-org relevance for feed items
// ──────────────────────────────────────────────────────────────

export const regulatoryRelevanceScore = pgTable(
  "regulatory_relevance_score",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feedItemId: uuid("feed_item_id")
      .notNull()
      .references(() => regulatoryFeedItem.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    relevanceScore: integer("relevance_score").notNull(), // 0–100
    reasoning: text("reasoning"),
    affectedModules: text("affected_modules").array(),
    isNotified: boolean("is_notified").default(false),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// ──────────────────────────────────────────────────────────────
// 11.5 AiPromptLog — AI usage tracking per org
// ──────────────────────────────────────────────────────────────

export const aiPromptLog = pgTable(
  "ai_prompt_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    promptTemplate: varchar("prompt_template", { length: 100 }).notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    model: varchar("model", { length: 50 }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    cachedResult: boolean("cached_result").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("apl_org_idx").on(table.orgId),
    index("apl_user_idx").on(table.userId),
    index("apl_created_idx").on(table.orgId, table.createdAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 11.6 ExecutiveKpiSnapshot — Weekly KPI snapshots per org
// ──────────────────────────────────────────────────────────────

export const executiveKpiSnapshot = pgTable(
  "executive_kpi_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    snapshotDate: date("snapshot_date").notNull(),
    kpis: jsonb("kpis").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("eks_org_date_idx").on(table.orgId, table.snapshotDate),
  ],
);
