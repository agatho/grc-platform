// Sprint 25: FAIR Monte Carlo Simulation Engine
// Uses PERT distribution (modified beta) — NOT triangular
// ALE = LEF x LM (Annualized Loss Expectancy)

import { pertDistribution, percentile, mean, stdDev } from "./distributions";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface FAIRParams {
  /** Loss Event Frequency — minimum events per year */
  lefMin: number;
  /** Loss Event Frequency — most likely events per year */
  lefMostLikely: number;
  /** Loss Event Frequency — maximum events per year */
  lefMax: number;
  /** Loss Magnitude — minimum loss per event (EUR) */
  lmMin: number;
  /** Loss Magnitude — most likely loss per event (EUR) */
  lmMostLikely: number;
  /** Loss Magnitude — maximum loss per event (EUR) */
  lmMax: number;
}

export interface LossComponent {
  productivity: number;
  response: number;
  replacement: number;
  fines: number;
  judgments: number;
  reputation: number;
}

export interface HistogramBucket {
  bucket: number;
  bucketMax: number;
  count: number;
  percentage: number;
}

export interface ExceedancePoint {
  threshold: number;
  probability: number;
}

export interface SensitivityEntry {
  parameter: string;
  impact: number;
  label: string;
}

export interface SimulationResult {
  aleP5: number;
  aleP10: number;
  aleP25: number;
  aleP50: number;
  aleP75: number;
  aleP90: number;
  aleP95: number;
  aleP99: number;
  aleMean: number;
  aleStdDev: number;
  lefMean: number;
  lmMean: number;
  iterations: number;
  histogram: HistogramBucket[];
  lossExceedance: ExceedancePoint[];
  sensitivity: SensitivityEntry[];
}

// ──────────────────────────────────────────────────────────────
// Core simulation
// ──────────────────────────────────────────────────────────────

/**
 * Run a FAIR Monte Carlo simulation using PERT distribution.
 *
 * For each iteration:
 *   1. Sample LEF from PERT(lefMin, lefMostLikely, lefMax)
 *   2. Sample LM from PERT(lmMin, lmMostLikely, lmMax)
 *   3. ALE = LEF * LM
 *
 * @param params FAIR parameters (LEF and LM ranges)
 * @param iterations Number of iterations (default 10,000)
 * @returns Full simulation result with percentiles, histogram, and exceedance curve
 */
export function runFAIRSimulation(
  params: FAIRParams,
  iterations: number = 10000,
): SimulationResult {
  // Validate inputs
  if (params.lefMin < 0) {
    throw new Error("LEF minimum must be non-negative");
  }
  if (params.lefMin > params.lefMostLikely || params.lefMostLikely > params.lefMax) {
    throw new Error("LEF values must satisfy: lefMin <= lefMostLikely <= lefMax");
  }
  if (params.lmMin < 0) {
    throw new Error("LM minimum must be non-negative");
  }
  if (params.lmMin > params.lmMostLikely || params.lmMostLikely > params.lmMax) {
    throw new Error("LM values must satisfy: lmMin <= lmMostLikely <= lmMax");
  }
  if (iterations < 100 || iterations > 1_000_000) {
    throw new Error("Iterations must be between 100 and 1,000,000");
  }

  const aleValues: number[] = new Array(iterations);
  const lefValues: number[] = new Array(iterations);
  const lmValues: number[] = new Array(iterations);

  for (let i = 0; i < iterations; i++) {
    const lef = pertDistribution(params.lefMin, params.lefMostLikely, params.lefMax);
    const lm = pertDistribution(params.lmMin, params.lmMostLikely, params.lmMax);
    lefValues[i] = lef;
    lmValues[i] = lm;
    aleValues[i] = lef * lm; // ALE = LEF x LM
  }

  // Sort for percentile computation
  aleValues.sort((a, b) => a - b);

  const aleMeanVal = mean(aleValues);
  const aleStdDevVal = stdDev(aleValues);
  const lefMeanVal = mean(lefValues);
  const lmMeanVal = mean(lmValues);

  const histogram = buildHistogram(aleValues, 50);
  const lossExceedance = buildExceedanceCurve(aleValues, 20);
  const sensitivity = computeSensitivity(params, iterations);

  return {
    aleP5: round2(percentile(aleValues, 5)),
    aleP10: round2(percentile(aleValues, 10)),
    aleP25: round2(percentile(aleValues, 25)),
    aleP50: round2(percentile(aleValues, 50)),
    aleP75: round2(percentile(aleValues, 75)),
    aleP90: round2(percentile(aleValues, 90)),
    aleP95: round2(percentile(aleValues, 95)),
    aleP99: round2(percentile(aleValues, 99)),
    aleMean: round2(aleMeanVal),
    aleStdDev: round2(aleStdDevVal),
    lefMean: round2(lefMeanVal),
    lmMean: round2(lmMeanVal),
    iterations,
    histogram,
    lossExceedance,
    sensitivity,
  };
}

// ──────────────────────────────────────────────────────────────
// Histogram builder
// ──────────────────────────────────────────────────────────────

/**
 * Build a histogram from sorted ALE values.
 * @param sortedValues Sorted ALE array
 * @param buckets Number of buckets (default 50)
 */
export function buildHistogram(
  sortedValues: number[],
  buckets: number = 50,
): HistogramBucket[] {
  if (sortedValues.length === 0) return [];

  const minVal = sortedValues[0];
  const maxVal = sortedValues[sortedValues.length - 1];
  const range = maxVal - minVal;
  const bucketWidth = range > 0 ? range / buckets : 1;
  const result: HistogramBucket[] = [];
  const counts = new Array(buckets).fill(0);

  for (let i = 0; i < sortedValues.length; i++) {
    let idx = Math.floor((sortedValues[i] - minVal) / bucketWidth);
    if (idx >= buckets) idx = buckets - 1;
    counts[idx]++;
  }

  for (let b = 0; b < buckets; b++) {
    result.push({
      bucket: round2(minVal + b * bucketWidth),
      bucketMax: round2(minVal + (b + 1) * bucketWidth),
      count: counts[b],
      percentage: round2((counts[b] / sortedValues.length) * 100),
    });
  }

  return result;
}

// ──────────────────────────────────────────────────────────────
// Loss Exceedance Curve
// ──────────────────────────────────────────────────────────────

/**
 * Build a loss exceedance curve: P(loss > X) for evenly spaced thresholds.
 * @param sortedValues Sorted ALE array
 * @param thresholdCount Number of threshold points (default 20)
 */
export function buildExceedanceCurve(
  sortedValues: number[],
  thresholdCount: number = 20,
): ExceedancePoint[] {
  if (sortedValues.length === 0) return [];

  const minVal = sortedValues[0];
  const maxVal = sortedValues[sortedValues.length - 1];
  const step = (maxVal - minVal) / thresholdCount;
  const result: ExceedancePoint[] = [];

  for (let i = 0; i <= thresholdCount; i++) {
    const threshold = minVal + i * step;
    // Count how many values exceed this threshold
    // Binary search for efficiency on sorted array
    let lo = 0;
    let hi = sortedValues.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sortedValues[mid] <= threshold) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const exceedCount = sortedValues.length - lo;
    result.push({
      threshold: round2(threshold),
      probability: round2(exceedCount / sortedValues.length),
    });
  }

  return result;
}

// ──────────────────────────────────────────────────────────────
// Sensitivity Analysis (Tornado Diagram)
// ──────────────────────────────────────────────────────────────

/**
 * Compute sensitivity by varying each parameter while holding others at mode.
 * Returns impact scores (0-1) for the tornado diagram.
 */
function computeSensitivity(
  params: FAIRParams,
  iterations: number,
): SensitivityEntry[] {
  const subIterations = Math.min(iterations, 2000); // Reduced for speed

  // Baseline: all at most-likely
  const baselineAle = params.lefMostLikely * params.lmMostLikely;

  // Vary LEF with LM fixed at mode
  const lefAleValues: number[] = [];
  for (let i = 0; i < subIterations; i++) {
    const lef = pertDistribution(params.lefMin, params.lefMostLikely, params.lefMax);
    lefAleValues.push(lef * params.lmMostLikely);
  }
  const lefVariance = stdDev(lefAleValues);

  // Vary LM with LEF fixed at mode
  const lmAleValues: number[] = [];
  for (let i = 0; i < subIterations; i++) {
    const lm = pertDistribution(params.lmMin, params.lmMostLikely, params.lmMax);
    lmAleValues.push(params.lefMostLikely * lm);
  }
  const lmVariance = stdDev(lmAleValues);

  const totalVariance = lefVariance + lmVariance;
  if (totalVariance === 0) {
    return [
      { parameter: "lef", impact: 0.5, label: "Loss Event Frequency" },
      { parameter: "lm", impact: 0.5, label: "Loss Magnitude" },
    ];
  }

  return [
    {
      parameter: "lef",
      impact: round2(lefVariance / totalVariance),
      label: "Loss Event Frequency",
    },
    {
      parameter: "lm",
      impact: round2(lmVariance / totalVariance),
      label: "Loss Magnitude",
    },
  ].sort((a, b) => b.impact - a.impact);
}

// ──────────────────────────────────────────────────────────────
// Loss Component Distribution
// ──────────────────────────────────────────────────────────────

/**
 * Distribute a total ALE across loss components.
 */
export function distributeLossComponents(
  totalAle: number,
  components: LossComponent,
): Record<string, number> {
  const total = components.productivity + components.response + components.replacement +
    components.fines + components.judgments + components.reputation;

  if (total === 0) return {};

  return {
    productivity: round2((components.productivity / total) * totalAle),
    response: round2((components.response / total) * totalAle),
    replacement: round2((components.replacement / total) * totalAle),
    fines: round2((components.fines / total) * totalAle),
    judgments: round2((components.judgments / total) * totalAle),
    reputation: round2((components.reputation / total) * totalAle),
  };
}

/**
 * Default loss component weights as per FAIR taxonomy.
 */
export const DEFAULT_LOSS_COMPONENTS: LossComponent = {
  productivity: 30,
  response: 20,
  replacement: 10,
  fines: 15,
  judgments: 10,
  reputation: 15,
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
