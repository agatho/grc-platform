// Sprint 25: Statistical distribution utilities for FAIR Monte Carlo
// PERT distribution (modified beta) — superior to triangular for expert estimates

/**
 * Sample from a Beta distribution using the Joehnk algorithm.
 * Returns a value in [0, 1].
 */
export function betaDistribution(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) {
    throw new Error("Alpha and beta must be positive");
  }

  // For alpha=1, beta=1: uniform distribution
  if (alpha === 1 && beta === 1) return Math.random();

  // Joehnk's algorithm for general alpha, beta
  if (alpha < 1 && beta < 1) {
    // Use rejection method for both < 1
    while (true) {
      const u = Math.random();
      const v = Math.random();
      const x = Math.pow(u, 1 / alpha);
      const y = Math.pow(v, 1 / beta);
      if (x + y <= 1) {
        return x / (x + y);
      }
    }
  }

  // Use gamma sampling approach for general case
  const gammaA = sampleGamma(alpha);
  const gammaB = sampleGamma(beta);
  return gammaA / (gammaA + gammaB);
}

/**
 * Sample from a Gamma distribution using Marsaglia and Tsang's method.
 */
function sampleGamma(shape: number): number {
  if (shape < 1) {
    // For shape < 1, use shape+1 and then scale
    const u = Math.random();
    return sampleGamma(shape + 1) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number;
    let v: number;

    do {
      x = standardNormal();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Box-Muller transform for standard normal samples.
 */
function standardNormal(): number {
  let u: number;
  let v: number;
  let s: number;

  do {
    u = 2 * Math.random() - 1;
    v = 2 * Math.random() - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);

  return u * Math.sqrt(-2 * Math.log(s) / s);
}

/**
 * Sample from a PERT distribution (modified beta).
 * Better tail behavior than triangular for expert estimates.
 *
 * @param min Minimum value
 * @param mostLikely Most likely value (mode)
 * @param max Maximum value
 * @param lambda Shape parameter (default 4, standard PERT)
 * @returns Random sample from the PERT distribution
 */
export function pertDistribution(
  min: number,
  mostLikely: number,
  max: number,
  lambda: number = 4,
): number {
  if (min > mostLikely || mostLikely > max) {
    throw new Error("PERT parameters must satisfy: min <= mostLikely <= max");
  }
  if (min === max) return min;

  const range = max - min;
  const alpha = 1 + lambda * (mostLikely - min) / range;
  const beta = 1 + lambda * (max - mostLikely) / range;

  const sample = betaDistribution(alpha, beta);
  return min + sample * range;
}

/**
 * Compute a percentile from a sorted array using linear interpolation.
 */
export function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  if (p <= 0) return sortedArr[0];
  if (p >= 100) return sortedArr[sortedArr.length - 1];

  const idx = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedArr[lower];

  const weight = idx - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * Compute the arithmetic mean of an array.
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

/**
 * Compute the standard deviation (population) of an array.
 */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  let sumSqDiff = 0;
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - avg;
    sumSqDiff += diff * diff;
  }
  return Math.sqrt(sumSqDiff / values.length);
}
