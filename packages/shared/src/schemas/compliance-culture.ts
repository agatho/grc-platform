import { z } from "zod";

// Sprint 27: Compliance Culture Index (CCI) Zod Schemas

// ──────────── Factor Keys ────────────

export const cciFactorKeySchema = z.enum([
  "task_compliance",
  "policy_ack_rate",
  "training_completion",
  "incident_response_time",
  "audit_finding_closure",
  "self_assessment_participation",
]);

// ──────────── Factor Weights ────────────

export const cciFactorWeightsSchema = z
  .object({
    task_compliance: z.number().min(0).max(1),
    policy_ack_rate: z.number().min(0).max(1),
    training_completion: z.number().min(0).max(1),
    incident_response_time: z.number().min(0).max(1),
    audit_finding_closure: z.number().min(0).max(1),
    self_assessment_participation: z.number().min(0).max(1),
  })
  .refine(
    (weights) => {
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      return Math.abs(sum - 1.0) < 0.001;
    },
    { message: "Factor weights must sum to 1.0" },
  )
  .refine((weights) => Object.values(weights).every((w) => w >= 0), {
    message: "All weights must be non-negative",
  });

// ──────────── Configuration Update ────────────

export const updateCciConfigurationSchema = z.object({
  factorWeights: cciFactorWeightsSchema,
});

// ──────────── Period Validation ────────────

export const cciPeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be in YYYY-MM format");

// ──────────── History Query ────────────

export const cciHistoryQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});

// ──────────── Department Query ────────────

export const cciDepartmentsQuerySchema = z.object({
  period: cciPeriodSchema.optional(),
});

// ──────────── Cache Invalidation ────────────

export const cacheInvalidateSchema = z.object({
  orgId: z.string().uuid().optional(),
  dashboardType: z.string().max(100).optional(),
});

// ──────────── CCI Trend ────────────

export const cciTrendSchema = z.enum(["up", "down", "stable"]);

// ──────────── Snapshot (for API response validation) ────────────

export const cciSnapshotSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  orgEntityId: z.string().uuid().nullable().optional(),
  period: cciPeriodSchema,
  overallScore: z.number().min(0).max(100),
  factorScores: z.record(z.number().min(0).max(100)),
  factorWeights: z.record(z.number().min(0).max(1)),
  rawMetrics: z.record(
    z.object({
      total: z.number().int().min(0),
      successful: z.number().int().min(0),
    }),
  ),
  trend: cciTrendSchema.nullable().optional(),
  createdAt: z.string(),
});
