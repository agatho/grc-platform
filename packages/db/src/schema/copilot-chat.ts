// Sprint 67: GRC Copilot Enterprise Chat
// Tables: copilot_conversation, copilot_message, copilot_prompt_template,
//         copilot_rag_source, copilot_suggested_action, copilot_feedback

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
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 67.1 Copilot Conversation — Chat session per user per org
// ──────────────────────────────────────────────────────────────

export const copilotConversation = pgTable(
  "copilot_conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    title: varchar("title", { length: 500 }),
    language: varchar("language", { length: 10 }).notNull().default("de"),
    contextModule: varchar("context_module", { length: 50 }),
    contextEntityType: varchar("context_entity_type", { length: 50 }),
    contextEntityId: uuid("context_entity_id"),
    isPinned: boolean("is_pinned").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    messageCount: integer("message_count").notNull().default(0),
    totalTokensUsed: integer("total_tokens_used").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgUserIdx: index("cc_org_user_idx").on(table.orgId, table.userId),
    lastMsgIdx: index("cc_last_msg_idx").on(table.orgId, table.lastMessageAt),
    contextIdx: index("cc_context_idx").on(table.orgId, table.contextModule),
  }),
);

export const copilotConversationRelations = relations(
  copilotConversation,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [copilotConversation.orgId],
      references: [organization.id],
    }),
    user: one(user, {
      fields: [copilotConversation.userId],
      references: [user.id],
    }),
    messages: many(copilotMessage),
    suggestedActions: many(copilotSuggestedAction),
  }),
);

// ──────────────────────────────────────────────────────────────
// 67.2 Copilot Message — Individual message in conversation
// ──────────────────────────────────────────────────────────────

export const copilotMessage = pgTable(
  "copilot_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => copilotConversation.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    role: varchar("role", { length: 20 }).notNull(), // user | assistant | system
    content: text("content").notNull(),
    contentType: varchar("content_type", { length: 20 })
      .notNull()
      .default("text"), // text | markdown | chart | table
    ragSources: jsonb("rag_sources").default("[]"), // [{entityType, entityId, title, relevance}]
    model: varchar("model", { length: 100 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    templateKey: varchar("template_key", { length: 100 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    convIdx: index("cm_conv_idx").on(table.conversationId),
    orgIdx: index("cm_org_idx").on(table.orgId),
    roleIdx: index("cm_role_idx").on(table.conversationId, table.role),
  }),
);

export const copilotMessageRelations = relations(
  copilotMessage,
  ({ one, many }) => ({
    conversation: one(copilotConversation, {
      fields: [copilotMessage.conversationId],
      references: [copilotConversation.id],
    }),
    feedback: many(copilotFeedback),
  }),
);

// ──────────────────────────────────────────────────────────────
// 67.3 Copilot Prompt Template — Reusable prompt templates
// ──────────────────────────────────────────────────────────────

export const copilotPromptTemplate = pgTable(
  "copilot_prompt_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organization.id), // NULL = platform-wide
    key: varchar("key", { length: 100 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    systemPrompt: text("system_prompt").notNull(),
    userPromptTemplate: text("user_prompt_template").notNull(),
    category: varchar("category", { length: 50 }).notNull(), // risk | control | compliance | general
    moduleKey: varchar("module_key", { length: 50 }),
    variables: jsonb("variables").default("[]"), // [{name, type, required, description}]
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    keyIdx: uniqueIndex("cpt_key_idx").on(table.orgId, table.key),
    categoryIdx: index("cpt_category_idx").on(table.category),
  }),
);

export const copilotPromptTemplateRelations = relations(
  copilotPromptTemplate,
  ({ one }) => ({
    organization: one(organization, {
      fields: [copilotPromptTemplate.orgId],
      references: [organization.id],
    }),
    creator: one(user, {
      fields: [copilotPromptTemplate.createdBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 67.4 Copilot RAG Source — Indexed org data sources for RAG
// ──────────────────────────────────────────────────────────────

export const copilotRagSource = pgTable(
  "copilot_rag_source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceType: varchar("source_type", { length: 50 }).notNull(), // risk | control | process | document | policy
    entityId: uuid("entity_id"),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(),
    embedding: jsonb("embedding"), // pgvector stored as jsonb for compatibility
    chunkIndex: integer("chunk_index").notNull().default(0),
    metadata: jsonb("metadata").default("{}"),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgSourceIdx: index("crs_org_source_idx").on(table.orgId, table.sourceType),
    entityIdx: index("crs_entity_idx").on(table.orgId, table.entityId),
    indexedIdx: index("crs_indexed_idx").on(table.lastIndexedAt),
  }),
);

export const copilotRagSourceRelations = relations(
  copilotRagSource,
  ({ one }) => ({
    organization: one(organization, {
      fields: [copilotRagSource.orgId],
      references: [organization.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 67.5 Copilot Suggested Action — Actions generated from chat
// ──────────────────────────────────────────────────────────────

export const copilotSuggestedAction = pgTable(
  "copilot_suggested_action",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => copilotConversation.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    messageId: uuid("message_id").references(() => copilotMessage.id),
    actionType: varchar("action_type", { length: 50 }).notNull(), // create_task | create_finding | update_risk | navigate | export
    label: varchar("label", { length: 500 }).notNull(),
    description: text("description"),
    payload: jsonb("payload").notNull().default("{}"),
    status: varchar("status", { length: 20 }).notNull().default("suggested"), // suggested | accepted | dismissed | executed
    executedAt: timestamp("executed_at", { withTimezone: true }),
    executedBy: uuid("executed_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    convIdx: index("csa_conv_idx").on(table.conversationId),
    orgStatusIdx: index("csa_org_status_idx").on(table.orgId, table.status),
  }),
);

export const copilotSuggestedActionRelations = relations(
  copilotSuggestedAction,
  ({ one }) => ({
    conversation: one(copilotConversation, {
      fields: [copilotSuggestedAction.conversationId],
      references: [copilotConversation.id],
    }),
    message: one(copilotMessage, {
      fields: [copilotSuggestedAction.messageId],
      references: [copilotMessage.id],
    }),
    executor: one(user, {
      fields: [copilotSuggestedAction.executedBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// 67.6 Copilot Feedback — User feedback on messages
// ──────────────────────────────────────────────────────────────

export const copilotFeedback = pgTable(
  "copilot_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => copilotMessage.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    rating: integer("rating").notNull(), // -1 (thumbs down) | 1 (thumbs up)
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    msgIdx: uniqueIndex("cf_msg_user_idx").on(table.messageId, table.userId),
    orgIdx: index("cf_org_idx").on(table.orgId),
  }),
);

export const copilotFeedbackRelations = relations(
  copilotFeedback,
  ({ one }) => ({
    message: one(copilotMessage, {
      fields: [copilotFeedback.messageId],
      references: [copilotMessage.id],
    }),
    user: one(user, {
      fields: [copilotFeedback.userId],
      references: [user.id],
    }),
  }),
);
