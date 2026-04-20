// Sprint 15: Policy Acknowledgment Portal Schema (Drizzle ORM)
// 3 entities: policyDistribution, policyAcknowledgment, policyQuizResponse
// Enhancement on DMS (Sprint 4) — no separate module

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";
import { document } from "./document";

// ──────────────────────────────────────────────────────────────
// 15.1 PolicyDistribution — Distribution of a policy document
// ──────────────────────────────────────────────────────────────

export const policyDistribution = pgTable(
  "policy_distribution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id),
    documentVersion: integer("document_version").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    targetScope: jsonb("target_scope").notNull(), // { departments: [], roles: [], userIds: [], allUsers: false }
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    requiresQuiz: boolean("requires_quiz").notNull().default(false),
    quizPassThreshold: integer("quiz_pass_threshold").default(80),
    quizQuestions: jsonb("quiz_questions").default(sql`'[]'::jsonb`), // [{ question, options: [], correctIndex }]
    reminderDaysBefore: jsonb("reminder_days_before").default(
      sql`'[7, 3, 1]'::jsonb`,
    ),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | active | closed
    distributedAt: timestamp("distributed_at", { withTimezone: true }),
    distributedBy: uuid("distributed_by").references(() => user.id),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pd_org_idx").on(table.orgId),
    index("pd_doc_idx").on(table.documentId),
    index("pd_status_idx").on(table.orgId, table.status),
    index("pd_deadline_idx").on(table.orgId, table.deadline),
  ],
);

// ──────────────────────────────────────────────────────────────
// 15.2 PolicyAcknowledgment — Individual user acknowledgment
// ──────────────────────────────────────────────────────────────

export const policyAcknowledgment = pgTable(
  "policy_acknowledgment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    distributionId: uuid("distribution_id")
      .notNull()
      .references(() => policyDistribution.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | acknowledged | overdue | failed_quiz
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    signatureHash: varchar("signature_hash", { length: 128 }),
    quizScore: integer("quiz_score"),
    quizPassed: boolean("quiz_passed"),
    readDurationSeconds: integer("read_duration_seconds"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    remindersSent: integer("reminders_sent").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("pa_dist_user_idx").on(table.distributionId, table.userId),
    index("pa_user_idx").on(table.userId, table.status),
    index("pack_org_idx").on(table.orgId),
    index("pa_org_status_idx").on(table.orgId, table.status),
  ],
);

// ──────────────────────────────────────────────────────────────
// 15.3 PolicyQuizResponse — Individual quiz answers
// ──────────────────────────────────────────────────────────────

export const policyQuizResponse = pgTable(
  "policy_quiz_response",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    acknowledgmentId: uuid("acknowledgment_id")
      .notNull()
      .references(() => policyAcknowledgment.id, { onDelete: "cascade" }),
    questionIndex: integer("question_index").notNull(),
    selectedOptionIndex: integer("selected_option_index").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pqr_ack_idx").on(table.acknowledgmentId),
    index("pqra_org_idx").on(table.orgId),
  ],
);
