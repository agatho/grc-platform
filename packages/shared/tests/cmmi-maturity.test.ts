// #WAVE22-MAR-P2-04: regression guards for the CMMI maturity
// derivation. The two-stage filter + re-normalisation rules need to
// stay locked so a future refactor doesn't silently drift the
// platform's "how mature is this org?" answer.

import { describe, it, expect } from "vitest";
import {
  calculateMaturity,
  DEFAULT_WEIGHTS,
  MIN_SAMPLES_PER_SOURCE,
} from "../src/maturity/cmmi";

const stub = (
  source: keyof typeof DEFAULT_WEIGHTS,
  enabled: boolean,
  dataCount: number,
  score: number,
) => ({ source, moduleEnabled: enabled, dataCount, score });

describe("calculateMaturity — bucketing", () => {
  it("CMMI ML1 for score < 40", () => {
    const r = calculateMaturity([
      stub("controls", true, 5, 30),
      stub("incidents", true, 5, 35),
    ]);
    expect(r.level).toBe(1);
    expect(r.levelLabel).toBe("Initial");
  });

  it("CMMI ML2 for score 40-59", () => {
    const r = calculateMaturity([
      stub("controls", true, 5, 50),
      stub("incidents", true, 5, 50),
    ]);
    expect(r.level).toBe(2);
    expect(r.levelLabel).toBe("Managed");
  });

  it("CMMI ML3 for score 60-79", () => {
    const r = calculateMaturity([
      stub("controls", true, 5, 70),
      stub("incidents", true, 5, 70),
    ]);
    expect(r.level).toBe(3);
    expect(r.levelLabel).toBe("Defined");
  });

  it("CMMI ML4 for score 80-89", () => {
    const r = calculateMaturity([
      stub("controls", true, 5, 85),
      stub("incidents", true, 5, 85),
    ]);
    expect(r.level).toBe(4);
  });

  it("CMMI ML5 for score >= 90", () => {
    const r = calculateMaturity([
      stub("controls", true, 5, 95),
      stub("incidents", true, 5, 95),
    ]);
    expect(r.level).toBe(5);
    expect(r.levelLabel).toBe("Optimizing");
  });
});

describe("calculateMaturity — two-stage filter", () => {
  it("excludes module_disabled sources without dragging down score", () => {
    const r = calculateMaturity([
      stub("controls", true, 18, 80),
      stub("incidents", true, 3, 70),
      stub("esg", false, 0, 0), // disabled — would tank the score
    ]);
    expect(r.activeSources).toHaveLength(2);
    expect(r.excludedSources).toEqual([
      { source: "esg", reason: "module_disabled", dataCount: 0, minSamples: 1 },
    ]);
    // Active sources: controls + incidents. Re-normalised weights:
    // 0.35/(0.35+0.20)=0.636 + 0.20/(0.35+0.20)=0.364
    // → 80*0.636 + 70*0.364 = 50.9 + 25.5 = 76.4 → ML3
    expect(r.score).toBe(76);
    expect(r.level).toBe(3);
  });

  it("excludes enabled-but-empty sources (no_data)", () => {
    const r = calculateMaturity([
      stub("controls", true, 5, 75),
      stub("incidents", true, 5, 60),
      stub("audits", true, 0, 0), // enabled but no data
    ]);
    expect(r.excludedSources).toEqual([
      { source: "audits", reason: "no_data", dataCount: 0, minSamples: 1 },
    ]);
    expect(r.activeSources).toHaveLength(2);
  });

  it("excludes below-threshold sources (training needs ≥5)", () => {
    expect(MIN_SAMPLES_PER_SOURCE.training).toBe(5);
    const r = calculateMaturity([
      stub("controls", true, 5, 70),
      stub("incidents", true, 5, 70),
      stub("training", true, 2, 90), // enabled, has data, but below threshold
    ]);
    expect(r.excludedSources).toEqual([
      {
        source: "training",
        reason: "below_threshold",
        dataCount: 2,
        minSamples: 5,
      },
    ]);
  });
});

describe("calculateMaturity — confidence tag", () => {
  it("high when every input is active", () => {
    const r = calculateMaturity([
      stub("controls", true, 5, 70),
      stub("incidents", true, 5, 70),
    ]);
    expect(r.confidence).toBe("high");
  });

  it("limited when some inputs were excluded", () => {
    const r = calculateMaturity([
      stub("controls", true, 5, 70),
      stub("incidents", true, 5, 70),
      stub("esg", false, 0, 0),
    ]);
    expect(r.confidence).toBe("limited");
  });

  it("insufficient when <2 sources active → level null", () => {
    const r = calculateMaturity([
      stub("controls", true, 5, 95), // only one source active
      stub("incidents", false, 0, 0),
      stub("audits", true, 0, 0),
    ]);
    expect(r.confidence).toBe("insufficient");
    expect(r.level).toBeNull();
    expect(r.score).toBeNull();
    expect(r.note).toMatch(/at least 2 active sources/);
  });
});

describe("calculateMaturity — weight overrides", () => {
  it("respects custom weights", () => {
    const r = calculateMaturity(
      [stub("controls", true, 5, 100), stub("incidents", true, 5, 0)],
      { weights: { controls: 0.9, incidents: 0.1 } },
    );
    // Re-normalised: 0.9/1.0=0.9, 0.1/1.0=0.1
    // 100*0.9 + 0*0.1 = 90 → ML5
    expect(r.score).toBe(90);
    expect(r.level).toBe(5);
  });

  it("falls back to equal-weight when custom weights all zero", () => {
    const r = calculateMaturity(
      [stub("controls", true, 5, 60), stub("incidents", true, 5, 80)],
      { weights: { controls: 0, incidents: 0 } },
    );
    // Edge case: equal weight 0.5 each → 60*0.5 + 80*0.5 = 70 → ML3
    expect(r.score).toBe(70);
    expect(r.level).toBe(3);
  });
});
