// Sprint 52: EAM UX & Unified Catalog
// Tables: eam_keyword, eam_homepage_layout

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// EAM Keyword (tag registry with usage count)
// ──────────────────────────────────────────────────────────────

export const eamKeyword = pgTable(
  "eam_keyword",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 100 }).notNull(),
    parentId: uuid("parent_id"),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueName: uniqueIndex("ek_unique_idx").on(table.orgId, table.name),
    orgIdx: index("ek_org_idx").on(table.orgId),
    parentIdx: index("ek_parent_idx").on(table.parentId),
  }),
);

export const eamKeywordRelations = relations(eamKeyword, ({ one, many }) => ({
  organization: one(organization, {
    fields: [eamKeyword.orgId],
    references: [organization.id],
  }),
  parent: one(eamKeyword, {
    fields: [eamKeyword.parentId],
    references: [eamKeyword.id],
    relationName: "keywordHierarchy",
  }),
  children: many(eamKeyword, { relationName: "keywordHierarchy" }),
}));

// ──────────────────────────────────────────────────────────────
// EAM Homepage Layout (per-user widget configuration)
// ──────────────────────────────────────────────────────────────

export const eamHomepageLayout = pgTable(
  "eam_homepage_layout",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    widgetConfig: jsonb("widget_config").notNull().default("[]"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueLayout: uniqueIndex("ehl_unique_idx").on(table.userId, table.orgId),
    orgIdx: index("ehl_org_idx").on(table.orgId),
    userIdx: index("ehl_user_idx").on(table.userId),
  }),
);

export const eamHomepageLayoutRelations = relations(
  eamHomepageLayout,
  ({ one }) => ({
    layoutUser: one(user, {
      fields: [eamHomepageLayout.userId],
      references: [user.id],
    }),
    organization: one(organization, {
      fields: [eamHomepageLayout.orgId],
      references: [organization.id],
    }),
  }),
);
