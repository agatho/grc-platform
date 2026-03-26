// Sprint 4b: FAIR (Factor Analysis of Information Risk) Monte Carlo Simulation
// Implements triangular distribution sampling for Loss Event Frequency (LEF)
// and Loss Magnitude (LM) to produce Annualized Loss Expectancy (ALE)

export interface FAIRInput {
  /** Loss Event Frequency — minimum events per year */
  lefMin: number;
  /** Loss Event Frequency — most likely events per year */
  lefMostLikely: number;
  /** Loss Event Frequency — maximum events per year */
  lefMax: number;
  /** Loss Magnitude — minimum loss per event (currency) */
  lmMin: number;
  /** Loss Magnitude — most likely loss per event (currency) */
  lmMostLikely: number;
  /** Loss Magnitude — maximum loss per event (currency) */
  lmMax: number;
  /** Number of simulation iterations (default 10000) */
  iterations?: number;
  /** Currency code for display (default EUR) */
  currency?: string;
}

export interface FAIRResult {
  /** Annualized Loss Expectancy — mean */
  aleMean: number;
  /** Annualized Loss Expectancy — median (P50) */
  aleMedian: number;
  /** 5th percentile */
  aleP5: number;
  /** 10th percentile */
  aleP10: number;
  /** 25th percentile */
  aleP25: number;
  /** 75th percentile */
  aleP75: number;
  /** 90th percentile */
  aleP90: number;
  /** 95th percentile */
  aleP95: number;
  /** Standard deviation */
  aleStdDev: number;
  /** Number of iterations actually run */
  iterations: number;
  /** Currency used */
  currency: string;
  /** Distribution buckets for histogram (10 equal-width buckets) */
  distribution: DistributionBucket[];
  /** Mean LEF used */
  lefMean: number;
  /** Mean LM used */
  lmMean: number;
}

export interface DistributionBucket {
  /** Lower bound of the bucket (inclusive) */
  rangeMin: number;
  /** Upper bound of the bucket (exclusive) */
  rangeMax: number;
  /** Number of samples in this bucket */
  count: number;
  /** Percentage of total samples */
  percentage: number;
}

/**
 * Sample from a triangular distribution.
 * Uses inverse CDF method for exact triangular sampling.
 */
function sampleTriangular(min: number, mostLikely: number, max: number): number {
  if (min === max) return min;
  const u = Math.random();
  const fc = (mostLikely - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mostLikely - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mostLikely));
}

/**
 * Compute a given percentile from a sorted array.
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedArr[lower];
  const weight = idx - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * Run a FAIR Monte Carlo simulation.
 *
 * For each iteration:
 *   1. Sample LEF from triangular(lefMin, lefMostLikely, lefMax)
 *   2. Sample LM from triangular(lmMin, lmMostLikely, lmMax)
 *   3. ALE = LEF * LM
 *
 * Returns statistics and distribution buckets.
 */
export function runFAIRSimulation(input: FAIRInput): FAIRResult {
  const iterations = input.iterations ?? 10000;
  const currency = input.currency ?? "EUR";

  // Validate inputs
  if (input.lefMin > input.lefMostLikely || input.lefMostLikely > input.lefMax) {
    throw new Error("LEF values must satisfy: lefMin <= lefMostLikely <= lefMax");
  }
  if (input.lmMin > input.lmMostLikely || input.lmMostLikely > input.lmMax) {
    throw new Error("LM values must satisfy: lmMin <= lmMostLikely <= lmMax");
  }
  if (iterations < 100 || iterations > 1_000_000) {
    throw new Error("iterations must be between 100 and 1,000,000");
  }

  const aleValues: number[] = new Array(iterations);
  let sumAle = 0;
  let sumLef = 0;
  let sumLm = 0;

  for (let i = 0; i < iterations; i++) {
    const lef = sampleTriangular(input.lefMin, input.lefMostLikely, input.lefMax);
    const lm = sampleTriangular(input.lmMin, input.lmMostLikely, input.lmMax);
    const ale = lef * lm;
    aleValues[i] = ale;
    sumAle += ale;
    sumLef += lef;
    sumLm += lm;
  }

  // Sort for percentile computation
  aleValues.sort((a, b) => a - b);

  const aleMean = sumAle / iterations;
  const lefMean = sumLef / iterations;
  const lmMean = sumLm / iterations;

  // Standard deviation
  let sumSqDiff = 0;
  for (let i = 0; i < iterations; i++) {
    const diff = aleValues[i] - aleMean;
    sumSqDiff += diff * diff;
  }
  const aleStdDev = Math.sqrt(sumSqDiff / iterations);

  // Distribution buckets (10 equal-width)
  const minAle = aleValues[0];
  const maxAle = aleValues[iterations - 1];
  const bucketCount = 10;
  const bucketWidth = maxAle > minAle ? (maxAle - minAle) / bucketCount : 1;
  const distribution: DistributionBucket[] = [];
  const bucketCounts = new Array(bucketCount).fill(0);

  for (let i = 0; i < iterations; i++) {
    let bucketIdx = Math.floor((aleValues[i] - minAle) / bucketWidth);
    if (bucketIdx >= bucketCount) bucketIdx = bucketCount - 1;
    bucketCounts[bucketIdx]++;
  }

  for (let b = 0; b < bucketCount; b++) {
    distribution.push({
      rangeMin: Math.round((minAle + b * bucketWidth) * 100) / 100,
      rangeMax: Math.round((minAle + (b + 1) * bucketWidth) * 100) / 100,
      count: bucketCounts[b],
      percentage: Math.round((bucketCounts[b] / iterations) * 10000) / 100,
    });
  }

  return {
    aleMean: Math.round(aleMean * 100) / 100,
    aleMedian: Math.round(percentile(aleValues, 50) * 100) / 100,
    aleP5: Math.round(percentile(aleValues, 5) * 100) / 100,
    aleP10: Math.round(percentile(aleValues, 10) * 100) / 100,
    aleP25: Math.round(percentile(aleValues, 25) * 100) / 100,
    aleP75: Math.round(percentile(aleValues, 75) * 100) / 100,
    aleP90: Math.round(percentile(aleValues, 90) * 100) / 100,
    aleP95: Math.round(percentile(aleValues, 95) * 100) / 100,
    aleStdDev: Math.round(aleStdDev * 100) / 100,
    iterations,
    currency,
    distribution,
    lefMean: Math.round(lefMean * 100) / 100,
    lmMean: Math.round(lmMean * 100) / 100,
  };
}
