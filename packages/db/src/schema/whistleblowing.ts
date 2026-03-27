// Sprint 12: Whistleblowing Module (HinSchG / EU 2019/1937) Schema (Drizzle ORM)
// 5 tables: wbReport, wbCase, wbCaseMessage, wbCaseEvidence, wbAnonymousMailbox

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const wbCategoryEnum = pgEnum("wb_category", [
  "fraud",
  "corruption",
  "discrimination",
  "privacy",
  "environmental",
  "health_safety",
  "other",
]);

export const wbCaseStatusEnum = pgEnum("wb_case_status", [
  "received",
  "acknowledged",
  "investigating",
  "resolved",
  "closed",
]);

export const wbPriorityEnum = pgEnum("wb_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const wbResolutionCategoryEnum = pgEnum("wb_resolution_category", [
  "substantiated",
  "unsubstantiated",
  "inconclusive",
  "referred",
]);

// ──────────────────────────────────────────────────────────────
// 12.1 wbReport — Initial whistleblower submission
// ──────────────────────────────────────────────────────────────

export const wbReport = pgTable(
  "wb_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    reportToken: varchar("report_token", { length: 128 }).notNull().unique(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    category: wbCategoryEnum("category").notNull(),
    description: text("description").notNull(), // AES-256-GCM encrypted
    contactEmail: varchar("contact_email", { length: 320 }), // optional, encrypted
    language: varchar("language", { length: 2 }).notNull().default("de"),
    ipHash: varchar("ip_hash", { length: 64 }), // SHA-256, NOT plaintext
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("wr_org_idx").on(table.orgId),
    uniqueIndex("wr_token_idx").on(table.reportToken),
  ],
);

// ──────────────────────────────────────────────────────────────
// 12.2 wbCase — Case management for ombudsperson
// ──────────────────────────────────────────────────────────────

export const wbCase = pgTable(
  "wb_case",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    reportId: uuid("report_id")
      .notNull()
      .references(() => wbReport.id, { onDelete: "cascade" }),
    caseNumber: varchar("case_number", { length: 20 }).notNull().unique(),
    status: wbCaseStatusEnum("status").notNull().default("received"),
    priority: wbPriorityEnum("priority").default("medium"),
    assignedTo: uuid("assigned_to").references(() => user.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgeDeadline: timestamp("acknowledge_deadline", { withTimezone: true }).notNull(),
    responseDeadline: timestamp("response_deadline", { withTimezone: true }).notNull(),
    resolution: text("resolution"), // encrypted
    resolutionCategory: wbResolutionCategoryEnum("resolution_category"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    index("wc_org_idx").on(table.orgId),
    index("wc_status_idx").on(table.orgId, table.status),
    index("wc_deadline_idx").on(table.acknowledgeDeadline),
  ],
);

// ──────────────────────────────────────────────────────────────
// 12.3 wbCaseMessage — Encrypted message thread
// ──────────────────────────────────────────────────────────────

export const wbCaseMessage = pgTable(
  "wb_case_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => wbCase.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    direction: varchar("direction", { length: 10 }).notNull(), // inbound|outbound
    content: text("content").notNull(), // encrypted
    authorType: varchar("author_type", { length: 20 }).notNull(), // whistleblower|ombudsperson
    authorId: uuid("author_id").references(() => user.id), // null for whistleblower
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("wcm_case_idx").on(table.caseId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 12.4 wbCaseEvidence — Immutable evidence with SHA-256
// ──────────────────────────────────────────────────────────────

export const wbCaseEvidence = pgTable(
  "wb_case_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").references(() => wbCase.id, { onDelete: "cascade" }),
    reportId: uuid("report_id").references(() => wbReport.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    storagePath: varchar("storage_path", { length: 1000 }).notNull(),
    sha256Hash: varchar("sha256_hash", { length: 64 }).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => user.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    isImmutable: boolean("is_immutable").notNull().default(true),
  },
  (table) => [
    index("wce_case_idx").on(table.caseId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 12.5 wbAnonymousMailbox — Token-based mailbox for whistleblower
// ──────────────────────────────────────────────────────────────

export const wbAnonymousMailbox = pgTable(
  "wb_anonymous_mailbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => wbReport.id)
      .unique(),
    token: varchar("token", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    accessCount: integer("access_count").notNull().default(0),
  },
);
