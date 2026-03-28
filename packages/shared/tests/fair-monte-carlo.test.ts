import { describe, it, expect } from "vitest";
import {
  pertDistribution,
  percentile,
  mean,
  stdDev,
  betaDistribution,
} from "../src/utils/distributions";
import {
  runFAIRSimulation,
  buildHistogram,
  buildExceedanceCurve,
  distributeLossComponents,
  DEFAULT_LOSS_COMPONENTS,
} from "../src/utils/fair-monte-carlo";

// ──────────────────────────────────────────────────────────────
// PERT Distribution Tests
// ──────────────────────────────────────────────────────────────

describe("PERT Distribution", () => {
  it("returns values within min-max range", () => {
    for (let i = 0; i < 1000; i++) {
      const val = pertDistribution(1, 5, 10);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(10);
    }
  });

  it("mean is near most-likely for symmetric distribution", () => {
    const samples = Array.from({ length: 10000 }, () =>
      pertDistribution(0, 50, 100),
    );
    const avg = mean(samples);
    expect(avg).toBeGreaterThan(40);
    expect(avg).toBeLessThan(60);
  });

  it("handles degenerate case (min = max)", () => {
    const val = pertDistribution(5, 5, 5);
    expect(val).toBe(5);
  });

  it("handles degenerate case (min = mostLikely = max)", () => {
    for (let i = 0; i < 100; i++) {
      expect(pertDistribution(42, 42, 42)).toBe(42);
    }
  });

  it("throws for invalid ordering", () => {
    expect(() => pertDistribution(10, 5, 8)).toThrow();
  });

  it("produces skewed distribution for asymmetric inputs", () => {
    const samples = Array.from({ length: 10000 }, () =>
      pertDistribution(0, 20, 100),
    );
    const avg = mean(samples);
    // PERT mean = (min + lambda*mode + max) / (lambda + 2) = (0 + 4*20 + 100) / 6 = 180/6 = 30
    expect(avg).toBeGreaterThan(25);
    expect(avg).toBeLessThan(35);
  });
});

// ──────────────────────────────────────────────────────────────
// Beta Distribution Tests
// ──────────────────────────────────────────────────────────────

describe("Beta Distribution", () => {
  it("returns values in [0, 1]", () => {
    for (let i = 0; i < 1000; i++) {
      const val = betaDistribution(2, 5);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it("uniform for alpha=1, beta=1", () => {
    const samples = Array.from({ length: 5000 }, () =>
      betaDistribution(1, 1),
    );
    const avg = mean(samples);
    expect(avg).toBeGreaterThan(0.45);
    expect(avg).toBeLessThan(0.55);
  });

  it("throws for non-positive parameters", () => {
    expect(() => betaDistribution(0, 1)).toThrow();
    expect(() => betaDistribution(1, -1)).toThrow();
  });
});

// ──────────────────────────────────────────────────────────────
// Statistical Helpers Tests
// ──────────────────────────────────────────────────────────────

describe("Statistical Helpers", () => {
  it("percentile computes correctly", () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(sorted, 0)).toBe(10);
    expect(percentile(sorted, 50)).toBe(55);
    expect(percentile(sorted, 100)).toBe(100);
  });

  it("mean computes correctly", () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(mean([])).toBe(0);
  });

  it("stdDev computes correctly", () => {
    expect(stdDev([10, 10, 10])).toBe(0);
    expect(stdDev([])).toBe(0);
    const sd = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(sd).toBeCloseTo(2.0, 0);
  });
});

// ──────────────────────────────────────────────────────────────
// Monte Carlo Simulation Tests
// ──────────────────────────────────────────────────────────────

describe("Monte Carlo Simulation", () => {
  it("produces correct percentile ordering", () => {
    const result = runFAIRSimulation({
      lefMin: 0.1,
      lefMostLikely: 1,
      lefMax: 5,
      lmMin: 100000,
      lmMostLikely: 500000,
      lmMax: 2000000,
    });
    expect(result.aleP5).toBeLessThan(result.aleP25);
    expect(result.aleP25).toBeLessThan(result.aleP50);
    expect(result.aleP50).toBeLessThan(result.aleP75);
    expect(result.aleP75).toBeLessThan(result.aleP95);
  });

  it("ALE = LEF x LM in expected range for deterministic inputs", () => {
    const result = runFAIRSimulation({
      lefMin: 1,
      lefMostLikely: 1,
      lefMax: 1,
      lmMin: 100000,
      lmMostLikely: 100000,
      lmMax: 100000,
    });
    // With deterministic inputs, all values should be exactly 100,000
    expect(result.aleP50).toBeCloseTo(100000, -2);
    expect(result.aleMean).toBeCloseTo(100000, -2);
    expect(result.aleStdDev).toBeCloseTo(0, -2);
  });

  it("generates 50 histogram buckets", () => {
    const result = runFAIRSimulation({
      lefMin: 0.5,
      lefMostLikely: 2,
      lefMax: 10,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    });
    expect(result.histogram.length).toBe(50);
  });

  it("exceedance curve starts near 1.0 and ends near 0.0", () => {
    const result = runFAIRSimulation({
      lefMin: 0.5,
      lefMostLikely: 2,
      lefMax: 10,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    });
    expect(result.lossExceedance[0].probability).toBeGreaterThan(0.8);
    expect(
      result.lossExceedance[result.lossExceedance.length - 1].probability,
    ).toBeLessThan(0.2);
  });

  it("sensitivity analysis sums to ~1.0", () => {
    const result = runFAIRSimulation({
      lefMin: 0.5,
      lefMostLikely: 2,
      lefMax: 10,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    });
    const totalImpact = result.sensitivity.reduce((sum, s) => sum + s.impact, 0);
    expect(totalImpact).toBeCloseTo(1.0, 1);
  });

  it("respects iteration count", () => {
    const result = runFAIRSimulation(
      {
        lefMin: 1,
        lefMostLikely: 2,
        lefMax: 5,
        lmMin: 10000,
        lmMostLikely: 50000,
        lmMax: 200000,
      },
      1000,
    );
    expect(result.iterations).toBe(1000);
  });

  it("throws for invalid iteration count", () => {
    expect(() =>
      runFAIRSimulation(
        {
          lefMin: 1,
          lefMostLikely: 2,
          lefMax: 5,
          lmMin: 10000,
          lmMostLikely: 50000,
          lmMax: 200000,
        },
        50,
      ),
    ).toThrow();
  });

  it("throws for invalid LEF ordering", () => {
    expect(() =>
      runFAIRSimulation({
        lefMin: 5,
        lefMostLikely: 2,
        lefMax: 1,
        lmMin: 10000,
        lmMostLikely: 50000,
        lmMax: 200000,
      }),
    ).toThrow();
  });

  it("throws for negative LM", () => {
    expect(() =>
      runFAIRSimulation({
        lefMin: 1,
        lefMostLikely: 2,
        lefMax: 5,
        lmMin: -10000,
        lmMostLikely: 50000,
        lmMax: 200000,
      }),
    ).toThrow();
  });

  it("includes all expected percentiles", () => {
    const result = runFAIRSimulation({
      lefMin: 0.5,
      lefMostLikely: 2,
      lefMax: 10,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    });
    expect(result.aleP5).toBeDefined();
    expect(result.aleP10).toBeDefined();
    expect(result.aleP25).toBeDefined();
    expect(result.aleP50).toBeDefined();
    expect(result.aleP75).toBeDefined();
    expect(result.aleP90).toBeDefined();
    expect(result.aleP95).toBeDefined();
    expect(result.aleP99).toBeDefined();
    expect(result.aleMean).toBeDefined();
    expect(result.aleStdDev).toBeDefined();
    expect(result.lefMean).toBeDefined();
    expect(result.lmMean).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────
// Histogram Tests
// ──────────────────────────────────────────────────────────────

describe("buildHistogram", () => {
  it("creates the requested number of buckets", () => {
    const values = Array.from({ length: 100 }, (_, i) => i).sort(
      (a, b) => a - b,
    );
    const hist = buildHistogram(values, 10);
    expect(hist.length).toBe(10);
  });

  it("total count matches input length", () => {
    const values = Array.from({ length: 500 }, (_, i) => i * 100).sort(
      (a, b) => a - b,
    );
    const hist = buildHistogram(values, 20);
    const totalCount = hist.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(500);
  });

  it("returns empty for empty input", () => {
    expect(buildHistogram([], 10)).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// Loss Exceedance Curve Tests
// ──────────────────────────────────────────────────────────────

describe("buildExceedanceCurve", () => {
  it("produces monotonically decreasing probabilities", () => {
    const values = Array.from({ length: 1000 }, () => Math.random() * 1000000).sort(
      (a, b) => a - b,
    );
    const curve = buildExceedanceCurve(values, 20);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].probability).toBeLessThanOrEqual(
        curve[i - 1].probability + 0.001,
      );
    }
  });

  it("returns empty for empty input", () => {
    expect(buildExceedanceCurve([], 10)).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// Loss Component Distribution Tests
// ──────────────────────────────────────────────────────────────

describe("distributeLossComponents", () => {
  it("distributes ALE correctly", () => {
    const dist = distributeLossComponents(100000, {
      productivity: 50,
      response: 20,
      replacement: 10,
      fines: 10,
      judgments: 5,
      reputation: 5,
    });
    expect(dist.productivity).toBe(50000);
    expect(dist.response).toBe(20000);
    expect(dist.replacement).toBe(10000);
    expect(dist.fines).toBe(10000);
    expect(dist.judgments).toBe(5000);
    expect(dist.reputation).toBe(5000);
  });

  it("returns empty for zero components", () => {
    const dist = distributeLossComponents(100000, {
      productivity: 0,
      response: 0,
      replacement: 0,
      fines: 0,
      judgments: 0,
      reputation: 0,
    });
    expect(Object.keys(dist).length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// Default Loss Components
// ──────────────────────────────────────────────────────────────

describe("DEFAULT_LOSS_COMPONENTS", () => {
  it("sums to 100", () => {
    const sum =
      DEFAULT_LOSS_COMPONENTS.productivity +
      DEFAULT_LOSS_COMPONENTS.response +
      DEFAULT_LOSS_COMPONENTS.replacement +
      DEFAULT_LOSS_COMPONENTS.fines +
      DEFAULT_LOSS_COMPONENTS.judgments +
      DEFAULT_LOSS_COMPONENTS.reputation;
    expect(sum).toBe(100);
  });
});

// ──────────────────────────────────────────────────────────────
// Performance Tests
// ──────────────────────────────────────────────────────────────

describe("Performance", () => {
  it("10,000 iterations complete in under 500ms", () => {
    const start = performance.now();
    runFAIRSimulation({
      lefMin: 0.5,
      lefMostLikely: 2,
      lefMax: 10,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    }, 10000);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("100,000 iterations complete in under 5000ms", () => {
    const start = performance.now();
    runFAIRSimulation({
      lefMin: 0.5,
      lefMostLikely: 2,
      lefMax: 10,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    }, 100000);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});
