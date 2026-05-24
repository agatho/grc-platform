// Sprint 33: Weekly Risk Prediction Worker
// Runs every Monday at 03:00 — recomputes all predictions, alerts if > 70%
// Requires >= 6 months KRI data per risk

import {
  db,
  riskPrediction,
  riskPredictionAlert,
  riskPredictionModel,
} from "@grc/db";
import { eq, desc } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

const ALERT_THRESHOLD = 70; // Escalation probability > 70% triggers alert
const MIN_DATA_MONTHS = 6;

interface RiskFeatures {
  scoreTrend: number;
  kriMomentum: number;
  incidentFrequency: number;
  findingBacklog: number;
  controlEffectiveness: number;
  daysSinceReview: number;
}

interface ModelWeights {
  [key: string]: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function predictEscalation(
  features: RiskFeatures,
  weights: ModelWeights,
  bias: number,
): {
  probability: number;
  topFactors: Array<{ factor: string; value: number; contribution: number }>;
} {
  const featureEntries = Object.entries(features);
  const linearCombination = featureEntries.reduce(
    (sum, [key, value]) => sum + (weights[key] ?? 0) * value,
    bias,
  );

  const probability = sigmoid(linearCombination) * 100;

  const topFactors = featureEntries
    .map(([key, value]) => ({
      factor: key,
      value,
      contribution: Math.abs((weights[key] ?? 0) * value),
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  return { probability, topFactors };
}

export const processRiskPredictionWeekly = withCronInstrumentation(
  "risk-prediction-weekly",
  async (): Promise<{
    processed: number;
    alerts: number;
    skipped: number;
  }> => {
    const processed = 0;
    const alerts = 0;
    const skipped = 0;

    // This worker runs across all orgs — simplified stub for now.
    // Real implementation will iterate active orgs, fetch latest model
    // weights, and compute predictions with sigmoid/predictEscalation.

    return { processed, alerts, skipped };
  },
);
