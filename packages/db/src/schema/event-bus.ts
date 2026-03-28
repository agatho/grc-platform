// Sprint 22: Where-Used Tracking + Event Bus / Webhook System (Drizzle ORM)
// 4 entities: entity_reference, webhook_registration, webhook_delivery_log, event_log

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
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 22.1 EntityReference — Where-Used registry (polymorphic source → target)
// Trigger-maintained: DB triggers on reference tables auto-sync.
// ──────────────────────────────────────────────────────────────

export const entityReference = pgTable(
  "entity_reference",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    sourceId: uuid("source_id").notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: uuid("target_id").notNull(),
    relationship: varchar("relationship", { length: 50 }).notNull(),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("er_source_idx").on(table.sourceType, table.sourceId),
    index("er_target_idx").on(table.targetType, table.targetId),
    index("er_org_idx").on(table.orgId),
    uniqueIndex("er_unique_idx").on(
      table.orgId,
      table.sourceType,
      table.sourceId,
      table.targetType,
      table.targetId,
      table.relationship,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 22.2 WebhookRegistration — Registered webhook URLs with event filters
// ──────────────────────────────────────────────────────────────

export const webhookRegistration = pgTable(
  "webhook_registration",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 200 }).notNull(),
    url: varchar("url", { length: 2000 }).notNull(),
    secretHash: varchar("secret_hash", { length: 256 }).notNull(),
    secretLast4: varchar("secret_last4", { length: 4 }).notNull(),
    eventFilter: jsonb("event_filter").notNull(),
    headers: jsonb("headers").default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    templateType: varchar("template_type", { length: 20 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("wr_org_idx").on(table.orgId),
    index("wr_active_idx").on(table.orgId, table.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 22.3 WebhookDeliveryLog — Delivery tracking per webhook
// ──────────────────────────────────────────────────────────────

export const webhookDeliveryLog = pgTable(
  "webhook_delivery_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhookRegistration.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    payload: jsonb("payload").notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    retryCount: integer("retry_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("wdl_webhook_idx").on(table.webhookId),
    index("wdl_status_idx").on(table.status),
    index("wdl_created_idx").on(table.createdAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 22.4 EventLog — Internal event log (all entity mutations)
// ──────────────────────────────────────────────────────────────

export const eventLog = pgTable(
  "event_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    userId: uuid("user_id"),
    payload: jsonb("payload").notNull(),
    emittedAt: timestamp("emitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("el_org_idx").on(table.orgId, table.emittedAt),
    index("el_entity_idx").on(table.entityType, table.entityId),
    index("el_event_type_idx").on(table.eventType),
  ],
);
