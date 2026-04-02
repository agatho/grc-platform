import { z } from "zod";

// Sprint 33: Audit Data Analytics + Predictive Risk Intelligence Zod schemas

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const analysisTypeValues = [
  "benford",
  "duplicate",
  "three_way_match",
  "outlier",
  "sample",
] as const;

export const samplingMethodValues = ["random", "mus"] as const;
export const outlierMethodValues = ["zscore", "iqr"] as const;

// ──────────────────────────────────────────────────────────────
// Import
// ──────────────────────────────────────────────────────────────

export const createAnalyticsImportSchema = z.object({
  name: z.string().min(1).max(500),
  fileName: z.string().min(1).max(500),
  auditId: z.string().uuid().optional(),
  schemaJson: z.array(
    z.object({
      columnName: z.string().max(200),
      dataType: z.enum(["text", "number", "date", "boolean"]),
      sampleValues: z.array(z.string().max(500)).max(5),
    }),
  ),
  rowCount: z.number().int().min(1).max(50000),
  dataJson: z.array(z.record(z.unknown())).max(50000),
});

// ──────────────────────────────────────────────────────────────
// Analysis
// ──────────────────────────────────────────────────────────────

export const runAnalysisSchema = z.object({
  analysisType: z.enum(analysisTypeValues),
  config: z.object({
    field: z.string().max(200).optional(),
    matchFields: z.array(z.string().max(200)).max(20).optional(),
    threshold: z.number().min(0).max(100).optional(),
    minCount: z.number().int().min(1).optional(),
    method: z.enum([...outlierMethodValues, ...samplingMethodValues]).optional(),
    sampleSize: z.number().int().min(1).max(10000).optional(),
    amountField: z.string().max(200).optional(),
  }),
});

// ──────────────────────────────────────────────────────────────
// Finding Creation
// ──────────────────────────────────────────────────────────────

export const createFindingFromAnalysisSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Prediction
// ──────────────────────────────────────────────────────────────

export const trainAuditAnalyticsModelSchema = z.object({
  algorithm: z.enum(["linear_regression", "arima"]).optional().default("linear_regression"),
});
