// BPM Overhaul Phase 1: GRC extensions to the process domain.
//
// process_ropa_profile  — GDPR Art. 30 metadata per process (1:1)
// process_sign_off       — Hash-chain anchored signature per role (append-only)
// process_framework_mapping — Process ↔ catalog_entry compliance coverage

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";
import { process, processVersion } from "./process";
import { ropaLegalBasisEnum, dpia, ropaEntry } from "./dpms";

// ──────────────────────────────────────────────────────────────
// process_ropa_profile  (migration 0333)
// ──────────────────────────────────────────────────────────────

export const processRopaProfile = pgTable(
  "process_ropa_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    isProcessingActivity: boolean("is_processing_activity")
      .notNull()
      .default(false),
    processingPurpose: text("processing_purpose"),
    legalBasis: ropaLegalBasisEnum("legal_basis"),
    legalBasisDetail: text("legal_basis_detail"),
    dataSubjectCategories: text("data_subject_categories")
      .array()
      .default(sql`'{}'::text[]`),
    personalDataCategories: text("personal_data_categories")
      .array()
      .default(sql`'{}'::text[]`),
    specialCategories: text("special_categories")
      .array()
      .default(sql`'{}'::text[]`),
    recipients: text("recipients").array().default(sql`'{}'::text[]`),
    thirdCountryTransfers: boolean("third_country_transfers")
      .notNull()
      .default(false),
    thirdCountrySafeguards: text("third_country_safeguards"),
    retentionPeriodDescription: text("retention_period_description"),
    retentionPeriodMonths: integer("retention_period_months"),
    tomDescription: text("tom_description"),
    requiresDpia: boolean("requires_dpia").notNull().default(false),
    dpiaTriggerReason: text("dpia_trigger_reason"),
    dpiaId: uuid("dpia_id").references(() => dpia.id),
    ropaEntryId: uuid("ropa_entry_id").references(() => ropaEntry.id, {
      onDelete: "set null",
    }),
    controllerOrgId: uuid("controller_org_id").references(
      () => organization.id,
    ),
    jointControllerOrgIds: uuid("joint_controller_org_ids")
      .array()
      .default(sql`'{}'::uuid[]`),
    processorVendorIds: uuid("processor_vendor_ids")
      .array()
      .default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    uniqueIndex("process_ropa_profile_process_uniq").on(t.processId),
    index("process_ropa_profile_org_idx").on(t.orgId),
    index("process_ropa_profile_dpia_idx").on(t.dpiaId),
  ],
);

// ──────────────────────────────────────────────────────────────
// process_sign_off  (migration 0334) — append-only
// ──────────────────────────────────────────────────────────────

export const processSignOff = pgTable(
  "process_sign_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    processVersionId: uuid("process_version_id").references(
      () => processVersion.id,
      { onDelete: "set null" },
    ),
    signerId: uuid("signer_id").notNull(),
    signerRole: varchar("signer_role", { length: 80 }).notNull(),
    signoffType: varchar("signoff_type", { length: 32 }).notNull(),
    comments: text("comments"),
    payloadHash: varchar("payload_hash", { length: 128 }).notNull(),
    previousChainHash: varchar("previous_chain_hash", { length: 128 }),
    chainHash: varchar("chain_hash", { length: 128 }).notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("pso_org_idx").on(t.orgId),
    index("pso_process_idx").on(t.processId),
    index("pso_version_idx").on(t.processVersionId),
    index("pso_chain_idx").on(t.processId, t.signedAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// process_framework_mapping  (migration 0334)
// ──────────────────────────────────────────────────────────────

export const processFrameworkMapping = pgTable(
  "process_framework_mapping",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    catalogEntryId: uuid("catalog_entry_id").notNull(),
    catalogId: uuid("catalog_id"),
    frameworkCode: varchar("framework_code", { length: 40 }),
    mappingStrength: varchar("mapping_strength", { length: 20 })
      .notNull()
      .default("covers"),
    rationale: text("rationale"),
    evidenceLink: text("evidence_link"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
  },
  (t) => [
    uniqueIndex("pfm_process_entry_uniq").on(t.processId, t.catalogEntryId),
    index("pfm_org_idx").on(t.orgId),
    index("pfm_process_idx").on(t.processId),
    index("pfm_entry_idx").on(t.catalogEntryId),
    index("pfm_framework_idx").on(t.orgId, t.frameworkCode),
  ],
);
