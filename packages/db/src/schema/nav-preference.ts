// Sidebar navigation preferences per user+org
// Stores pinned (favorite) routes and collapsed group state

import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// user_nav_preference — persists sidebar favorites + collapsed groups
// RLS: users can only read/write their own row for the current org
// ──────────────────────────────────────────────────────────────

export const userNavPreference = pgTable(
  "user_nav_preference",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    pinnedRoutes: text("pinned_routes").array().default([]),
    collapsedGroups: text("collapsed_groups").array().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("unp_user_org_idx").on(table.userId, table.orgId),
  ],
);
