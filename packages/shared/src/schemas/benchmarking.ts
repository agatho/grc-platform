import { z } from "zod";

// Sprint 78: GRC Benchmarking und Maturity Model — Zod schemas

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const maturityLevelValues = [
  "initial", "managed", "defined", "quantitatively_managed", "optimizing",
] as const;

export const maturityModuleKeyValues = [
  "erm", "isms", "bcms", "dpms", "audit", "ics", "esg", "tprm", "bpm", "overall",
] as const;

export const maturityAssessmentStatusValues = [
  "draft", "in_progress", "completed", "approved",
] as const;

export const roadmapItemStatusValues = [
  "planned", "in_progress", "completed", "deferred",
] as const;

export const roadmapItemPriorityValues = [
  "critical", "high", "medium", "low",
] as const;

export const benchmarkIndustryValues = [
  "financial_services", "healthcare", "manufacturing", "technology",
  "energy", "retail", "public_sector", "insurance", "automotive", "other",
] as const;

// ──────────────────────────────────────────────────────────────
// Maturity Model CRUD
// ──────────────────────────────────────────────────────────────

export const createMaturityModelSchema = z.object({
  moduleKey: z.enum(maturityModuleKeyValues),
  currentLevel: z.enum(maturityLevelValues).default("initial"),
  targetLevel: z.enum(maturityLevelValues).optional(),
  targetDate: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
});

export const updateMaturityModelSchema = createMaturityModelSchema.partial().omit({ moduleKey: true });

export const listMaturityModelsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  moduleKey: z.enum(maturityModuleKeyValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Maturity Assessment CRUD
// ──────────────────────────────────────────────────────────────

export const createMaturityAssessmentSchema = z.object({
  moduleKey: z.enum(maturityModuleKeyValues),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  criteriaScores: z.array(z.object({
    criterionId: z.string().max(100),
    criterionName: z.string().max(300),
    score: z.number().min(0).max(5),
    evidence: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
  })).max(100).default([]),
});

export const updateMaturityAssessmentSchema = z.object({
  status: z.enum(maturityAssessmentStatusValues).optional(),
  overallScore: z.number().min(0).max(5).optional(),
  level: z.enum(maturityLevelValues).optional(),
  criteriaScores: z.array(z.object({
    criterionId: z.string().max(100),
    criterionName: z.string().max(300),
    score: z.number().min(0).max(5),
    evidence: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
  })).max(100).optional(),
  findings: z.array(z.object({
    title: z.string().max(500),
    description: z.string().max(2000),
    severity: z.enum(["critical", "high", "medium", "low"]),
  })).max(50).optional(),
  recommendations: z.array(z.object({
    title: z.string().max(500),
    description: z.string().max(2000),
    priority: z.enum(["critical", "high", "medium", "low"]),
  })).max(50).optional(),
});

export const listMaturityAssessmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  moduleKey: z.enum(maturityModuleKeyValues).optional(),
  status: z.enum(maturityAssessmentStatusValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Maturity Roadmap Item CRUD
// ──────────────────────────────────────────────────────────────

export const createMaturityRoadmapItemSchema = z.object({
  moduleKey: z.enum(maturityModuleKeyValues),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  fromLevel: z.enum(maturityLevelValues),
  toLevel: z.enum(maturityLevelValues),
  priority: z.enum(roadmapItemPriorityValues).default("medium"),
  assigneeId: z.string().uuid().optional(),
  estimatedEffortDays: z.number().int().min(1).max(365).optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateMaturityRoadmapItemSchema = createMaturityRoadmapItemSchema.partial().extend({
  status: z.enum(roadmapItemStatusValues).optional(),
});

export const listMaturityRoadmapItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  moduleKey: z.enum(maturityModuleKeyValues).optional(),
  status: z.enum(roadmapItemStatusValues).optional(),
  priority: z.enum(roadmapItemPriorityValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Benchmark CRUD
// ──────────────────────────────────────────────────────────────

export const submitBenchmarkSchema = z.object({
  moduleKey: z.enum(maturityModuleKeyValues),
  industry: z.enum(benchmarkIndustryValues),
  orgSizeRange: z.string().min(1).max(50),
  consentGiven: z.boolean().refine((val) => val === true, { message: "Consent must be given" }),
});

export const listBenchmarksQuerySchema = z.object({
  moduleKey: z.enum(maturityModuleKeyValues).optional(),
  industry: z.enum(benchmarkIndustryValues).optional(),
  orgSizeRange: z.string().max(50).optional(),
  periodLabel: z.string().max(50).optional(),
});

// ──────────────────────────────────────────────────────────────
// Maturity Scorecard
// ──────────────────────────────────────────────────────────────

export const maturityScorecardQuerySchema = z.object({
  includeHistory: z.coerce.boolean().default(false),
  compareBenchmark: z.coerce.boolean().default(false),
  industry: z.enum(benchmarkIndustryValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type CreateMaturityModelInput = z.infer<typeof createMaturityModelSchema>;
export type UpdateMaturityModelInput = z.infer<typeof updateMaturityModelSchema>;
export type CreateMaturityAssessmentInput = z.infer<typeof createMaturityAssessmentSchema>;
export type UpdateMaturityAssessmentInput = z.infer<typeof updateMaturityAssessmentSchema>;
export type CreateMaturityRoadmapItemInput = z.infer<typeof createMaturityRoadmapItemSchema>;
export type SubmitBenchmarkInput = z.infer<typeof submitBenchmarkSchema>;
