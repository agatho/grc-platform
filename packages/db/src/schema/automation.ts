// Sprint 28: GRC Workflow Automation Engine (Low-Code/No-Code)
// 3 entities: automation_rule, automation_rule_execution, automation_rule_template

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 28.1 AutomationRule — WENN/DANN rule definition
// Trigger + Conditions (AND/OR nested) + Actions
// ──────────────────────────────────────────────────────────────

export const automationRule = pgTable(
  "automation_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(false),
    triggerType: varchar("trigger_type", { length: 30 }).notNull(), // entity_change | deadline_expired | score_threshold | periodic
    triggerConfig: jsonb("trigger_config").notNull(), // { entityType, events[], field? }
    conditions: jsonb("conditions").notNull(), // { operator: AND|OR, rules: [...] }
    actions: jsonb("actions").notNull(), // [{ type, config }]
    cooldownMinutes: integer("cooldown_minutes").default(60),
    maxExecutionsPerHour: integer("max_executions_per_hour").default(100),
    executionCount: integer("execution_count").default(0),
    lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ar_org_idx").on(table.orgId, table.isActive),
    index("ar_trigger_idx").on(table.triggerType),
  ],
);

// ──────────────────────────────────────────────────────────────
// 28.2 AutomationRuleExecution — Execution log per rule firing
// ──────────────────────────────────────────────────────────────

export const automationRuleExecution = pgTable(
  "automation_rule_execution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => automationRule.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    triggeredByEventId: uuid("triggered_by_event_id"),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    conditionsMatched: boolean("conditions_matched").notNull(),
    actionsExecuted: jsonb("actions_executed").default("[]"),
    status: varchar("status", { length: 20 }).notNull(), // success | partial_failure | failure | skipped_cooldown | skipped_ratelimit | dry_run
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("are_rule_idx").on(table.ruleId),
    index("are_date_idx").on(table.orgId, table.executedAt),
    index("are_status_idx").on(table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 28.3 AutomationRuleTemplate — Predefined best-practice rules
// ──────────────────────────────────────────────────────────────

export const automationRuleTemplate = pgTable(
  "automation_rule_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 50 }).notNull(),
    triggerType: varchar("trigger_type", { length: 30 }).notNull(),
    triggerConfig: jsonb("trigger_config").notNull(),
    conditions: jsonb("conditions").notNull(),
    actions: jsonb("actions").notNull(),
    isBuiltIn: boolean("is_built_in").notNull().default(true),
    orgId: uuid("org_id").references(() => organization.id), // null = global template
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("art_category_idx").on(table.category),
    index("art_org_idx").on(table.orgId),
  ],
);
