// Sprint 84: GRC Academy und Awareness
// 5 entities: academy_course, academy_lesson, academy_enrollment,
// academy_quiz_attempt, academy_certificate

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
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const academyCourseTypeEnum = pgEnum("academy_course_type", [
  "gdpr",
  "info_security",
  "anti_corruption",
  "nis2",
  "dora",
  "esg",
  "phishing",
  "code_of_conduct",
  "aml",
  "data_classification",
  "incident_response",
  "bcm",
  "whistleblowing",
  "it_security",
  "custom",
]);

export const academyEnrollmentStatusEnum = pgEnum("academy_enrollment_status", [
  "assigned",
  "in_progress",
  "completed",
  "overdue",
  "exempted",
]);

export const academyLessonTypeEnum = pgEnum("academy_lesson_type", [
  "video",
  "text",
  "interactive",
  "quiz",
  "simulation",
  "document",
]);

// ──────────────────────────────────────────────────────────────
// 84.1 AcademyCourse — Training course definitions
// ──────────────────────────────────────────────────────────────

export const academyCourse = pgTable(
  "academy_course",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    courseType: academyCourseTypeEnum("course_type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    thumbnailUrl: varchar("thumbnail_url", { length: 2000 }),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    passingScorePct: integer("passing_score_pct").notNull().default(80),
    isMandatory: boolean("is_mandatory").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    validityDays: integer("validity_days"),
    targetRoles: jsonb("target_roles").notNull().default(sql`'[]'::jsonb`),
    targetDepartments: jsonb("target_departments").notNull().default(sql`'[]'::jsonb`),
    contentJson: jsonb("content_json").notNull().default(sql`'{}'::jsonb`),
    language: varchar("language", { length: 5 }).notNull().default("de"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ac_org_idx").on(t.orgId),
    index("ac_type_idx").on(t.orgId, t.courseType),
    index("ac_mandatory_idx").on(t.orgId, t.isMandatory),
  ],
);

// ──────────────────────────────────────────────────────────────
// 84.2 AcademyLesson — Lessons within a course
// ──────────────────────────────────────────────────────────────

export const academyLesson = pgTable(
  "academy_lesson",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => academyCourse.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    lessonType: academyLessonTypeEnum("lesson_type").notNull(),
    contentJson: jsonb("content_json").notNull().default(sql`'{}'::jsonb`),
    durationMinutes: integer("duration_minutes").notNull().default(10),
    sortOrder: integer("sort_order").notNull().default(0),
    quizQuestionsJson: jsonb("quiz_questions_json").notNull().default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("al_org_idx").on(t.orgId),
    index("al_course_idx").on(t.courseId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 84.3 AcademyEnrollment — User training assignments
// ──────────────────────────────────────────────────────────────

export const academyEnrollment = pgTable(
  "academy_enrollment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => academyCourse.id),
    status: academyEnrollmentStatusEnum("status").notNull().default("assigned"),
    progressPct: integer("progress_pct").notNull().default(0),
    completedLessons: jsonb("completed_lessons").notNull().default(sql`'[]'::jsonb`),
    lastLessonId: uuid("last_lesson_id"),
    assignedBy: uuid("assigned_by").references(() => user.id),
    dueDate: timestamp("due_date", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ae_org_idx").on(t.orgId),
    index("ae_user_idx").on(t.userId),
    index("ae_course_idx").on(t.courseId),
    index("ae_status_idx").on(t.orgId, t.status),
    unique("ae_user_course").on(t.userId, t.courseId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 84.4 AcademyQuizAttempt — Quiz attempt results
// ──────────────────────────────────────────────────────────────

export const academyQuizAttempt = pgTable(
  "academy_quiz_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => academyEnrollment.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => academyLesson.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    answersJson: jsonb("answers_json").notNull().default(sql`'[]'::jsonb`),
    scorePct: integer("score_pct").notNull(),
    passed: boolean("passed").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aqa_org_idx").on(t.orgId),
    index("aqa_enrollment_idx").on(t.enrollmentId),
    index("aqa_user_idx").on(t.userId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 84.5 AcademyCertificate — Certificates for completed courses
// ──────────────────────────────────────────────────────────────

export const academyCertificate = pgTable(
  "academy_certificate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => academyEnrollment.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => academyCourse.id),
    certificateNumber: varchar("certificate_number", { length: 100 }).notNull(),
    pdfUrl: varchar("pdf_url", { length: 2000 }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    verificationHash: varchar("verification_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("acrt_org_idx").on(t.orgId),
    index("acrt_user_idx").on(t.userId),
    index("acrt_enrollment_idx").on(t.enrollmentId),
    unique("acrt_number_unique").on(t.certificateNumber),
  ],
);
