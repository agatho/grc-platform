import { z } from "zod";

// Sprint 79: Unified Risk Quantification Dashboard — Zod schemas

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const rqMethodologyValues = ["fair", "monte_carlo", "qualitative", "hybrid"] as const;
export const rqCalculationStatusValues = ["pending", "running", "completed", "failed"] as const;
export const rqAppetiteStatusValues = [
  "within_appetite", "approaching_limit", "exceeds_appetite", "critical",
] as const;
export const rqSummaryStatusValues = ["draft", "final", "archived"] as const;

// ──────────────────────────────────────────────────────────────
// Risk Quantification Config
// ──────────────────────────────────────────────────────────────

export const upsertRiskQuantConfigSchema = z.object({
  methodology: z.enum(rqMethodologyValues).default("hybrid"),
  defaultIterations: z.number().int().min(1000).max(100000).default(10000),
  confidenceLevel: z.number().min(0.5).max(0.999).default(0.95),
  currencyCode: z.string().length(3).default("EUR"),
  aggregationMethod: z.string().max(50).default("sum"),
  includeCorrelations: z.boolean().default(false),
  correlationMatrix: z.record(z.record(z.number().min(-1).max(1))).optional(),
});

// ──────────────────────────────────────────────────────────────
// VaR Calculation
// ──────────────────────────────────────────────────────────────

export const triggerVarCalculationSchema = z.object({
  entityLabel: z.string().max(300).optional(),
  methodology: z.enum(rqMethodologyValues).optional(),
  iterations: z.number().int().min(1000).max(100000).optional(),
  riskIds: z.array(z.string().uuid()).max(500).optional(),
});

export const listVarCalculationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(rqCalculationStatusValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Risk Appetite Threshold
// ──────────────────────────────────────────────────────────────

export const createRiskAppetiteThresholdSchema = z.object({
  name: z.string().min(1).max(300),
  category: z.string().max(100).optional(),
  appetiteAmount: z.number().min(0),
  toleranceAmount: z.number().min(0).optional(),
  alertEnabled: z.boolean().default(true),
});

export const updateRiskAppetiteThresholdSchema = createRiskAppetiteThresholdSchema.partial();

export const listRiskAppetiteThresholdsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(rqAppetiteStatusValues).optional(),
  category: z.string().max(100).optional(),
});

// ──────────────────────────────────────────────────────────────
// Sensitivity Analysis
// ──────────────────────────────────────────────────────────────

export const createSensitivityAnalysisSchema = z.object({
  varCalculationId: z.string().uuid().optional(),
  name: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  scenariosJson: z.array(z.object({
    parameter: z.string().max(200),
    label: z.string().max(300),
    lowValue: z.number(),
    highValue: z.number(),
  })).max(50).default([]),
});

export const listSensitivityAnalysesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  varCalculationId: z.string().uuid().optional(),
});

// ──────────────────────────────────────────────────────────────
// Executive Summary
// ──────────────────────────────────────────────────────────────

export const createRiskExecutiveSummarySchema = z.object({
  title: z.string().min(1).max(500),
  periodLabel: z.string().max(100).optional(),
  executiveSummary: z.string().max(10000).optional(),
  topRisks: z.array(z.object({
    riskId: z.string().uuid(),
    title: z.string().max(500),
    exposure: z.number(),
    trend: z.enum(["up", "down", "stable"]),
  })).max(20).default([]),
  keyMetrics: z.record(z.unknown()).default({}),
  recommendations: z.array(z.object({
    title: z.string().max(500),
    description: z.string().max(2000),
    priority: z.enum(["critical", "high", "medium", "low"]),
  })).max(20).default([]),
});

export const updateRiskExecutiveSummarySchema = createRiskExecutiveSummarySchema.partial().extend({
  status: z.enum(rqSummaryStatusValues).optional(),
});

export const listRiskExecutiveSummariesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(rqSummaryStatusValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Board Export
// ──────────────────────────────────────────────────────────────

export const exportBoardPresentationSchema = z.object({
  summaryId: z.string().uuid(),
  format: z.enum(["pptx", "pdf"]).default("pptx"),
  includeCharts: z.boolean().default(true),
  language: z.enum(["de", "en"]).default("de"),
});

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type UpsertRiskQuantConfigInput = z.infer<typeof upsertRiskQuantConfigSchema>;
export type TriggerVarCalculationInput = z.infer<typeof triggerVarCalculationSchema>;
export type CreateRiskAppetiteThresholdInput = z.infer<typeof createRiskAppetiteThresholdSchema>;
export type CreateSensitivityAnalysisInput = z.infer<typeof createSensitivityAnalysisSchema>;
export type CreateRiskExecutiveSummaryInput = z.infer<typeof createRiskExecutiveSummarySchema>;
export type ExportBoardPresentationInput = z.infer<typeof exportBoardPresentationSchema>;
