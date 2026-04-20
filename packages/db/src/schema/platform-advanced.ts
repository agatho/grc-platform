// Sprint 38: Platform Advanced — Custom Fields, Notifications, Search, Branding Extensions, Multi-Org Hierarchy

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "number",
  "date",
  "single_select",
  "multi_select",
  "url",
  "email",
  "checkbox",
  "rich_text",
  "currency",
]);

// ──────────────────────────────────────────────────────────────
// custom_field_definition — Dynamic field metadata per entity type
// ──────────────────────────────────────────────────────────────

export const customFieldDefinition = pgTable(
  "custom_field_definition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    fieldKey: varchar("field_key", { length: 100 }).notNull(),
    label: jsonb("label").notNull(), // {de, en}
    fieldType: customFieldTypeEnum("field_type").notNull(),
    options: jsonb("options").default("[]"),
    validation: jsonb("validation").default("{}"),
    defaultValue: jsonb("default_value"),
    placeholder: jsonb("placeholder"),
    helpText: jsonb("help_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    showInList: boolean("show_in_list").notNull().default(false),
    showInExport: boolean("show_in_export").notNull().default(true),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cfd_org_entity_idx").on(table.orgId, table.entityType),
    uniqueIndex("cfd_unique_key_idx").on(
      table.orgId,
      table.entityType,
      table.fieldKey,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// notification_preference — Per-user per-type delivery preferences
// ──────────────────────────────────────────────────────────────

export const notificationPreference = pgTable(
  "notification_preference",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    notificationType: varchar("notification_type", { length: 50 }).notNull(),
    channel: varchar("channel", { length: 20 }).notNull().default("both"),
    quietHoursStart: varchar("quiet_hours_start", { length: 5 }),
    quietHoursEnd: varchar("quiet_hours_end", { length: 5 }),
    digestFrequency: varchar("digest_frequency", { length: 20 }),
  },
  (table) => [
    uniqueIndex("np_user_type_idx").on(table.userId, table.notificationType),
  ],
);

// ──────────────────────────────────────────────────────────────
// search_index — Full-text search across all entity types
// ──────────────────────────────────────────────────────────────

export const searchIndex = pgTable(
  "search_index",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    title: varchar("title", { length: 1000 }).notNull(),
    content: text("content"),
    module: varchar("module", { length: 20 }),
    status: varchar("status", { length: 50 }),
    ownerId: uuid("owner_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sii_org_idx").on(table.orgId),
    uniqueIndex("si_entity_idx").on(table.entityType, table.entityId),
  ],
);

// ──────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────

export const customFieldDefinitionRelations = relations(
  customFieldDefinition,
  ({ one }) => ({
    organization: one(organization, {
      fields: [customFieldDefinition.orgId],
      references: [organization.id],
    }),
    creator: one(user, {
      fields: [customFieldDefinition.createdBy],
      references: [user.id],
    }),
  }),
);

export const notificationPreferenceRelations = relations(
  notificationPreference,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationPreference.userId],
      references: [user.id],
    }),
  }),
);

export const searchIndexRelations = relations(searchIndex, ({ one }) => ({
  organization: one(organization, {
    fields: [searchIndex.orgId],
    references: [organization.id],
  }),
}));
