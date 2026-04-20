// Sprint 80: Multi-Region Deployment und Data Sovereignty
// 5 entities: data_region, region_tenant_config, data_residency_rule,
//             cross_region_replication, sovereignty_audit_log

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

export const dataRegionCodeEnum = pgEnum("data_region_code", [
  "eu_central",
  "eu_west",
  "eu_north",
  "ch",
  "uk",
  "us_east",
  "us_west",
  "ap_southeast",
]);

export const regionStatusEnum = pgEnum("region_status", [
  "active",
  "provisioning",
  "maintenance",
  "decommissioned",
]);

export const residencyRuleTypeEnum = pgEnum("residency_rule_type", [
  "data_at_rest",
  "data_in_transit",
  "backup",
  "logging",
  "processing",
]);

export const replicationStatusEnum = pgEnum("replication_status", [
  "active",
  "paused",
  "failed",
  "pending_approval",
]);

export const sovereigntyEventTypeEnum = pgEnum("sovereignty_event_type", [
  "data_access",
  "data_transfer",
  "region_change",
  "policy_violation",
  "replication_event",
  "compliance_check",
]);

export const complianceFrameworkTagEnum = pgEnum("compliance_framework_tag", [
  "gdpr",
  "bsi_c5",
  "soc2_type2",
  "iso27001",
  "nis2",
]);

// ──────────────────────────────────────────────────────────────
// 80.1 DataRegion — Region definitions
// ──────────────────────────────────────────────────────────────

export const dataRegion = pgTable(
  "data_region",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: dataRegionCodeEnum("code").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    location: varchar("location", { length: 200 }).notNull(),
    provider: varchar("provider", { length: 100 }).notNull(),
    status: regionStatusEnum("status").notNull().default("provisioning"),
    endpointUrl: varchar("endpoint_url", { length: 500 }),
    infraConfig: jsonb("infra_config")
      .notNull()
      .default(sql`'{}'::jsonb`),
    complianceTags: jsonb("compliance_tags")
      .notNull()
      .default(sql`'[]'::jsonb`),
    maxTenants: integer("max_tenants"),
    currentTenants: integer("current_tenants").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("dr_code_unique").on(t.code),
    index("dr_status_idx").on(t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 80.2 RegionTenantConfig — Region-locked tenant assignments
// ──────────────────────────────────────────────────────────────

export const regionTenantConfig = pgTable(
  "region_tenant_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    primaryRegionId: uuid("primary_region_id")
      .notNull()
      .references(() => dataRegion.id),
    backupRegionId: uuid("backup_region_id").references(() => dataRegion.id),
    isRegionLocked: boolean("is_region_locked").notNull().default(true),
    lockReason: varchar("lock_reason", { length: 500 }),
    dataClassification: varchar("data_classification", { length: 100 })
      .notNull()
      .default("confidential"),
    retentionPolicy: jsonb("retention_policy")
      .notNull()
      .default(sql`'{}'::jsonb`),
    encryptionConfig: jsonb("encryption_config")
      .notNull()
      .default(sql`'{}'::jsonb`),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("rtc_org_unique").on(t.orgId),
    index("rtc_region_idx").on(t.primaryRegionId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 80.3 DataResidencyRule — Rules governing data location
// ──────────────────────────────────────────────────────────────

export const dataResidencyRule = pgTable(
  "data_residency_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 300 }).notNull(),
    ruleType: residencyRuleTypeEnum("rule_type").notNull(),
    description: text("description"),
    allowedRegions: jsonb("allowed_regions")
      .notNull()
      .default(sql`'[]'::jsonb`),
    deniedRegions: jsonb("denied_regions")
      .notNull()
      .default(sql`'[]'::jsonb`),
    complianceFramework: complianceFrameworkTagEnum("compliance_framework"),
    isEnforced: boolean("is_enforced").notNull().default(true),
    violationAction: varchar("violation_action", { length: 50 })
      .notNull()
      .default("block"),
    conditionsJson: jsonb("conditions_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("drr_org_idx").on(t.orgId),
    index("drr_type_idx").on(t.orgId, t.ruleType),
  ],
);

// ──────────────────────────────────────────────────────────────
// 80.4 CrossRegionReplication — Replication config + status
// ──────────────────────────────────────────────────────────────

export const crossRegionReplication = pgTable(
  "cross_region_replication",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceRegionId: uuid("source_region_id")
      .notNull()
      .references(() => dataRegion.id),
    targetRegionId: uuid("target_region_id")
      .notNull()
      .references(() => dataRegion.id),
    status: replicationStatusEnum("status")
      .notNull()
      .default("pending_approval"),
    replicationType: varchar("replication_type", { length: 50 })
      .notNull()
      .default("async"),
    tablesIncluded: jsonb("tables_included")
      .notNull()
      .default(sql`'[]'::jsonb`),
    tablesExcluded: jsonb("tables_excluded")
      .notNull()
      .default(sql`'[]'::jsonb`),
    gdprSafeguards: jsonb("gdpr_safeguards")
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lagSeconds: integer("lag_seconds"),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("crr_org_idx").on(t.orgId),
    index("crr_source_idx").on(t.sourceRegionId),
    index("crr_target_idx").on(t.targetRegionId),
    index("crr_status_idx").on(t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 80.5 SovereigntyAuditLog — Immutable data sovereignty events
// ──────────────────────────────────────────────────────────────

export const sovereigntyAuditLog = pgTable(
  "sovereignty_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    eventType: sovereigntyEventTypeEnum("event_type").notNull(),
    regionCode: varchar("region_code", { length: 50 }),
    targetRegionCode: varchar("target_region_code", { length: 50 }),
    entityType: varchar("entity_type", { length: 100 }),
    entityId: uuid("entity_id"),
    description: text("description").notNull(),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    ipAddress: varchar("ip_address", { length: 45 }),
    userId: uuid("user_id").references(() => user.id),
    isViolation: boolean("is_violation").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sal_org_idx").on(t.orgId),
    index("sal_event_idx").on(t.orgId, t.eventType),
    index("sal_violation_idx").on(t.orgId, t.isViolation),
    index("sal_created_idx").on(t.orgId, t.createdAt),
  ],
);
