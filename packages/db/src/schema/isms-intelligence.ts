// Sprint 26: ISMS Intelligence — CVE Feed, AI SoA Gap, AI Maturity Roadmap
// 5 entities: cveFeedItem, assetCpe, cveAssetMatch, soaAiSuggestion, maturityRoadmapAction

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";
import { asset } from "./asset";
import { control } from "./control";

// ──────────────────────────────────────────────────────────────
// 26.1 CveFeedItem — Platform-wide CVE feed entries
// ──────────────────────────────────────────────────────────────

export const cveFeedItem = pgTable(
  "cve_feed_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cveId: varchar("cve_id", { length: 20 }).notNull(),
    source: varchar("source", { length: 20 }).notNull(), // nvd | certbund
    title: varchar("title", { length: 1000 }).notNull(),
    description: text("description"),
    cvssScore: numeric("cvss_score", { precision: 3, scale: 1 }),
    cvssSeverity: varchar("cvss_severity", { length: 10 }), // critical|high|medium|low|none
    affectedCpes: jsonb("affected_cpes").default(sql`'[]'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    modifiedAt: timestamp("modified_at", { withTimezone: true }),
    references: jsonb("references").default(sql`'[]'::jsonb`),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("cfi_cve_idx").on(table.cveId),
    index("cfi_severity_idx").on(table.cvssSeverity),
    index("cfi_published_idx").on(table.publishedAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 26.2 AssetCpe — CPE identifiers mapped to assets (per-org)
// ──────────────────────────────────────────────────────────────

export const assetCpe = pgTable(
  "asset_cpe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    cpeUri: varchar("cpe_uri", { length: 500 }).notNull(),
    vendor: varchar("vendor", { length: 200 }),
    product: varchar("product", { length: 200 }),
    version: varchar("version", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("acpe_org_idx").on(table.orgId),
    index("acpe_asset_idx").on(table.assetId),
    index("acpe_vendor_product_idx").on(table.vendor, table.product),
  ],
);

// ──────────────────────────────────────────────────────────────
// 26.3 CveAssetMatch — CVE matched to an org asset via CPE
// ──────────────────────────────────────────────────────────────

export const cveAssetMatch = pgTable(
  "cve_asset_match",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cveId: uuid("cve_id")
      .notNull()
      .references(() => cveFeedItem.id),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    matchedCpe: varchar("matched_cpe", { length: 500 }),
    status: varchar("status", { length: 20 }).notNull().default("new"),
    acknowledgedBy: uuid("acknowledged_by").references(() => user.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    linkedVulnerabilityId: uuid("linked_vulnerability_id"),
    matchedAt: timestamp("matched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cam_org_idx").on(table.orgId, table.status),
    uniqueIndex("cam_unique_idx").on(table.cveId, table.assetId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 26.4 SoaAiSuggestion — AI-generated SoA gap analysis results
// ──────────────────────────────────────────────────────────────

export const soaAiSuggestion = pgTable(
  "soa_ai_suggestion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    analysisRunId: uuid("analysis_run_id").notNull(), // groups suggestions from one run
    framework: varchar("framework", { length: 100 }).notNull(),
    frameworkControlRef: varchar("framework_control_ref", {
      length: 100,
    }).notNull(),
    frameworkControlTitle: varchar("framework_control_title", { length: 500 }),
    suggestedControlId: uuid("suggested_control_id").references(
      () => control.id,
    ),
    confidence: integer("confidence").notNull(), // 0-100
    gapType: varchar("gap_type", { length: 30 }).notNull(), // not_covered | partial | full
    reasoning: text("reasoning"),
    priority: varchar("priority", { length: 20 }).notNull().default("medium"), // critical | high | medium | low
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | accepted | rejected
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sas_org_idx").on(table.orgId),
    index("sas_run_idx").on(table.analysisRunId),
    index("sas_status_idx").on(table.orgId, table.status),
    index("sas_framework_idx").on(table.orgId, table.framework),
  ],
);

// ──────────────────────────────────────────────────────────────
// 26.5 MaturityRoadmapAction — AI-generated roadmap actions
// ──────────────────────────────────────────────────────────────

export const maturityRoadmapAction = pgTable(
  "maturity_roadmap_action",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    roadmapRunId: uuid("roadmap_run_id").notNull(), // groups actions from one run
    domain: varchar("domain", { length: 200 }).notNull(),
    currentLevel: integer("current_level").notNull(),
    targetLevel: integer("target_level").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    effort: varchar("effort", { length: 10 }).notNull().default("M"), // S | M | L
    effortFteMonths: numeric("effort_fte_months", { precision: 5, scale: 1 }),
    priority: integer("priority").notNull().default(50), // 1 = highest
    quarter: varchar("quarter", { length: 10 }), // Q1 | Q2 | Q3 | Q4
    isQuickWin: boolean("is_quick_win").notNull().default(false),
    dependencies: jsonb("dependencies").default(sql`'[]'::jsonb`),
    status: varchar("status", { length: 20 }).notNull().default("proposed"), // proposed | in_progress | completed | dismissed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("mra_org_idx").on(table.orgId),
    index("mra_run_idx").on(table.roadmapRunId),
    index("mra_priority_idx").on(table.orgId, table.priority),
    index("mra_quickwin_idx").on(table.orgId, table.isQuickWin),
  ],
);
