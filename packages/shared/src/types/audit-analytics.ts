// Sprint 33: Audit Data Analytics + Predictive Risk Intelligence Types

// ──────────────────────────────────────────────────────────────
// Analysis Types
// ──────────────────────────────────────────────────────────────

export type AnalysisType =
  | "benford"
  | "duplicate"
  | "three_way_match"
  | "outlier"
  | "sample";

// ──────────────────────────────────────────────────────────────
// Sampling Methods
// ──────────────────────────────────────────────────────────────

export type SamplingMethod = "random" | "mus";

// ──────────────────────────────────────────────────────────────
// Outlier Methods
// ──────────────────────────────────────────────────────────────

export type OutlierMethod = "zscore" | "iqr";

// ──────────────────────────────────────────────────────────────
// Column Schema
// ──────────────────────────────────────────────────────────────

export interface ColumnSchema {
  columnName: string;
  dataType: "text" | "number" | "date" | "boolean";
  sampleValues: string[];
}

// ──────────────────────────────────────────────────────────────
// Audit Analytics Import
// ──────────────────────────────────────────────────────────────

export interface AuditAnalyticsImport {
  id: string;
  orgId: string;
  auditId: string | null;
  name: string;
  fileName: string;
  schemaJson: ColumnSchema[];
  rowCount: number;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
}

// ──────────────────────────────────────────────────────────────
// Analysis Summary
// ──────────────────────────────────────────────────────────────

export interface AnalysisSummary {
  flaggedCount: number;
  totalAnalyzed: number;
  significance: boolean;
}

// ──────────────────────────────────────────────────────────────
// Audit Analytics Result
// ──────────────────────────────────────────────────────────────

export interface AuditAnalyticsResult {
  id: string;
  orgId: string;
  importId: string;
  analysisType: AnalysisType;
  configJson: Record<string, unknown>;
  resultJson: Record<string, unknown>;
  summaryJson: AnalysisSummary;
  findingId: string | null;
  createdBy: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────
// Benford Result
// ──────────────────────────────────────────────────────────────

export interface BenfordDigitResult {
  digit: number;
  observed: number;
  expected: number;
}

export interface BenfordResult {
  observed: BenfordDigitResult[];
  chiSquared: number;
  pValue: number;
  significant: boolean;
  flaggedDigits: Array<{ digit: number; deviation: number }>;
}

// ──────────────────────────────────────────────────────────────
// Duplicate Result
// ──────────────────────────────────────────────────────────────

export interface DuplicatePair {
  rowA: number;
  rowB: number;
  similarity: number;
  matchedFields: string[];
}

// ──────────────────────────────────────────────────────────────
// MUS Sample Result
// ──────────────────────────────────────────────────────────────

export interface SampleResult {
  selectedRows: number[];
  interval: number;
  totalAmount: number;
  sampleSize: number;
  method: SamplingMethod;
}

// ──────────────────────────────────────────────────────────────
// Outlier Result
// ──────────────────────────────────────────────────────────────

export interface OutlierResult {
  outlierRows: number[];
  method: OutlierMethod;
  threshold: number;
  mean: number;
  stdDev: number;
}

// ──────────────────────────────────────────────────────────────
// Analytics Template
// ──────────────────────────────────────────────────────────────

export interface AuditAnalyticsTemplate {
  id: string;
  orgId: string | null;
  name: string;
  analysisType: AnalysisType;
  configJson: Record<string, unknown>;
  description: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────
// Risk Prediction
// ──────────────────────────────────────────────────────────────

export interface RiskFeatures {
  scoreTrend: number;
  kriMomentum: number;
  incidentFrequency: number;
  findingBacklog: number;
  controlEffectiveness: number;
  daysSinceReview: number;
}

export interface PredictionFactor {
  factor: string;
  description: string;
  weight: number;
}

export interface RiskPrediction {
  id: string;
  orgId: string;
  riskId: string;
  predictionHorizonDays: number;
  escalationProbability: string;
  predictedScore: string | null;
  featuresJson: RiskFeatures;
  topFactorsJson: PredictionFactor[];
  modelVersion: string;
  confidence: string | null;
  computedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Prediction Model
// ──────────────────────────────────────────────────────────────

export interface TrainingMetrics {
  mae: number;
  rmse: number;
  r2: number;
  sampleSize: number;
}

export interface RiskPredictionModel {
  id: string;
  orgId: string;
  version: string;
  algorithm: string;
  featureImportanceJson: Record<string, number>;
  trainingMetrics: TrainingMetrics;
  trainedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Prediction Alert
// ──────────────────────────────────────────────────────────────

export interface RiskPredictionAlert {
  id: string;
  orgId: string;
  riskId: string;
  predictionId: string;
  probability: string;
  notified: boolean;
  createdAt: string;
}
