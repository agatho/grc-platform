import { z } from "zod";

// Sprint 23: Board KPIs — Zod validation schemas

const riskCategoryValues = [
  "strategic",
  "operational",
  "financial",
  "compliance",
  "cyber",
  "reputational",
  "esg",
] as const;

const assuranceModuleValues = [
  "erm",
  "isms",
  "ics",
  "dpms",
  "audit",
  "tprm",
  "bcms",
  "esg",
] as const;

// ─── Risk Appetite Threshold ─────────────────────────────────

export const createRiskAppetiteThresholdSchema = z.object({
  riskCategory: z.enum(riskCategoryValues),
  maxResidualScore: z.number().int().min(1).max(25),
  maxResidualAle: z.number().nonnegative().optional(),
  escalationRole: z.string().max(50).default("admin"),
  isActive: z.boolean().default(true),
});

export const updateRiskAppetiteThresholdSchema = z.object({
  maxResidualScore: z.number().int().min(1).max(25).optional(),
  maxResidualAle: z.number().nonnegative().nullable().optional(),
  escalationRole: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
});

// ─── Assurance Weight Configuration ──────────────────────────

export const assuranceWeightsSchema = z
  .object({
    evidenceAge: z.number().min(0).max(1),
    testCoverage: z.number().min(0).max(1),
    dataQuality: z.number().min(0).max(1),
    assessmentSource: z.number().min(0).max(1),
    automationLevel: z.number().min(0).max(1),
  })
  .refine(
    (data) => {
      const sum =
        data.evidenceAge +
        data.testCoverage +
        data.dataQuality +
        data.assessmentSource +
        data.automationLevel;
      return Math.abs(sum - 1.0) < 0.01;
    },
    { message: "Weights must sum to 1.0 (100%)" },
  );

// ─── Posture Weight Configuration ────────────────────────────

export const postureWeightsSchema = z
  .object({
    assetCoverage: z.number().min(0).max(1),
    maturity: z.number().min(0).max(1),
    ces: z.number().min(0).max(1),
    vulnExposure: z.number().min(0).max(1),
    incidentTTR: z.number().min(0).max(1),
    freshness: z.number().min(0).max(1),
    soaCompleteness: z.number().min(0).max(1),
  })
  .refine(
    (data) => {
      const sum =
        data.assetCoverage +
        data.maturity +
        data.ces +
        data.vulnExposure +
        data.incidentTTR +
        data.freshness +
        data.soaCompleteness;
      return Math.abs(sum - 1.0) < 0.01;
    },
    { message: "Weights must sum to 1.0 (100%)" },
  );

// ─── Query params ────────────────────────────────────────────

export const assuranceModuleParamSchema = z.object({
  module: z.enum(assuranceModuleValues),
});

export const trendQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});
