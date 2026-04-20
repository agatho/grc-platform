// Sprint 9b: Supplier Portal & Questionnaire Designer Schema (Drizzle ORM)
// 6 entities: questionnaireTemplate, questionnaireSection, questionnaireQuestion,
// ddSession, ddResponse, ddEvidence

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  numeric,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { vendor } from "./tprm";
import { vendorDueDiligence } from "./tprm";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const questionnaireTemplateStatusEnum = pgEnum(
  "questionnaire_template_status",
  ["draft", "published", "archived"],
);

export const questionTypeEnum = pgEnum("question_type", [
  "single_choice",
  "multi_choice",
  "text",
  "yes_no",
  "number",
  "date",
  "file_upload",
]);

export const ddSessionStatusEnum = pgEnum("dd_session_status", [
  "invited",
  "in_progress",
  "submitted",
  "expired",
  "revoked",
]);

// ──────────────────────────────────────────────────────────────
// 9b.1 QuestionnaireTemplate — Reusable DD questionnaire templates
// ──────────────────────────────────────────────────────────────

export const questionnaireTemplate = pgTable(
  "questionnaire_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    status: questionnaireTemplateStatusEnum("status")
      .notNull()
      .default("draft"),
    targetTier: varchar("target_tier", { length: 50 }),
    targetTopics: text("target_topics").array(),
    scoringModel: jsonb("scoring_model").default("{}"),
    isDefault: boolean("is_default").notNull().default(false),
    totalMaxScore: integer("total_max_score").default(0),
    estimatedMinutes: integer("estimated_minutes").default(30),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("qt_org_idx").on(table.orgId),
    index("qt_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 9b.2 QuestionnaireSection — Sections within a template
// ──────────────────────────────────────────────────────────────

export const questionnaireSection = pgTable(
  "questionnaire_section",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => questionnaireTemplate.id, { onDelete: "cascade" }),
    titleDe: varchar("title_de", { length: 500 }).notNull(),
    titleEn: varchar("title_en", { length: 500 }).notNull(),
    descriptionDe: text("description_de"),
    descriptionEn: text("description_en"),
    sortOrder: integer("sort_order").notNull().default(0),
    weight: numeric("weight", { precision: 5, scale: 2 }).default("1.0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("qs_template_idx").on(table.templateId)],
);

// ──────────────────────────────────────────────────────────────
// 9b.3 QuestionnaireQuestion — Individual questions in a section
// ──────────────────────────────────────────────────────────────

export const questionnaireQuestion = pgTable(
  "questionnaire_question",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => questionnaireSection.id, { onDelete: "cascade" }),
    questionType: questionTypeEnum("question_type").notNull(),
    questionDe: text("question_de").notNull(),
    questionEn: text("question_en").notNull(),
    helpTextDe: text("help_text_de"),
    helpTextEn: text("help_text_en"),
    options: jsonb("options").default("[]"),
    isRequired: boolean("is_required").notNull().default(true),
    isEvidenceRequired: boolean("is_evidence_required")
      .notNull()
      .default(false),
    conditionalOn: jsonb("conditional_on"),
    weight: numeric("weight", { precision: 5, scale: 2 }).default("1.0"),
    maxScore: integer("max_score").default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("qq_section_idx").on(table.sectionId)],
);

// ──────────────────────────────────────────────────────────────
// 9b.4 DdSession — External supplier DD session with token auth
// ──────────────────────────────────────────────────────────────

export const ddSession = pgTable(
  "dd_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id),
    dueDiligenceId: uuid("due_diligence_id").references(
      () => vendorDueDiligence.id,
    ),
    templateId: uuid("template_id")
      .notNull()
      .references(() => questionnaireTemplate.id),
    templateVersion: integer("template_version").notNull(),
    accessToken: varchar("access_token", { length: 128 }).notNull().unique(),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
    }).notNull(),
    tokenUsedAt: timestamp("token_used_at", { withTimezone: true }),
    status: ddSessionStatusEnum("status").notNull().default("invited"),
    language: varchar("language", { length: 2 }).notNull().default("de"),
    progressPercent: integer("progress_percent").notNull().default(0),
    totalScore: integer("total_score"),
    maxPossibleScore: integer("max_possible_score"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    supplierEmail: varchar("supplier_email", { length: 320 }).notNull(),
    supplierName: varchar("supplier_name", { length: 500 }),
    ipAddressLog: text("ip_address_log").array().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("dds_token_idx").on(table.accessToken),
    index("dds_vendor_idx").on(table.vendorId),
    index("dds_org_idx").on(table.orgId),
    index("dds_status_idx").on(table.orgId, table.status),
    index("dds_expiry_idx").on(table.tokenExpiresAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 9b.5 DdResponse — Supplier answers to questionnaire questions
// ──────────────────────────────────────────────────────────────

export const ddResponse = pgTable(
  "dd_response",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => ddSession.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questionnaireQuestion.id),
    answerText: text("answer_text"),
    answerChoice: text("answer_choice").array(),
    answerNumber: numeric("answer_number", { precision: 15, scale: 4 }),
    answerDate: date("answer_date"),
    answerBoolean: boolean("answer_boolean"),
    score: integer("score"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ddr_session_idx").on(table.sessionId),
    uniqueIndex("ddr_session_question_idx").on(
      table.sessionId,
      table.questionId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 9b.6 DdEvidence — File uploads from suppliers
// ──────────────────────────────────────────────────────────────

export const ddEvidence = pgTable(
  "dd_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => ddSession.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").references(() => questionnaireQuestion.id),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    fileType: varchar("file_type", { length: 100 }).notNull(),
    storagePath: varchar("storage_path", { length: 1000 }).notNull(),
    virusScanStatus: varchar("virus_scan_status", { length: 20 }).default(
      "pending",
    ),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("dde_session_idx").on(table.sessionId)],
);
