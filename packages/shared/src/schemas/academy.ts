import { z } from "zod";

// Sprint 84: GRC Academy und Awareness — Zod schemas

export const academyCourseTypeValues = [
  "gdpr", "info_security", "anti_corruption", "nis2", "dora", "esg", "phishing",
  "code_of_conduct", "aml", "data_classification", "incident_response", "bcm",
  "whistleblowing", "it_security", "custom",
] as const;

export const academyEnrollmentStatusValues = [
  "assigned", "in_progress", "completed", "overdue", "exempted",
] as const;

export const academyLessonTypeValues = [
  "video", "text", "interactive", "quiz", "simulation", "document",
] as const;

// ──────────────────────────────────────────────────────────────
// Course CRUD
// ──────────────────────────────────────────────────────────────

export const createAcademyCourseSchema = z.object({
  courseType: z.enum(academyCourseTypeValues),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  thumbnailUrl: z.string().url().max(2000).optional(),
  durationMinutes: z.number().int().min(1).max(600).default(30),
  passingScorePct: z.number().int().min(1).max(100).default(80),
  isMandatory: z.boolean().default(false),
  validityDays: z.number().int().min(1).max(3650).optional(),
  targetRoles: z.array(z.string().max(100)).max(20).default([]),
  targetDepartments: z.array(z.string().max(200)).max(50).default([]),
  language: z.enum(["de", "en"]).default("de"),
});

export const updateAcademyCourseSchema = createAcademyCourseSchema.partial();

export const listAcademyCoursesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  courseType: z.enum(academyCourseTypeValues).optional(),
  isMandatory: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
});

// ──────────────────────────────────────────────────────────────
// Lesson CRUD
// ──────────────────────────────────────────────────────────────

export const createAcademyLessonSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1).max(500),
  lessonType: z.enum(academyLessonTypeValues),
  contentJson: z.record(z.unknown()).default({}),
  durationMinutes: z.number().int().min(1).max(120).default(10),
  sortOrder: z.number().int().min(0).default(0),
  quizQuestionsJson: z.array(z.object({
    question: z.string().max(2000),
    options: z.array(z.string().max(500)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    explanation: z.string().max(2000).optional(),
  })).max(50).default([]),
});

export const updateAcademyLessonSchema = createAcademyLessonSchema.partial().omit({ courseId: true });

// ──────────────────────────────────────────────────────────────
// Enrollment CRUD
// ──────────────────────────────────────────────────────────────

export const createAcademyEnrollmentSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  dueDate: z.string().datetime().optional(),
});

export const bulkEnrollSchema = z.object({
  courseId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1).max(100),
  dueDate: z.string().datetime().optional(),
});

export const updateEnrollmentProgressSchema = z.object({
  lessonId: z.string().uuid(),
  progressPct: z.number().int().min(0).max(100),
});

export const listEnrollmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  courseId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.enum(academyEnrollmentStatusValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Quiz Attempt
// ──────────────────────────────────────────────────────────────

export const submitQuizAttemptSchema = z.object({
  enrollmentId: z.string().uuid(),
  lessonId: z.string().uuid(),
  answersJson: z.array(z.object({
    questionIndex: z.number().int().min(0),
    selectedIndex: z.number().int().min(0),
  })).max(100),
  durationSeconds: z.number().int().min(0).optional(),
});

// ──────────────────────────────────────────────────────────────
// Dashboard
// ──────────────────────────────────────────────────────────────

export const academyDashboardQuerySchema = z.object({
  timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
});

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type CreateAcademyCourseInput = z.infer<typeof createAcademyCourseSchema>;
export type CreateAcademyLessonInput = z.infer<typeof createAcademyLessonSchema>;
export type CreateAcademyEnrollmentInput = z.infer<typeof createAcademyEnrollmentSchema>;
export type BulkEnrollInput = z.infer<typeof bulkEnrollSchema>;
export type SubmitQuizAttemptInput = z.infer<typeof submitQuizAttemptSchema>;
