// Sprint 60: Mobile Application (Drizzle ORM)
// 4 entities: device_registration, push_notification, offline_sync_state, mobile_session

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
// 60.1 DeviceRegistration — Mobile device registration for push
// ──────────────────────────────────────────────────────────────

export const deviceRegistration = pgTable(
  "device_registration",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    deviceToken: varchar("device_token", { length: 500 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull(),
    deviceModel: varchar("device_model", { length: 100 }),
    osVersion: varchar("os_version", { length: 50 }),
    appVersion: varchar("app_version", { length: 20 }),
    isActive: boolean("is_active").notNull().default(true),
    biometricEnabled: boolean("biometric_enabled").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("device_reg_org_idx").on(table.orgId),
    index("device_reg_user_idx").on(table.userId),
    uniqueIndex("device_reg_token_idx").on(table.deviceToken),
    index("device_reg_active_idx").on(table.userId, table.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 60.2 PushNotification — Push notification log
// ──────────────────────────────────────────────────────────────

export const pushNotification = pgTable(
  "push_notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    deviceId: uuid("device_id").references(() => deviceRegistration.id),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    data: jsonb("data").default("{}"),
    category: varchar("category", { length: 50 }).notNull().default("general"),
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("push_notif_org_idx").on(table.orgId),
    index("push_notif_user_idx").on(table.userId),
    index("push_notif_status_idx").on(table.status),
    index("push_notif_created_idx").on(table.createdAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 60.3 OfflineSyncState — Tracks offline data sync per device
// ──────────────────────────────────────────────────────────────

export const offlineSyncState = pgTable(
  "offline_sync_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => deviceRegistration.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncVersion: integer("sync_version").notNull().default(0),
    pendingChanges: jsonb("pending_changes").default("[]"),
    conflictCount: integer("conflict_count").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("synced"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("offline_sync_org_idx").on(table.orgId),
    uniqueIndex("offline_sync_unique_idx").on(table.deviceId, table.entityType),
    index("offline_sync_user_idx").on(table.userId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 60.4 MobileSession — Mobile app session tracking
// ──────────────────────────────────────────────────────────────

export const mobileSession = pgTable(
  "mobile_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => deviceRegistration.id),
    refreshTokenHash: varchar("refresh_token_hash", { length: 512 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    ipAddress: varchar("ip_address", { length: 45 }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("mobile_session_org_idx").on(table.orgId),
    index("mobile_session_user_idx").on(table.userId),
    index("mobile_session_device_idx").on(table.deviceId),
    index("mobile_session_active_idx").on(table.userId, table.isActive),
  ],
);
