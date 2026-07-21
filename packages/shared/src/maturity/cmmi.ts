// CMMI Maturity Calculation
//
// #WAVE22-MAR-P2-04: Cowork QA's marathon flagged that the
// programme-maturity level was hardcoded rather than derived from
// real data. This module is the pure calculation: inputs come from
// per-source aggregations (controls / incidents / audits / training
// / esg), outputs are CMMI ML1-ML5 with confidence-tagging.
//
// Per the design call:
//   * Two-stage filter: source must be both `module_enabled = true`
//     AND `data_count >= MIN_SAMPLES_PER_SOURCE`. Modules without
//     data don't pull the score down.
//   * Re-normalize weights over remaining sources.
//   * Confidence tag: high (all configured), limited (≥2 active but
//     not all), insufficient (<2 active → level: null).
//   * CMMI thresholds: <40 ML1, 40-60 ML2, 60-80 ML3, 80-90 ML4, >90 ML5.

export type MaturitySource =
  "controls" | "incidents" | "audits" | "training" | "esg";

/** Minimum data points before a source is allowed to vote. */
export const MIN_SAMPLES_PER_SOURCE: Record<MaturitySource, number> = {
  controls: 1, // ≥1 control with ≥1 test result
  incidents: 1, // ≥1 closed incident in last 12 months
  audits: 1, // ≥1 audit with ≥1 finding
  training: 5, // ≥5 users with completion data
  esg: 1, // ≥1 metric with ≥1 measurement
};

/** Default weights — design-call tunable, sum to 1.0 across all sources. */
export const DEFAULT_WEIGHTS: Record<MaturitySource, number> = {
  controls: 0.35,
  incidents: 0.2,
  audits: 0.2,
  training: 0.15,
  esg: 0.1,
};

export interface SourceInput {
  source: MaturitySource;
  /** True if module_config has the corresponding module enabled. */
  moduleEnabled: boolean;
  /** Count of underlying data points (test rows, closed incidents, etc.). */
  dataCount: number;
  /** Source-specific score in 0-100. */
  score: number;
}

export type Confidence = "high" | "limited" | "insufficient";

export interface MaturityResult {
  /** CMMI level 1-5; null when confidence='insufficient'. */
  level: number | null;
  levelLabel: string | null;
  /** Weighted score 0-100; null when no usable sources. */
  score: number | null;
  confidence: Confidence;
  activeSources: Array<{
    source: MaturitySource;
    weight: number; // re-normalised
    score: number;
    dataCount: number;
  }>;
  excludedSources: Array<{
    source: MaturitySource;
    reason: "module_disabled" | "no_data" | "below_threshold";
    dataCount: number;
    minSamples: number;
  }>;
  note: string;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Initial",
  2: "Managed",
  3: "Defined",
  4: "Quantitatively Managed",
  5: "Optimizing",
};

/** CMMI bucket: <40 ML1, 40-60 ML2, 60-80 ML3, 80-90 ML4, >90 ML5. */
function scoreToLevel(score: number): number {
  if (score < 40) return 1;
  if (score < 60) return 2;
  if (score < 80) return 3;
  if (score < 90) return 4;
  return 5;
}

/**
 * Pure maturity computation. Pass the per-source aggregations and an
 * optional weights override.
 */
export function calculateMaturity(
  inputs: SourceInput[],
  opts?: { weights?: Partial<Record<MaturitySource, number>> },
): MaturityResult {
  const weights = { ...DEFAULT_WEIGHTS, ...(opts?.weights ?? {}) };

  const active: MaturityResult["activeSources"] = [];
  const excluded: MaturityResult["excludedSources"] = [];

  for (const input of inputs) {
    const minSamples = MIN_SAMPLES_PER_SOURCE[input.source];
    if (!input.moduleEnabled) {
      excluded.push({
        source: input.source,
        reason: "module_disabled",
        dataCount: input.dataCount,
        minSamples,
      });
      continue;
    }
    if (input.dataCount === 0) {
      excluded.push({
        source: input.source,
        reason: "no_data",
        dataCount: input.dataCount,
        minSamples,
      });
      continue;
    }
    if (input.dataCount < minSamples) {
      excluded.push({
        source: input.source,
        reason: "below_threshold",
        dataCount: input.dataCount,
        minSamples,
      });
      continue;
    }
    active.push({
      source: input.source,
      weight: weights[input.source] ?? 0,
      score: input.score,
      dataCount: input.dataCount,
    });
  }

  // <2 active sources → can't trust the result. A single 80 % source
  // would otherwise look like ML4 even though the other 4 dimensions
  // are unmeasured.
  if (active.length < 2) {
    return {
      level: null,
      levelLabel: null,
      score: null,
      confidence: "insufficient",
      activeSources: active,
      excludedSources: excluded,
      note: `Insufficient data: ${active.length} of ${inputs.length} possible sources have enough data. Need at least 2 active sources to compute a maturity level.`,
    };
  }

  // Re-normalise weights so the active set sums to 1.0. Without this,
  // an excluded high-weight source would understate the active ones.
  const weightSum = active.reduce((s, a) => s + a.weight, 0);
  const normalised =
    weightSum > 0
      ? active.map((a) => ({ ...a, weight: a.weight / weightSum }))
      : // Edge case: all weights zero (custom override). Equal-weight.
        active.map((a) => ({ ...a, weight: 1 / active.length }));

  const score = Math.round(
    normalised.reduce((s, a) => s + a.weight * a.score, 0),
  );
  const level = scoreToLevel(score);

  // High confidence when every input we got is active. Limited when
  // we had to drop some.
  const confidence: Confidence =
    active.length === inputs.length ? "high" : "limited";

  const noteParts: string[] = [
    `Score derived from ${active.length} of ${inputs.length} possible inputs.`,
  ];
  if (excluded.length > 0) {
    const recoverable = excluded.filter(
      (e) => e.reason === "no_data" || e.reason === "below_threshold",
    );
    if (recoverable.length > 0) {
      noteParts.push(
        `Add data for ${recoverable.map((r) => r.source).join(", ")} for a fuller picture.`,
      );
    }
  }

  return {
    level,
    levelLabel: LEVEL_LABELS[level] ?? null,
    score,
    confidence,
    activeSources: normalised,
    excludedSources: excluded,
    note: noteParts.join(" "),
  };
}
