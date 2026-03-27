import { z } from "zod";

// Sprint 14: Risk & Control Self-Assessment (RCSA) schemas

// ──────────── Campaign ────────────

export const createRcsaCampaignSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frequency: z.enum(["quarterly", "semi_annual", "annual"]),
  targetScope: z.object({
    departments: z.array(z.string()).optional(),
    orgIds: z.array(z.string().uuid()).optional(),
    roles: z.array(z.string()).optional(),
  }),
  cesWeight: z.number().int().min(0).max(50).default(15),
  reminderDaysBefore: z.number().int().min(1).max(30).default(7),
});

export const updateRcsaCampaignSchema = createRcsaCampaignSchema.partial();

export const rcsaCampaignStatusTransitions: Record<string, string[]> = {
  draft: ["active"],
  active: ["closed"],
  closed: ["archived"],
  archived: [],
};

// ──────────── Risk Response ────────────

export const submitRiskResponseSchema = z.object({
  riskStillRelevant: z.boolean(),
  likelihoodAssessment: z.number().int().min(1).max(5),
  impactAssessment: z.number().int().min(1).max(5),
  riskTrend: z.enum(["increasing", "stable", "decreasing"]),
  comment: z.string().max(5000).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  evidenceIds: z.array(z.string().uuid()).max(20).optional(),
});

// ──────────── Control Response ────────────

export const submitControlResponseSchema = z.object({
  controlEffectiveness: z.enum(["effective", "partially_effective", "ineffective"]),
  controlOperating: z.boolean(),
  controlWeaknesses: z.string().max(5000).optional(),
  comment: z.string().max(5000).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  evidenceIds: z.array(z.string().uuid()).max(20).optional(),
});
