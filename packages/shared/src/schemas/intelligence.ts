import { z } from "zod";

// Sprint 11: CCM + AI Intelligence schemas

const cesTrendValues = ["improving", "stable", "declining"] as const;

// ─── Finding SLA Config ─────────────────────────────────────────

export const updateFindingSlaConfigSchema = z.object({
  configs: z.array(
    z.object({
      severity: z.string().min(1).max(50),
      slaDays: z.number().int().min(1).max(365),
    }),
  ).min(1),
});

// ─── CES Recompute Request ─────────────────────────────────────

export const cesRecomputeSchema = z.object({
  controlIds: z.array(z.string().uuid()).optional(),
});

// ─── Regulatory Feed Query ─────────────────────────────────────

export const regulatoryFeedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  source: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  jurisdiction: z.string().max(100).optional(),
  framework: z.string().max(100).optional(),
  since: z.string().datetime().optional(),
});

// ─── AI Prompt Log Entry (internal) ────────────────────────────

export const createAiPromptLogSchema = z.object({
  promptTemplate: z.string().min(1).max(100),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  model: z.string().min(1).max(50),
  latencyMs: z.number().int().min(0),
  costUsd: z.number().min(0).optional(),
  cachedResult: z.boolean().default(false),
});

// ─── AI Control Suggestions Request ────────────────────────────

export const aiControlSuggestionsSchema = z.object({
  riskId: z.string().uuid(),
});

// ─── AI RCM Gap Analysis Request ───────────────────────────────

export const aiRcmGapAnalysisSchema = z.object({
  scope: z.enum(["all", "high_risk", "unlinked"]).default("all"),
});

// ─── AI Root Cause Patterns Request ────────────────────────────

export const aiRootCausePatternsSchema = z.object({
  period: z.enum(["3m", "6m", "12m"]).default("12m"),
});

// ─── AI Test Plan Request ──────────────────────────────────────

export const aiTestPlanSchema = z.object({
  controlId: z.string().uuid(),
});

// ─── AI Usage Query ────────────────────────────────────────────

export const aiUsageQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ─── Executive Dashboard Query ─────────────────────────────────

export const executiveTrendQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});
