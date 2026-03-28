// Sprint 51: EAM AI Assistant — Provider-Agnostic AI Infrastructure
// Tables: eam_ai_config, eam_ai_prompt_template, eam_ai_suggestion_log,
//         eam_translation, eam_chat_session, eam_object_suggestion

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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// EAM AI Config (encrypted provider config per org)
// ──────────────────────────────────────────────────────────────

export const eamAiConfig = pgTable(
  "eam_ai_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    provider: varchar("provider", { length: 30 }).notNull(),
    configEncrypted: text("config_encrypted").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    validationStatus: varchar("validation_status", { length: 20 }).default(
      "untested",
    ),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("eaic_org_idx").on(table.orgId),
    activeIdx: uniqueIndex("eaic_active_idx")
      .on(table.orgId)
      .where(sql`is_active = true`),
  }),
);

export const eamAiConfigRelations = relations(eamAiConfig, ({ one }) => ({
  organization: one(organization, {
    fields: [eamAiConfig.orgId],
    references: [organization.id],
  }),
  createdByUser: one(user, {
    fields: [eamAiConfig.createdBy],
    references: [user.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// EAM AI Prompt Template (system defaults + org overrides)
// ──────────────────────────────────────────────────────────────

export const eamAiPromptTemplate = pgTable(
  "eam_ai_prompt_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organization.id),
    templateKey: varchar("template_key", { length: 50 }).notNull(),
    templateText: text("template_text").notNull(),
    variables: jsonb("variables").default("[]"),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    keyIdx: index("eapt_key_idx").on(table.templateKey),
    orgKeyIdx: index("eapt_org_key_idx").on(table.orgId, table.templateKey),
  }),
);

export const eamAiPromptTemplateRelations = relations(
  eamAiPromptTemplate,
  ({ one }) => ({
    organization: one(organization, {
      fields: [eamAiPromptTemplate.orgId],
      references: [organization.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// EAM AI Suggestion Log (track acceptance/rejection)
// ──────────────────────────────────────────────────────────────

export const eamAiSuggestionLog = pgTable(
  "eam_ai_suggestion_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    featureKey: varchar("feature_key", { length: 50 }).notNull(),
    suggestionData: jsonb("suggestion_data").notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    provider: varchar("provider", { length: 30 }),
    model: varchar("model", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("easl_org_idx").on(table.orgId),
    featureIdx: index("easl_feature_idx").on(table.orgId, table.featureKey),
    userIdx: index("easl_user_idx").on(table.userId),
  }),
);

export const eamAiSuggestionLogRelations = relations(
  eamAiSuggestionLog,
  ({ one }) => ({
    organization: one(organization, {
      fields: [eamAiSuggestionLog.orgId],
      references: [organization.id],
    }),
    actionUser: one(user, {
      fields: [eamAiSuggestionLog.userId],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// EAM Translation (per-object per-language)
// ──────────────────────────────────────────────────────────────

export const eamTranslation = pgTable(
  "eam_translation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityId: uuid("entity_id").notNull(),
    entityType: varchar("entity_type", { length: 30 }).notNull(),
    fieldName: varchar("field_name", { length: 50 }).notNull(),
    language: varchar("language", { length: 10 }).notNull(),
    translatedText: text("translated_text").notNull(),
    status: varchar("status", { length: 20 })
      .notNull()
      .default("ai_translated"),
    translatedBy: uuid("translated_by").references(() => user.id),
    translatedAt: timestamp("translated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    entityIdx: uniqueIndex("etr_entity_idx").on(
      table.entityId,
      table.entityType,
      table.fieldName,
      table.language,
    ),
    orgIdx: index("etr_org_idx").on(table.orgId),
    statusIdx: index("etr_status_idx").on(table.orgId, table.status),
  }),
);

export const eamTranslationRelations = relations(
  eamTranslation,
  ({ one }) => ({
    organization: one(organization, {
      fields: [eamTranslation.orgId],
      references: [organization.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// EAM Chat Session (conversation history)
// ──────────────────────────────────────────────────────────────

export const eamChatSession = pgTable(
  "eam_chat_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    title: varchar("title", { length: 500 }),
    messages: jsonb("messages").notNull().default("[]"),
    provider: varchar("provider", { length: 30 }),
    model: varchar("model", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ecs_org_idx").on(table.orgId),
    userIdx: index("ecs_user_idx").on(table.userId),
  }),
);

export const eamChatSessionRelations = relations(
  eamChatSession,
  ({ one }) => ({
    organization: one(organization, {
      fields: [eamChatSession.orgId],
      references: [organization.id],
    }),
    chatUser: one(user, {
      fields: [eamChatSession.userId],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// EAM Object Suggestion (rule-based, no LLM)
// ──────────────────────────────────────────────────────────────

export const eamObjectSuggestion = pgTable(
  "eam_object_suggestion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    entityId: uuid("entity_id").notNull(),
    entityType: varchar("entity_type", { length: 30 }).notNull(),
    reason: varchar("reason", { length: 50 }).notNull(),
    priority: integer("priority").notNull().default(0),
    dismissed: boolean("dismissed").notNull().default(false),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("eos_user_idx").on(table.userId, table.orgId),
    entityIdx: index("eos_entity_idx").on(table.entityId),
    dismissedIdx: index("eos_dismissed_idx").on(table.userId, table.dismissed),
  }),
);

export const eamObjectSuggestionRelations = relations(
  eamObjectSuggestion,
  ({ one }) => ({
    organization: one(organization, {
      fields: [eamObjectSuggestion.orgId],
      references: [organization.id],
    }),
    targetUser: one(user, {
      fields: [eamObjectSuggestion.userId],
      references: [user.id],
    }),
  }),
);
