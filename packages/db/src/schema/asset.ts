// Sprint 1.4: Asset Schema (Drizzle ORM)
// 3-tier asset model: business_structure > primary_asset > supporting_asset
// Entities: asset, asset_cia_profile

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  integer,
  date,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const assetTierEnum = pgEnum("asset_tier", [
  "business_structure",
  "primary_asset",
  "supporting_asset",
]);

// ──────────────────────────────────────────────────────────────
// 3.1 Asset — 3-tier model with CIA defaults (PRD §032)
// ──────────────────────────────────────────────────────────────

export const asset = pgTable(
  "asset",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    assetTier: assetTierEnum("asset_tier")
      .notNull()
      .default("supporting_asset"),
    codeGroup: varchar("code_group", { length: 100 }),

    // CIA defaults (1-4 scale, nullable — CHECK constraints in migration)
    defaultConfidentiality: integer("default_confidentiality"),
    defaultIntegrity: integer("default_integrity"),
    defaultAvailability: integer("default_availability"),
    defaultAuthenticity: integer("default_authenticity"),
    defaultReliability: integer("default_reliability"),

    // Protection goal class: GREATEST(C, I, A) — updated by trigger
    protectionGoalClass: integer("protection_goal_class"),

    // Business structure fields
    contactPerson: varchar("contact_person", { length: 255 }),
    dataProtectionResponsible: varchar("data_protection_responsible", {
      length: 255,
    }),
    dpoEmail: varchar("dpo_email", { length: 255 }),
    latestAuditDate: date("latest_audit_date"),
    latestAuditResult: varchar("latest_audit_result", { length: 50 }),

    // Hierarchy: self-reference — FK added in migration SQL
    parentAssetId: uuid("parent_asset_id"),

    // Module visibility
    visibleInModules: text("visible_in_modules")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("asset_parent_idx").on(table.parentAssetId),
    index("asset_tier_org_idx").on(table.orgId, table.assetTier),
  ],
);

// ──────────────────────────────────────────────────────────────
// 3.2 AssetCiaProfile — Per-asset CIA assessment snapshot
// ──────────────────────────────────────────────────────────────

export const assetCiaProfile = pgTable(
  "asset_cia_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    assessmentRunId: uuid("assessment_run_id"), // FK to Sprint 5 table
    confidentiality: integer("confidentiality").notNull(),
    integrity: integer("integrity").notNull(),
    availability: integer("availability").notNull(),
    authenticity: integer("authenticity"),
    reliability: integer("reliability"),
    // Protection goal class: GREATEST(C, I, A) — updated by trigger
    protectionGoalClass: integer("protection_goal_class"),
    isAssessmentRequired: boolean("is_assessment_required").default(false),
    overruleJustification: text("overrule_justification"),
    validFrom: date("valid_from").notNull().defaultNow(),
    validTo: date("valid_to"),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [index("asset_cia_profile_asset_idx").on(table.assetId)],
);
