import { z } from "zod";

// Sprint 15: Policy Acknowledgment Portal schemas

// ──────────── Distribution ────────────

export const targetScopeSchema = z.object({
  departments: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  allUsers: z.boolean().default(false),
});

export const quizQuestionSchema = z.object({
  question: z.string().min(1).max(1000),
  options: z.array(z.string().min(1).max(500)).min(2).max(6),
  correctIndex: z.number().int().min(0),
});

export const createDistributionSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().min(1).max(500),
  targetScope: targetScopeSchema,
  deadline: z.string().datetime(),
  isMandatory: z.boolean().default(true),
  requiresQuiz: z.boolean().default(false),
  quizPassThreshold: z.number().int().min(50).max(100).default(80),
  quizQuestions: z.array(quizQuestionSchema).max(10).optional(),
  reminderDaysBefore: z.array(z.number().int().min(1).max(30)).max(5).optional(),
});

export const updateDistributionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  targetScope: targetScopeSchema.optional(),
  deadline: z.string().datetime().optional(),
  isMandatory: z.boolean().optional(),
  requiresQuiz: z.boolean().optional(),
  quizPassThreshold: z.number().int().min(50).max(100).optional(),
  quizQuestions: z.array(quizQuestionSchema).max(10).optional(),
  reminderDaysBefore: z.array(z.number().int().min(1).max(30)).max(5).optional(),
});

export const distributionStatusTransitions: Record<string, string[]> = {
  draft: ["active"],
  active: ["closed"],
  closed: [],
};

// ──────────── Acknowledgment ────────────

export const acknowledgeSchema = z.object({
  quizResponses: z.array(z.object({
    questionIndex: z.number().int().min(0),
    selectedOptionIndex: z.number().int().min(0),
  })).optional(),
  readDurationSeconds: z.number().int().min(0),
});

// Minimum reading time in seconds (anti-gaming)
export const MIN_READ_DURATION_SECONDS = 10;
