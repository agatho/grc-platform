// Sprint 13a: Corporate Design & Branding Schema (Drizzle ORM)
// Tables: org_branding, user_dashboard_layout

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const reportTemplateEnum = pgEnum("report_template", [
  "standard",
  "formal",
  "minimal",
]);

// ──────────────────────────────────────────────────────────────
// org_branding — Per-org brand colors, logo, report template
// ──────────────────────────────────────────────────────────────

export const orgBranding = pgTable(
  "org_branding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id)
      .unique(),

    // Core brand colors (hex #RRGGBB)
    primaryColor: varchar("primary_color", { length: 7 })
      .notNull()
      .default("#2563eb"),
    secondaryColor: varchar("secondary_color", { length: 7 })
      .notNull()
      .default("#1e40af"),
    accentColor: varchar("accent_color", { length: 7 })
      .notNull()
      .default("#f59e0b"),
    textColor: varchar("text_color", { length: 7 })
      .notNull()
      .default("#0f172a"),
    backgroundColor: varchar("background_color", { length: 7 })
      .notNull()
      .default("#ffffff"),

    // Dark mode overrides (nullable = auto-compute from primary/accent)
    darkModePrimaryColor: varchar("dark_mode_primary_color", { length: 7 }),
    darkModeAccentColor: varchar("dark_mode_accent_color", { length: 7 }),

    // Asset paths (stored via storage service)
    logoPath: varchar("logo_path", { length: 1000 }),
    faviconPath: varchar("favicon_path", { length: 1000 }),

    // Report configuration
    reportTemplate: reportTemplateEnum("report_template")
      .notNull()
      .default("standard"),
    confidentialityNotice: text("confidentiality_notice").default(
      "CONFIDENTIAL -- For internal use only",
    ),

    // Custom CSS (admin-only, validated server-side, sanitized)
    customCss: text("custom_css"),

    // Inheritance
    inheritFromParent: boolean("inherit_from_parent").notNull().default(true),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by").references(() => user.id),
  },
  (table) => [index("ob_org_idx").on(table.orgId)],
);

// ──────────────────────────────────────────────────────────────
// user_dashboard_layout — Personal/org-default dashboard layouts
// ──────────────────────────────────────────────────────────────

export const userDashboardLayout = pgTable(
  "user_dashboard_layout",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id").references(() => user.id), // NULL = org default layout
    layoutJson: jsonb("layout_json").notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("udl_org_user_idx").on(table.orgId, table.userId),
    index("udl_org_default_idx").on(table.orgId, table.isDefault),
  ],
);

// ──────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────

export const orgBrandingRelations = relations(orgBranding, ({ one }) => ({
  organization: one(organization, {
    fields: [orgBranding.orgId],
    references: [organization.id],
  }),
  updatedByUser: one(user, {
    fields: [orgBranding.updatedBy],
    references: [user.id],
  }),
}));

export const userDashboardLayoutRelations = relations(
  userDashboardLayout,
  ({ one }) => ({
    organization: one(organization, {
      fields: [userDashboardLayout.orgId],
      references: [organization.id],
    }),
    user: one(user, {
      fields: [userDashboardLayout.userId],
      references: [user.id],
    }),
  }),
);
