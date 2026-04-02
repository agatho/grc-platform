// Sprint 71: Predictive Risk Intelligence Types
import type { RadarDataPoint } from "./isms";

export type PredictionModelType = "anomaly_detection" | "trend_forecast" | "correlation" | "score_prediction" | "early_warning";
export type PredictionAlgorithm = "arima" | "prophet" | "isolation_forest" | "random_forest" | "neural_net" | "ensemble";
export type PredictionTargetMetric = "risk_score" | "kri_value" | "incident_count" | "control_effectiveness";
export type PredictionModelStatus = "untrained" | "training" | "active" | "degraded" | "archived";
export type PredictionType = "score_forecast" | "trend" | "threshold_breach" | "correlation";
export type PredictionEntityType = "risk" | "kri" | "control" | "process";
export type PredictiveTrendDirection = "increasing" | "stable" | "decreasing";
export type RiskLevel = "critical" | "high" | "medium" | "low";
export type AnomalyType = "spike" | "drop" | "pattern_break" | "drift" | "outlier";
export type AnomalySeverity = "critical" | "high" | "medium" | "low";
export type AnomalyStatus = "new" | "investigating" | "resolved" | "false_positive";

export interface RiskPredictionModel {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  modelType: PredictionModelType;
  algorithm: PredictionAlgorithm;
  targetMetric: PredictionTargetMetric;
  inputFeatures: InputFeature[];
  hyperparameters: Record<string, unknown>;
  trainingConfig: TrainingConfig;
  accuracy?: number;
  lastTrainedAt?: string;
  trainingSamples: number;
  status: PredictionModelStatus;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InputFeature {
  feature: string;
  source: string;
  weight?: number;
}

export interface TrainingConfig {
  windowDays: number;
  minSamples: number;
  retrainFrequencyDays: number;
}

export interface RiskPrediction {
  id: string;
  modelId: string;
  orgId: string;
  entityType: PredictionEntityType;
  entityId: string;
  predictionType: PredictionType;
  currentValue?: number;
  predictedValue: number;
  confidenceInterval: ConfidenceInterval;
  predictionHorizonDays: number;
  confidence: number;
  trendDirection?: PredictiveTrendDirection;
  trendStrength?: number;
  riskLevel?: RiskLevel;
  earlyWarning: boolean;
  earlyWarningMessage?: string;
  contributingFactors: ContributingFactor[];
  correlatedEntities: CorrelatedEntity[];
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number;
}

export interface ContributingFactor {
  factor: string;
  weight: number;
  direction: "positive" | "negative";
}

export interface CorrelatedEntity {
  entityType: PredictionEntityType;
  entityId: string;
  correlation: number;
}

export interface RiskAnomalyDetection {
  id: string;
  modelId?: string;
  orgId: string;
  entityType: PredictionEntityType;
  entityId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  metricName: string;
  expectedValue?: number;
  actualValue: number;
  deviationPercent?: number;
  anomalyScore: number;
  description: string;
  possibleCauses: string[];
  suggestedActions: string[];
  status: AnomalyStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  detectedAt: string;
  createdAt: string;
}

export interface PredictiveRiskDashboard {
  activeModels: number;
  totalPredictions: number;
  earlyWarnings: number;
  activeAnomalies: number;
  criticalAnomalies: number;
  avgModelAccuracy: number;
  riskRadar: RadarDataPoint[];
  trendChart: TrendDataPoint[];
  topAnomalies: RiskAnomalyDetection[];
  topEarlyWarnings: RiskPrediction[];
}

// RadarDataPoint is defined in isms.ts and re-exported from there
// with optional predictive-risk fields (entityType, entityId, etc.)

export interface TrendDataPoint {
  date: string;
  actual: number;
  predicted: number;
  upper: number;
  lower: number;
}
