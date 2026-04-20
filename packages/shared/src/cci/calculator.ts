// Sprint 27: CCI Calculator — Pure calculation functions (no DB dependency)
// DB queries are done in the worker/API layer, raw numbers passed here

import type {
  CCIFactorKey,
  CCIFactorWeights,
  CCIFactorScores,
  CCIRawMetrics,
  CCIRawMetricDetail,
  CCITrend,
  CCICalculationResult,
} from "../types/compliance-culture";

export const DEFAULT_CCI_WEIGHTS: CCIFactorWeights = {
  task_compliance: 0.2,
  policy_ack_rate: 0.15,
  training_completion: 0.15,
  incident_response_time: 0.2,
  audit_finding_closure: 0.15,
  self_assessment_participation: 0.15,
};

export const CCI_FACTOR_KEYS: CCIFactorKey[] = [
  "task_compliance",
  "policy_ack_rate",
  "training_completion",
  "incident_response_time",
  "audit_finding_closure",
  "self_assessment_participation",
];

/**
 * Normalize a factor score to the 0-100 range.
 */
export function normalizeFactor(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Normalize all factor scores to 0-100 range.
 */
export function normalizeFactors(
  factors: Partial<CCIFactorScores>,
): CCIFactorScores {
  const result: CCIFactorScores = { ...DEFAULT_ZERO_SCORES };
  for (const key of CCI_FACTOR_KEYS) {
    if (key in factors) {
      result[key] = normalizeFactor(factors[key] ?? 0);
    }
  }
  return result;
}

const DEFAULT_ZERO_SCORES: CCIFactorScores = {
  task_compliance: 0,
  policy_ack_rate: 0,
  training_completion: 0,
  incident_response_time: 0,
  audit_finding_closure: 0,
  self_assessment_participation: 0,
};

/**
 * Calculate the weighted CCI overall score from factor scores and weights.
 */
export function calculateWeightedCCI(
  factors: CCIFactorScores,
  weights: CCIFactorWeights,
): number {
  const normalized = normalizeFactors(factors);
  let overall = 0;
  for (const key of CCI_FACTOR_KEYS) {
    overall += normalized[key] * (weights[key] ?? 0);
  }
  return Math.round(overall * 100) / 100;
}

/**
 * Detect trend by comparing current and previous overall scores.
 * Delta < 1.0 point = stable.
 */
export function detectTrend(
  current: number,
  previous: number | null | undefined,
): CCITrend {
  if (previous == null) return "stable";
  const delta = current - previous;
  if (Math.abs(delta) < 1.0) return "stable";
  return delta > 0 ? "up" : "down";
}

/**
 * Calculate a percentage-based factor score from total and successful counts.
 * Returns 100 if total is 0 (no violations = perfect score).
 */
export function calcPercentageScore(total: number, successful: number): number {
  if (total <= 0) return 100;
  return Math.round((successful / total) * 10000) / 100;
}

/**
 * Calculate incident response score from average response hours.
 * Inverse: faster response = higher score. Normalized against target hours.
 */
export function calcIncidentResponseScore(
  avgResponseHours: number,
  targetHours: number = 48,
): number {
  if (avgResponseHours <= 0) return 100;
  const score = (1 - avgResponseHours / targetHours) * 100;
  return normalizeFactor(score);
}

/**
 * Validate that weights sum to 1.0 (within tolerance).
 */
export function validateWeights(weights: Partial<CCIFactorWeights>): boolean {
  const values = Object.values(weights);
  if (values.some((v) => v < 0)) return false;
  if (values.length !== CCI_FACTOR_KEYS.length) return false;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Build a complete CCI calculation result from raw metric data.
 */
export function buildCCIResult(
  rawMetrics: CCIRawMetrics,
  weights: CCIFactorWeights,
  incidentAvgHours: number,
  previousScore: number | null | undefined,
): CCICalculationResult {
  const factors: CCIFactorScores = {
    task_compliance: calcPercentageScore(
      rawMetrics.task_compliance.total,
      rawMetrics.task_compliance.successful,
    ),
    policy_ack_rate: calcPercentageScore(
      rawMetrics.policy_ack_rate.total,
      rawMetrics.policy_ack_rate.successful,
    ),
    training_completion: calcPercentageScore(
      rawMetrics.training_completion.total,
      rawMetrics.training_completion.successful,
    ),
    incident_response_time: calcIncidentResponseScore(incidentAvgHours),
    audit_finding_closure: calcPercentageScore(
      rawMetrics.audit_finding_closure.total,
      rawMetrics.audit_finding_closure.successful,
    ),
    self_assessment_participation: calcPercentageScore(
      rawMetrics.self_assessment_participation.total,
      rawMetrics.self_assessment_participation.successful,
    ),
  };

  const overall = calculateWeightedCCI(factors, weights);
  const trend = detectTrend(overall, previousScore);

  return { overall, factors, weights, rawMetrics, trend };
}

/**
 * Get period string for a given date (YYYY-MM format).
 */
export function getPeriodString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get the previous period string (month before the given period).
 */
export function getPreviousPeriod(period: string): string {
  const [yearStr, monthStr] = period.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month === 0) {
    month = 12;
    year--;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Get period start and end dates for a YYYY-MM period.
 */
export function getPeriodRange(period: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // JS months are 0-indexed
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end };
}

/**
 * Identify top-N improvement areas (lowest scoring factors).
 */
export function getTopImprovementAreas(
  factors: CCIFactorScores,
  count: number = 3,
): { key: CCIFactorKey; score: number }[] {
  return CCI_FACTOR_KEYS.map((key) => ({ key, score: factors[key] }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count);
}
