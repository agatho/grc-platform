// Sprint 82: Integration Marketplace
// 7 entities: marketplace_listing, marketplace_category, marketplace_version,
// marketplace_review, marketplace_installation, marketplace_publisher, marketplace_security_scan

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const marketplaceCategoryTypeEnum = pgEnum("marketplace_category_type", [
  "connector",
  "framework",
  "template",
  "dashboard",
  "ai_prompt",
  "industry_pack",
  "workflow",
  "report",
]);

export const marketplaceListingStatusEnum = pgEnum("marketplace_listing_status", [
  "draft",
  "pending_review",
  "published",
  "suspended",
  "deprecated",
  "rejected",
]);

export const marketplaceVersionStatusEnum = pgEnum("marketplace_version_status", [
  "draft",
  "under_review",
  "approved",
  "rejected",
  "deprecated",
]);

export const marketplaceScanStatusEnum = pgEnum("marketplace_scan_status", [
  "pending",
  "scanning",
  "passed",
  "failed",
  "warning",
]);

// ──────────────────────────────────────────────────────────────
// 82.1 MarketplacePublisher — Publisher/vendor accounts
// ──────────────────────────────────────────────────────────────

export const marketplacePublisher = pgTable(
  "marketplace_publisher",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    websiteUrl: varchar("website_url", { length: 2000 }),
    logoUrl: varchar("logo_url", { length: 2000 }),
    contactEmail: varchar("contact_email", { length: 500 }),
    isVerified: boolean("is_verified").notNull().default(false),
    revenueSharePct: numeric("revenue_share_pct", { precision: 5, scale: 2 }).notNull().default("70.00"),
    totalEarnings: numeric("total_earnings", { precision: 14, scale: 2 }).notNull().default("0.00"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mp_pub_org_idx").on(t.orgId),
    unique("mp_pub_slug_unique").on(t.slug),
  ],
);

// ──────────────────────────────────────────────────────────────
// 82.2 MarketplaceCategory — Category taxonomy
// ──────────────────────────────────────────────────────────────

export const marketplaceCategory = pgTable(
  "marketplace_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    categoryType: marketplaceCategoryTypeEnum("category_type").notNull(),
    parentId: uuid("parent_id"),
    iconName: varchar("icon_name", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("mp_cat_slug_unique").on(t.slug),
    index("mp_cat_type_idx").on(t.categoryType),
  ],
);

// ──────────────────────────────────────────────────────────────
// 82.3 MarketplaceListing — Published items in the marketplace
// ──────────────────────────────────────────────────────────────

export const marketplaceListing = pgTable(
  "marketplace_listing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    publisherId: uuid("publisher_id")
      .notNull()
      .references(() => marketplacePublisher.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => marketplaceCategory.id),
    name: varchar("name", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 300 }).notNull(),
    summary: varchar("summary", { length: 1000 }).notNull(),
    description: text("description"),
    iconUrl: varchar("icon_url", { length: 2000 }),
    screenshotUrls: jsonb("screenshot_urls").notNull().default(sql`'[]'::jsonb`),
    tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
    status: marketplaceListingStatusEnum("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    priceType: varchar("price_type", { length: 20 }).notNull().default("free"),
    priceAmount: numeric("price_amount", { precision: 10, scale: 2 }),
    priceCurrency: varchar("price_currency", { length: 3 }).default("EUR"),
    installCount: integer("install_count").notNull().default(0),
    avgRating: numeric("avg_rating", { precision: 3, scale: 2 }).notNull().default("0.00"),
    reviewCount: integer("review_count").notNull().default(0),
    minimumVersion: varchar("minimum_version", { length: 50 }),
    supportUrl: varchar("support_url", { length: 2000 }),
    documentationUrl: varchar("documentation_url", { length: 2000 }),
    createdBy: uuid("created_by").references(() => user.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mp_list_org_idx").on(t.orgId),
    index("mp_list_pub_idx").on(t.publisherId),
    index("mp_list_cat_idx").on(t.categoryId),
    index("mp_list_status_idx").on(t.status),
    index("mp_list_featured_idx").on(t.isFeatured, t.status),
    unique("mp_list_slug_unique").on(t.slug),
  ],
);

// ──────────────────────────────────────────────────────────────
// 82.4 MarketplaceVersion — Version management per listing
// ──────────────────────────────────────────────────────────────

export const marketplaceVersion = pgTable(
  "marketplace_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => marketplaceListing.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 50 }).notNull(),
    releaseNotes: text("release_notes"),
    packageUrl: varchar("package_url", { length: 2000 }),
    packageSize: integer("package_size"),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    status: marketplaceVersionStatusEnum("status").notNull().default("draft"),
    compatibilityJson: jsonb("compatibility_json").notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => user.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mp_ver_org_idx").on(t.orgId),
    index("mp_ver_listing_idx").on(t.listingId),
    unique("mp_ver_listing_version").on(t.listingId, t.version),
  ],
);

// ──────────────────────────────────────────────────────────────
// 82.5 MarketplaceReview — User ratings and reviews
// ──────────────────────────────────────────────────────────────

export const marketplaceReview = pgTable(
  "marketplace_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => marketplaceListing.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    rating: integer("rating").notNull(),
    title: varchar("title", { length: 300 }),
    body: text("body"),
    isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
    helpfulCount: integer("helpful_count").notNull().default(0),
    publisherResponse: text("publisher_response"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mp_rev_org_idx").on(t.orgId),
    index("mp_rev_listing_idx").on(t.listingId),
    unique("mp_rev_user_listing").on(t.userId, t.listingId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 82.6 MarketplaceInstallation — Installed items per org
// ──────────────────────────────────────────────────────────────

export const marketplaceInstallation = pgTable(
  "marketplace_installation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => marketplaceListing.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => marketplaceVersion.id),
    installedBy: uuid("installed_by")
      .notNull()
      .references(() => user.id),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    configJson: jsonb("config_json").notNull().default(sql`'{}'::jsonb`),
    autoUpdate: boolean("auto_update").notNull().default(true),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
  },
  (t) => [
    index("mp_inst_org_idx").on(t.orgId),
    index("mp_inst_listing_idx").on(t.listingId),
    unique("mp_inst_org_listing").on(t.orgId, t.listingId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 82.7 MarketplaceSecurityScan — Scan results for submissions
// ──────────────────────────────────────────────────────────────

export const marketplaceSecurityScan = pgTable(
  "marketplace_security_scan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => marketplaceVersion.id, { onDelete: "cascade" }),
    scanStatus: marketplaceScanStatusEnum("scan_status").notNull().default("pending"),
    scanEngine: varchar("scan_engine", { length: 100 }).notNull().default("builtin"),
    findingsJson: jsonb("findings_json").notNull().default(sql`'[]'::jsonb`),
    criticalCount: integer("critical_count").notNull().default(0),
    highCount: integer("high_count").notNull().default(0),
    mediumCount: integer("medium_count").notNull().default(0),
    lowCount: integer("low_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mp_scan_org_idx").on(t.orgId),
    index("mp_scan_version_idx").on(t.versionId),
    index("mp_scan_status_idx").on(t.scanStatus),
  ],
);
