// Sprint 35: GRC Monitoring Agents (MCP-based)
// Tables: agent_registration, agent_execution_log, agent_recommendation

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
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Agent Registration
// ──────────────────────────────────────────────────────────────

export const agentRegistration = pgTable(
  "agent_registration",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    agentType: varchar("agent_type", { length: 50 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    config: jsonb("config").notNull().default("{}"),
    isActive: boolean("is_active").notNull().default(false),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("idle"),
    errorMessage: text("error_message"),
    totalRunCount: integer("total_run_count").notNull().default(0),
    totalRecommendations: integer("total_recommendations").notNull().default(0),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ar_org_idx").on(table.orgId),
    typeIdx: index("ar_type_idx").on(table.orgId, table.agentType),
    activeIdx: index("ar_active_idx").on(table.orgId, table.isActive),
  }),
);

export const agentRegistrationRelations = relations(
  agentRegistration,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [agentRegistration.orgId],
      references: [organization.id],
    }),
    creator: one(user, {
      fields: [agentRegistration.createdBy],
      references: [user.id],
    }),
    executionLogs: many(agentExecutionLog),
    recommendations: many(agentRecommendation),
  }),
);

// ──────────────────────────────────────────────────────────────
// Agent Execution Log
// ──────────────────────────────────────────────────────────────

export const agentExecutionLog = pgTable(
  "agent_execution_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agentRegistration.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    phase: varchar("phase", { length: 20 }).notNull(),
    observedData: jsonb("observed_data"),
    evaluation: jsonb("evaluation"),
    recommendations: jsonb("recommendations").default("[]"),
    actionsCreated: jsonb("actions_created").default("[]"),
    itemsFound: integer("items_found").default(0),
    recommendationsGenerated: integer("recommendations_generated").default(0),
    durationMs: integer("duration_ms"),
    aiTokensUsed: integer("ai_tokens_used").default(0),
    errorMessage: text("error_message"),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    agentIdx: index("ael_agent_idx").on(table.agentId),
    dateIdx: index("ael_date_idx").on(table.orgId, table.executedAt),
    orgIdx: index("ael_org_idx").on(table.orgId),
  }),
);

export const agentExecutionLogRelations = relations(
  agentExecutionLog,
  ({ one }) => ({
    agent: one(agentRegistration, {
      fields: [agentExecutionLog.agentId],
      references: [agentRegistration.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Agent Recommendation
// ──────────────────────────────────────────────────────────────

export const agentRecommendation = pgTable(
  "agent_recommendation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agentRegistration.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    severity: varchar("severity", { length: 10 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    reasoning: text("reasoning").notNull(),
    suggestedAction: varchar("suggested_action", { length: 50 }),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    dismissReason: text("dismiss_reason"),
    acceptedBy: uuid("accepted_by").references(() => user.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgStatusIdx: index("arec_org_status_idx").on(table.orgId, table.status),
    agentIdx: index("arec_agent_idx").on(table.agentId),
    severityIdx: index("arec_severity_idx").on(table.orgId, table.severity),
  }),
);

export const agentRecommendationRelations = relations(
  agentRecommendation,
  ({ one }) => ({
    agent: one(agentRegistration, {
      fields: [agentRecommendation.agentId],
      references: [agentRegistration.id],
    }),
    acceptedByUser: one(user, {
      fields: [agentRecommendation.acceptedBy],
      references: [user.id],
    }),
  }),
);
