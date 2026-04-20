import { z } from "zod";

// Sprint 71: Predictive Risk Intelligence Zod Schemas

// ─── Risk Prediction Model ───────────────────────────────────

export const createPredictionModelSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  modelType: z.enum([
    "anomaly_detection",
    "trend_forecast",
    "correlation",
    "score_prediction",
    "early_warning",
  ]),
  algorithm: z.enum([
    "arima",
    "prophet",
    "isolation_forest",
    "random_forest",
    "neural_net",
    "ensemble",
  ]),
  targetMetric: z.enum([
    "risk_score",
    "kri_value",
    "incident_count",
    "control_effectiveness",
  ]),
  inputFeatures: z
    .array(
      z.object({
        feature: z.string().min(1).max(200),
        source: z.string().min(1).max(200),
        weight: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1)
    .max(50),
  hyperparameters: z.record(z.unknown()).optional(),
  trainingConfig: z
    .object({
      windowDays: z.number().int().min(7).max(730).default(365),
      minSamples: z.number().int().min(10).max(100000).default(100),
      retrainFrequencyDays: z.number().int().min(1).max(90).default(7),
    })
    .optional(),
});

export const updatePredictionModelSchema = createPredictionModelSchema
  .partial()
  .omit({ modelType: true, algorithm: true });

export const predictionModelQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  modelType: z
    .enum([
      "anomaly_detection",
      "trend_forecast",
      "correlation",
      "score_prediction",
      "early_warning",
    ])
    .optional(),
  status: z
    .enum(["untrained", "training", "active", "degraded", "archived"])
    .optional(),
  isActive: z.coerce.boolean().optional(),
});

// ─── Train Model ─────────────────────────────────────────────

export const trainModelSchema = z.object({
  modelId: z.string().uuid(),
  algorithm: z.string().min(1).max(50).default("linear"),
  forceRetrain: z.boolean().default(false),
});

// ─── Risk Prediction ─────────────────────────────────────────

export const predictionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entityType: z.enum(["risk", "kri", "control", "process"]).optional(),
  entityId: z.string().uuid().optional(),
  riskLevel: z.enum(["critical", "high", "medium", "low"]).optional(),
  earlyWarning: z.coerce.boolean().optional(),
  modelId: z.string().uuid().optional(),
  predictionType: z
    .enum(["score_forecast", "trend", "threshold_breach", "correlation"])
    .optional(),
});

export const generatePredictionsSchema = z.object({
  modelId: z.string().uuid(),
  entityType: z.enum(["risk", "kri", "control", "process"]),
  entityIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  horizonDays: z.number().int().min(1).max(365).default(30),
});

// ─── Anomaly Detection ───────────────────────────────────────

export const anomalyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entityType: z.enum(["risk", "kri", "control", "process"]).optional(),
  entityId: z.string().uuid().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z
    .enum(["new", "investigating", "resolved", "false_positive"])
    .optional(),
  anomalyType: z
    .enum(["spike", "drop", "pattern_break", "drift", "outlier"])
    .optional(),
});

export const updateAnomalySchema = z.object({
  status: z.enum(["investigating", "resolved", "false_positive"]),
  resolutionNote: z.string().max(5000).optional(),
});

// ─── Radar Dashboard ─────────────────────────────────────────

export const radarQuerySchema = z.object({
  horizonDays: z.coerce.number().int().min(7).max(365).default(30),
  entityTypes: z
    .array(z.enum(["risk", "kri", "control", "process"]))
    .optional(),
  minRiskLevel: z.enum(["critical", "high", "medium", "low"]).optional(),
});

// ─── Correlation Analysis ────────────────────────────────────

export const correlationQuerySchema = z.object({
  entityType: z.enum(["risk", "kri", "control", "process"]),
  entityId: z.string().uuid(),
  depth: z.coerce.number().int().min(1).max(3).default(2),
  minCorrelation: z.coerce.number().min(0).max(1).default(0.5),
});
