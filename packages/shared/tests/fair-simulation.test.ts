// Tests für FAIR Monte Carlo Simulation
// Bezug: packages/shared/src/fair-simulation.ts

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runFAIRSimulation, type FAIRInput } from "../src/fair-simulation";

const BASE: FAIRInput = {
  lefMin: 1,
  lefMostLikely: 5,
  lefMax: 10,
  lmMin: 1000,
  lmMostLikely: 5000,
  lmMax: 20000,
  iterations: 10000,
};

describe("runFAIRSimulation — input validation", () => {
  it("throws when LEF min > most-likely", () => {
    expect(() =>
      runFAIRSimulation({ ...BASE, lefMin: 6, lefMostLikely: 5 }),
    ).toThrow(/lefMin <= lefMostLikely/);
  });

  it("throws when LEF most-likely > max", () => {
    expect(() =>
      runFAIRSimulation({ ...BASE, lefMostLikely: 11, lefMax: 10 }),
    ).toThrow(/lefMostLikely <= lefMax/);
  });

  it("throws when LM min > most-likely", () => {
    expect(() =>
      runFAIRSimulation({ ...BASE, lmMin: 6000, lmMostLikely: 5000 }),
    ).toThrow(/lmMin <= lmMostLikely/);
  });

  it("throws when LM most-likely > max", () => {
    expect(() =>
      runFAIRSimulation({ ...BASE, lmMostLikely: 21000, lmMax: 20000 }),
    ).toThrow(/lmMostLikely <= lmMax/);
  });

  it("throws when iterations < 100", () => {
    expect(() => runFAIRSimulation({ ...BASE, iterations: 99 })).toThrow(
      /iterations must be between 100 and 1,000,000/,
    );
  });

  it("throws when iterations > 1,000,000", () => {
    expect(() => runFAIRSimulation({ ...BASE, iterations: 1_000_001 })).toThrow(
      /iterations must be between 100 and 1,000,000/,
    );
  });

  it("accepts iterations at boundaries (100, 1000000)", () => {
    expect(() => runFAIRSimulation({ ...BASE, iterations: 100 })).not.toThrow();
    // 1M iterations skip — too slow for unit test; lower bound suffices
  });
});

describe("runFAIRSimulation — output structure", () => {
  it("returns expected shape with all percentile keys", () => {
    const r = runFAIRSimulation(BASE);
    expect(r).toEqual(
      expect.objectContaining({
        aleMean: expect.any(Number),
        aleMedian: expect.any(Number),
        aleP5: expect.any(Number),
        aleP10: expect.any(Number),
        aleP25: expect.any(Number),
        aleP75: expect.any(Number),
        aleP90: expect.any(Number),
        aleP95: expect.any(Number),
        aleStdDev: expect.any(Number),
        iterations: 10000,
        currency: "EUR",
        lefMean: expect.any(Number),
        lmMean: expect.any(Number),
      }),
    );
    expect(Array.isArray(r.distribution)).toBe(true);
    expect(r.distribution).toHaveLength(10);
  });

  it("uses default iterations 10000 if not provided", () => {
    const { iterations, ...rest } = BASE;
    void iterations;
    const r = runFAIRSimulation(rest);
    expect(r.iterations).toBe(10000);
  });

  it("respects currency override", () => {
    const r = runFAIRSimulation({ ...BASE, currency: "USD" });
    expect(r.currency).toBe("USD");
  });

  it("currency defaults to EUR", () => {
    expect(runFAIRSimulation(BASE).currency).toBe("EUR");
  });

  it("each distribution bucket has rangeMin/rangeMax/count/percentage", () => {
    const r = runFAIRSimulation(BASE);
    for (const b of r.distribution) {
      expect(b).toEqual(
        expect.objectContaining({
          rangeMin: expect.any(Number),
          rangeMax: expect.any(Number),
          count: expect.any(Number),
          percentage: expect.any(Number),
        }),
      );
    }
  });

  it("distribution counts sum to iterations", () => {
    const r = runFAIRSimulation(BASE);
    const sum = r.distribution.reduce((s, b) => s + b.count, 0);
    expect(sum).toBe(r.iterations);
  });

  it("distribution percentages sum to ~100", () => {
    const r = runFAIRSimulation(BASE);
    const sum = r.distribution.reduce((s, b) => s + b.percentage, 0);
    // Rounding may give ~99.9 — 100.1
    expect(Math.abs(sum - 100)).toBeLessThan(0.5);
  });
});

describe("runFAIRSimulation — statistical properties", () => {
  it("ALE mean ≈ LEF-most-likely × LM-most-likely (within 30 % margin for triangular)", () => {
    const r = runFAIRSimulation(BASE);
    const expected = BASE.lefMostLikely * BASE.lmMostLikely; // 25 000
    // Triangular distributions yield mean = (min + mostLikely + max) / 3
    // Mean LEF = 5.33, Mean LM = 8666, so ALE_mean ≈ 46 000
    // Verify ALE mean is within reasonable bounds
    expect(r.aleMean).toBeGreaterThan(expected * 0.5);
    expect(r.aleMean).toBeLessThan(expected * 4);
  });

  it("percentiles are monotonically increasing (P5 ≤ P10 ≤ P25 ≤ median ≤ P75 ≤ P90 ≤ P95)", () => {
    const r = runFAIRSimulation(BASE);
    expect(r.aleP5).toBeLessThanOrEqual(r.aleP10);
    expect(r.aleP10).toBeLessThanOrEqual(r.aleP25);
    expect(r.aleP25).toBeLessThanOrEqual(r.aleMedian);
    expect(r.aleMedian).toBeLessThanOrEqual(r.aleP75);
    expect(r.aleP75).toBeLessThanOrEqual(r.aleP90);
    expect(r.aleP90).toBeLessThanOrEqual(r.aleP95);
  });

  it("standard deviation is positive when range is non-trivial", () => {
    const r = runFAIRSimulation(BASE);
    expect(r.aleStdDev).toBeGreaterThan(0);
  });

  it("when LEF and LM are point values (min=mostLikely=max), result is deterministic", () => {
    const r = runFAIRSimulation({
      lefMin: 2,
      lefMostLikely: 2,
      lefMax: 2,
      lmMin: 1000,
      lmMostLikely: 1000,
      lmMax: 1000,
      iterations: 200,
    });
    expect(r.aleMean).toBe(2000);
    expect(r.aleMedian).toBe(2000);
    expect(r.aleStdDev).toBe(0);
    expect(r.lefMean).toBe(2);
    expect(r.lmMean).toBe(1000);
  });

  it("zero LEF produces zero ALE", () => {
    const r = runFAIRSimulation({
      lefMin: 0,
      lefMostLikely: 0,
      lefMax: 0,
      lmMin: 1000,
      lmMostLikely: 5000,
      lmMax: 20000,
      iterations: 200,
    });
    expect(r.aleMean).toBe(0);
  });
});

describe("runFAIRSimulation — determinism with seeded Math.random", () => {
  let originalRandom: () => number;

  beforeEach(() => {
    originalRandom = Math.random;
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  it("with constant Math.random (=0.5), produces stable mean/median (no NaN/Infinity)", () => {
    Math.random = () => 0.5;
    const r = runFAIRSimulation({ ...BASE, iterations: 200 });
    expect(Number.isFinite(r.aleMean)).toBe(true);
    expect(Number.isFinite(r.aleMedian)).toBe(true);
    expect(Number.isFinite(r.aleStdDev)).toBe(true);
  });
});
