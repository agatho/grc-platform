// Sprint 86: Community Edition und Open-Source Packaging
// 2 entities: community_edition_config, community_contribution

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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const editionTypeEnum = pgEnum("edition_type", [
  "community",
  "enterprise",
]);

export const contributionStatusEnum = pgEnum("contribution_status", [
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "merged",
]);

export const contributionTypeEnum = pgEnum("contribution_type", [
  "plugin",
  "framework",
  "template",
  "translation",
  "documentation",
  "bug_fix",
  "feature",
  "rfc",
]);

// ──────────────────────────────────────────────────────────────
// 86.1 CommunityEditionConfig — Edition configuration per org
// ──────────────────────────────────────────────────────────────

export const communityEditionConfig = pgTable(
  "community_edition_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    editionType: editionTypeEnum("edition_type").notNull().default("community"),
    enabledModules: jsonb("enabled_modules").notNull().default(sql`'["erm","bpm","ics","dms"]'::jsonb`),
    maxUsers: integer("max_users").notNull().default(25),
    maxEntities: integer("max_entities").notNull().default(3),
    pluginSdkEnabled: boolean("plugin_sdk_enabled").notNull().default(true),
    apiAccessEnabled: boolean("api_access_enabled").notNull().default(true),
    communityForumUrl: varchar("community_forum_url", { length: 2000 }),
    deploymentType: varchar("deployment_type", { length: 50 }).notNull().default("docker_compose"),
    helmChartVersion: varchar("helm_chart_version", { length: 50 }),
    licenseKey: varchar("license_key", { length: 500 }),
    licenseExpiresAt: timestamp("license_expires_at", { withTimezone: true }),
    telemetryOptIn: boolean("telemetry_opt_in").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cec_org_idx").on(t.orgId),
    unique("cec_org_unique").on(t.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 86.2 CommunityContribution — Community contributions & RFCs
// ──────────────────────────────────────────────────────────────

export const communityContribution = pgTable(
  "community_contribution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => user.id),
    contributionType: contributionTypeEnum("contribution_type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    repositoryUrl: varchar("repository_url", { length: 2000 }),
    prUrl: varchar("pr_url", { length: 2000 }),
    status: contributionStatusEnum("status").notNull().default("submitted"),
    reviewNotes: text("review_notes"),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    claSignedAt: timestamp("cla_signed_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cc_org_idx").on(t.orgId),
    index("cc_contributor_idx").on(t.contributorId),
    index("cc_type_idx").on(t.contributionType),
    index("cc_status_idx").on(t.status),
  ],
);
