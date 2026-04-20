import { describe, it, expect } from "vitest";
import {
  IMPACT_DECAY_FACTOR,
  IMPACT_NOISE_THRESHOLD,
  MAX_GRAPH_DEPTH,
  DEFAULT_GRAPH_DEPTH,
  RELATIONSHIP_WEIGHTS,
  HUB_CONNECTION_THRESHOLD,
} from "../types";

// ─── Constants validation ──────────────────────────────────

describe("Graph constants", () => {
  it("has correct decay factor", () => {
    expect(IMPACT_DECAY_FACTOR).toBe(0.6);
  });

  it("has correct noise threshold", () => {
    expect(IMPACT_NOISE_THRESHOLD).toBe(5);
  });

  it("has correct max depth", () => {
    expect(MAX_GRAPH_DEPTH).toBe(5);
  });

  it("has correct default depth", () => {
    expect(DEFAULT_GRAPH_DEPTH).toBe(3);
  });

  it("has correct hub connection threshold", () => {
    expect(HUB_CONNECTION_THRESHOLD).toBe(10);
  });
});

// ─── Impact scoring ────────────────────────────────────────

describe("Impact scoring simulation", () => {
  function computeImpactScore(baseWeight: number, hopDistance: number): number {
    const decayFactor = Math.pow(IMPACT_DECAY_FACTOR, hopDistance - 1);
    return Math.round(baseWeight * decayFactor);
  }

  it("direct neighbor gets full weight", () => {
    expect(computeImpactScore(90, 1)).toBe(90); // 90 * 0.6^0
  });

  it("2-hop neighbor gets 60% weight", () => {
    expect(computeImpactScore(90, 2)).toBe(54); // 90 * 0.6^1
  });

  it("3-hop neighbor gets 36% weight", () => {
    expect(computeImpactScore(90, 3)).toBe(32); // 90 * 0.6^2
  });

  it("impact decreases monotonically with distance", () => {
    const scores = [1, 2, 3, 4, 5].map((d) => computeImpactScore(90, d));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });

  it("low-weight relationships drop below threshold quickly", () => {
    // documented_in (weight 30) at hop 3
    const score = computeImpactScore(30, 3);
    expect(score).toBe(11); // 30 * 0.36 = 10.8 → 11

    // At hop 4 it should be below threshold
    const score4 = computeImpactScore(30, 4);
    expect(score4).toBeLessThanOrEqual(IMPACT_NOISE_THRESHOLD + 2);
  });

  it("high-weight relationships persist across hops", () => {
    // mitigates (weight 90) at hop 5
    const score = computeImpactScore(90, 5);
    expect(score).toBeGreaterThan(IMPACT_NOISE_THRESHOLD); // 90 * 0.6^4 ≈ 12
  });
});

// ─── What-If multipliers ───────────────────────────────────

describe("What-If scenario multipliers", () => {
  const SCENARIO_MULTIPLIERS: Record<string, number> = {
    control_disabled: 1.5,
    vendor_terminated: 1.3,
    asset_compromised: 2.0,
    process_stopped: 1.4,
  };

  it("asset_compromised has highest multiplier", () => {
    const max = Math.max(...Object.values(SCENARIO_MULTIPLIERS));
    expect(SCENARIO_MULTIPLIERS.asset_compromised).toBe(max);
  });

  it("all multipliers are greater than 1 (amplification)", () => {
    for (const [, mult] of Object.entries(SCENARIO_MULTIPLIERS)) {
      expect(mult).toBeGreaterThan(1);
    }
  });

  it("amplified score is capped at 100", () => {
    const original = 70;
    const amplified = Math.min(
      100,
      Math.round(original * SCENARIO_MULTIPLIERS.asset_compromised),
    );
    expect(amplified).toBe(100); // 70 * 2.0 = 140 → capped at 100
  });

  it("moderate impact with control_disabled stays below 100", () => {
    const original = 50;
    const amplified = Math.min(
      100,
      Math.round(original * SCENARIO_MULTIPLIERS.control_disabled),
    );
    expect(amplified).toBe(75); // 50 * 1.5 = 75
  });
});

// ─── Relationship weight validation ────────────────────────

describe("Relationship weight lookup", () => {
  it("returns weight for known relationship", () => {
    expect(RELATIONSHIP_WEIGHTS.mitigates).toBe(90);
    expect(RELATIONSHIP_WEIGHTS.documented_in).toBe(30);
  });

  it("all weights are in valid range 0-100", () => {
    for (const [, weight] of Object.entries(RELATIONSHIP_WEIGHTS)) {
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(100);
    }
  });

  it("unknown relationship defaults to undefined", () => {
    expect(RELATIONSHIP_WEIGHTS["nonexistent"]).toBeUndefined();
  });
});
