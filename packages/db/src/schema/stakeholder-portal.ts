// Sprint 83: External Stakeholder Portals
// 6 entities: portal_config, portal_session, portal_questionnaire_response,
// portal_evidence_upload, portal_branding, portal_audit_trail

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

export const portalTypeEnum = pgEnum("portal_type", [
  "vendor",
  "auditor",
  "board_member",
  "whistleblower",
  "custom",
]);

export const portalSessionStatusEnum = pgEnum("portal_session_status", [
  "active",
  "expired",
  "revoked",
  "completed",
]);

export const portalQuestionnaireStatusEnum = pgEnum(
  "portal_questionnaire_status",
  [
    "not_started",
    "in_progress",
    "submitted",
    "reviewed",
    "accepted",
    "rejected",
  ],
);

// ──────────────────────────────────────────────────────────────
// 83.1 PortalConfig — Configuration per portal type per org
// ──────────────────────────────────────────────────────────────

export const portalConfig = pgTable(
  "portal_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    portalType: portalTypeEnum("portal_type").notNull(),
    name: varchar("name", { length: 300 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    requireMfa: boolean("require_mfa").notNull().default(true),
    sessionTimeoutMinutes: integer("session_timeout_minutes")
      .notNull()
      .default(60),
    allowedLanguages: jsonb("allowed_languages")
      .notNull()
      .default(sql`'["de","en"]'::jsonb`),
    accessPermissions: jsonb("access_permissions")
      .notNull()
      .default(sql`'[]'::jsonb`),
    customCss: text("custom_css"),
    welcomeMessage: text("welcome_message"),
    privacyPolicyUrl: varchar("privacy_policy_url", { length: 2000 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("pc_org_idx").on(t.orgId),
    unique("pc_org_type_unique").on(t.orgId, t.portalType),
  ],
);

// ──────────────────────────────────────────────────────────────
// 83.2 PortalSession — Active sessions for external users
// ──────────────────────────────────────────────────────────────

export const portalSession = pgTable(
  "portal_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    portalConfigId: uuid("portal_config_id")
      .notNull()
      .references(() => portalConfig.id),
    externalEmail: varchar("external_email", { length: 500 }).notNull(),
    externalName: varchar("external_name", { length: 300 }),
    externalOrg: varchar("external_org", { length: 300 }),
    accessToken: varchar("access_token", { length: 500 }).notNull(),
    status: portalSessionStatusEnum("status").notNull().default("active"),
    mfaVerified: boolean("mfa_verified").notNull().default(false),
    language: varchar("language", { length: 5 }).notNull().default("de"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ps_org_idx").on(t.orgId),
    index("ps_token_idx").on(t.accessToken),
    index("ps_email_idx").on(t.orgId, t.externalEmail),
    index("ps_status_idx").on(t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 83.3 PortalQuestionnaireResponse — Vendor self-service responses
// ──────────────────────────────────────────────────────────────

export const portalQuestionnaireResponse = pgTable(
  "portal_questionnaire_response",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => portalSession.id),
    questionnaireId: uuid("questionnaire_id").notNull(),
    status: portalQuestionnaireStatusEnum("status")
      .notNull()
      .default("not_started"),
    answersJson: jsonb("answers_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
    progressPct: integer("progress_pct").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("pqr_org_idx").on(t.orgId),
    index("pqr_session_idx").on(t.sessionId),
    index("pqr_status_idx").on(t.orgId, t.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 83.4 PortalEvidenceUpload — Evidence uploaded via portals
// ──────────────────────────────────────────────────────────────

export const portalEvidenceUpload = pgTable(
  "portal_evidence_upload",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => portalSession.id),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 200 }).notNull(),
    storagePath: varchar("storage_path", { length: 2000 }).notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    entityType: varchar("entity_type", { length: 100 }),
    entityId: uuid("entity_id"),
    description: text("description"),
    virusScanStatus: varchar("virus_scan_status", { length: 30 })
      .notNull()
      .default("pending"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("peu_org_idx").on(t.orgId),
    index("peu_session_idx").on(t.sessionId),
    index("peu_entity_idx").on(t.entityType, t.entityId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 83.5 PortalBranding — Custom branding per portal
// ──────────────────────────────────────────────────────────────

export const portalBranding = pgTable(
  "portal_branding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    portalConfigId: uuid("portal_config_id")
      .notNull()
      .references(() => portalConfig.id, { onDelete: "cascade" }),
    logoUrl: varchar("logo_url", { length: 2000 }),
    faviconUrl: varchar("favicon_url", { length: 2000 }),
    primaryColor: varchar("primary_color", { length: 7 })
      .notNull()
      .default("#2563EB"),
    secondaryColor: varchar("secondary_color", { length: 7 })
      .notNull()
      .default("#1E40AF"),
    fontFamily: varchar("font_family", { length: 200 }).default("Inter"),
    headerHtml: text("header_html"),
    footerHtml: text("footer_html"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("pb_org_idx").on(t.orgId),
    unique("pb_portal_unique").on(t.portalConfigId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 83.6 PortalAuditTrail — Audit trail for portal actions
// ──────────────────────────────────────────────────────────────

export const portalAuditTrail = pgTable(
  "portal_audit_trail",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sessionId: uuid("session_id").references(() => portalSession.id),
    portalType: portalTypeEnum("portal_type").notNull(),
    action: varchar("action", { length: 200 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }),
    entityId: uuid("entity_id"),
    ipAddress: varchar("ip_address", { length: 45 }),
    metadataJson: jsonb("metadata_json")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("pat_org_idx").on(t.orgId),
    index("pat_session_idx").on(t.sessionId),
    index("pat_action_idx").on(t.orgId, t.action),
    index("pat_created_idx").on(t.createdAt),
  ],
);
