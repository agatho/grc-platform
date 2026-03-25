// Sprint 1: Platform Core Schema (Drizzle ORM)
// 7 entities per Data_Model.md §1: organization, user, user_organization_role,
// audit_log, access_log, data_export_log, notification

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  inet,
  integer,
  bigint,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const orgTypeEnum = pgEnum("org_type", [
  "subsidiary",
  "holding",
  "joint_venture",
  "branch",
]);

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "risk_manager",
  "control_owner",
  "auditor",
  "dpo",
  "process_owner",
  "viewer",
]);

export const lineOfDefenseEnum = pgEnum("line_of_defense", [
  "first",
  "second",
  "third",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "restore",
  "status_change",
  "approve",
  "reject",
  "assign",
  "unassign",
  "upload_evidence",
  "delete_evidence",
  "acknowledge",
  "export",
  "bulk_update",
  "comment",
  "link",
  "unlink",
]);

export const accessEventTypeEnum = pgEnum("access_event_type", [
  "login_success",
  "login_failed",
  "logout",
  "token_refresh",
  "password_change",
  "mfa_challenge",
  "mfa_success",
  "mfa_failed",
  "account_locked",
  "sso_login",
  "api_key_used",
  "session_expired",
]);

export const authMethodEnum = pgEnum("auth_method", [
  "password",
  "sso_azure_ad",
  "sso_oidc",
  "api_key",
  "mfa_totp",
  "mfa_webauthn",
]);

export const exportTypeEnum = pgEnum("export_type", [
  "pdf_report",
  "excel_export",
  "csv_export",
  "evidence_download",
  "bulk_export",
  "api_extract",
  "audit_report",
  "emergency_handbook",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "task_assigned",
  "deadline_approaching",
  "escalation",
  "approval_request",
  "status_change",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
  "teams",
  "both",
]);

// ──────────────────────────────────────────────────────────────
// 1.1 Organization — Multi-entity root (G-02, D-10, ADR-001)
// ──────────────────────────────────────────────────────────────

export const organization = pgTable(
  "organization",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    shortName: varchar("short_name", { length: 50 }),
    type: orgTypeEnum("type").notNull().default("subsidiary"),
    country: varchar("country", { length: 3 }).notNull().default("DEU"),
    isEu: boolean("is_eu").notNull().default(true),
    parentOrgId: uuid("parent_org_id").references((): any => organization.id),
    legalForm: varchar("legal_form", { length: 100 }),
    dpoName: varchar("dpo_name", { length: 255 }),
    dpoEmail: varchar("dpo_email", { length: 255 }),
    settings: jsonb("settings").default({}),
    // Sprint 1.2: GDPR & DPO fields
    orgCode: varchar("org_code", { length: 10 }).unique(),
    isDataController: boolean("is_data_controller").notNull().default(false),
    dpoUserId: uuid("dpo_user_id").references(() => user.id),
    supervisoryAuthority: text("supervisory_authority"),
    dataResidency: varchar("data_residency", { length: 2 }),
    gdprSettings: jsonb("gdpr_settings").default({}),
    // Cross-cutting mandatory fields (Data_Model.md §Architecture)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("org_parent_idx").on(table.parentOrgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 1.2 User — Auth.js managed (G-03, G-04, ADR-007 rev.1)
// ──────────────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  passwordHash: varchar("password_hash", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 1000 }),
  ssoProviderId: varchar("sso_provider_id", { length: 255 }),
  language: varchar("language", { length: 5 }).notNull().default("de"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  // Sprint 1.2: notification preferences
  notificationPreferences: jsonb("notification_preferences").default({}),
  // Cross-cutting mandatory fields
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
});

// ──────────────────────────────────────────────────────────────
// 1.3 UserOrganizationRole — User-org-role join (G-03, K-02)
// ──────────────────────────────────────────────────────────────

export const userOrganizationRole = pgTable(
  "user_organization_role",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    role: userRoleEnum("role").notNull(),
    department: varchar("department", { length: 255 }),
    lineOfDefense: lineOfDefenseEnum("line_of_defense"),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("uor_user_idx").on(table.userId),
    index("uor_org_idx").on(table.orgId),
    index("uor_org_role_idx").on(table.orgId, table.role),
  ],
);

// ──────────────────────────────────────────────────────────────
// 1.4 AuditLog — Append-only, hash chain (G-07, ADR-011)
//     NO cross-cutting fields (log table, not entity)
// ──────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organization.id),
    userId: uuid("user_id").references(() => user.id),
    userEmail: varchar("user_email", { length: 255 }),
    userName: varchar("user_name", { length: 255 }),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id"),
    entityTitle: varchar("entity_title", { length: 500 }),
    action: auditActionEnum("action").notNull(),
    actionDetail: varchar("action_detail", { length: 500 }),
    changes: jsonb("changes"),
    metadata: jsonb("metadata"),
    ipAddress: inet("ip_address"),
    userAgent: varchar("user_agent", { length: 500 }),
    sessionId: varchar("session_id", { length: 255 }),
    previousHash: varchar("previous_hash", { length: 64 }),
    entryHash: varchar("entry_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("al_entity_idx").on(table.entityType, table.entityId, table.createdAt),
    index("al_org_idx").on(table.orgId, table.createdAt),
    index("al_user_idx").on(table.userId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 1.5 AccessLog — Append-only auth events (G-04, G-07, A.9.4)
//     NO cross-cutting fields (log table)
// ──────────────────────────────────────────────────────────────

export const accessLog = pgTable(
  "access_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => user.id),
    emailAttempted: varchar("email_attempted", { length: 255 }),
    eventType: accessEventTypeEnum("event_type").notNull(),
    authMethod: authMethodEnum("auth_method"),
    ipAddress: inet("ip_address"),
    userAgent: varchar("user_agent", { length: 500 }),
    geoLocation: varchar("geo_location", { length: 255 }),
    failureReason: varchar("failure_reason", { length: 255 }),
    sessionId: varchar("session_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("acl_user_idx").on(table.userId),
    index("acl_event_idx").on(table.eventType, table.createdAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 1.6 DataExportLog — Download tracking (G-07, GDPR Art.5)
//     NO cross-cutting fields (log table)
// ──────────────────────────────────────────────────────────────

export const dataExportLog = pgTable(
  "data_export_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    exportType: exportTypeEnum("export_type").notNull(),
    entityType: varchar("entity_type", { length: 100 }),
    entityId: uuid("entity_id"),
    description: varchar("description", { length: 500 }),
    recordCount: integer("record_count"),
    containsPersonalData: boolean("contains_personal_data").notNull().default(false),
    fileName: varchar("file_name", { length: 255 }),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    ipAddress: inet("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("del_org_idx").on(table.orgId, table.createdAt),
    index("del_user_idx").on(table.userId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 1.7 Notification — In-app notifications (G-09)
// ──────────────────────────────────────────────────────────────

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    type: notificationTypeEnum("type").notNull(),
    entityType: varchar("entity_type", { length: 100 }),
    entityId: uuid("entity_id"),
    title: varchar("title", { length: 500 }).notNull(),
    message: text("message"),
    isRead: boolean("is_read").notNull().default(false),
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    // Sprint 1.2: email delivery & template fields
    templateKey: varchar("template_key", { length: 100 }),
    templateData: jsonb("template_data").default({}),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    emailMessageId: varchar("email_message_id", { length: 255 }),
    emailError: text("email_error"),
    retryCount: integer("retry_count").notNull().default(0),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("notif_user_unread_idx").on(table.userId, table.isRead),
    index("notif_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 1.8 Invitation — User invitation flow (S1-13)
// ──────────────────────────────────────────────────────────────

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const invitation = pgTable(
  "invitation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    email: varchar("email", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    lineOfDefense: lineOfDefenseEnum("line_of_defense"),
    token: varchar("token", { length: 255 }).notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedBy: uuid("invited_by").references(() => user.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("inv_org_idx").on(table.orgId),
    index("inv_email_idx").on(table.email),
    index("inv_token_idx").on(table.token),
  ],
);

// ──────────────────────────────────────────────────────────────
// Auth.js tables (ADR-007 rev.1) — session/account storage
// ──────────────────────────────────────────────────────────────

export const account = pgTable(
  "account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    idToken: text("id_token"),
    sessionState: varchar("session_state", { length: 255 }),
  },
  (table) => [index("account_user_idx").on(table.userId)],
);

export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [index("session_user_idx").on(table.userId)],
);

export const verificationToken = pgTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
  ],
);
