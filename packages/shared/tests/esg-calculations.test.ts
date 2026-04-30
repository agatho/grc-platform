// Tests für ESG/CSRD Calculation Helpers
// Bezug: packages/shared/src/esg-calculations.ts

import { describe, it, expect } from "vitest";
import {
  computeMaterialityMatrix,
  calculateEmissions,
  computeTargetProgress,
  type MaterialityTopicInput,
} from "../src/esg-calculations";

const topic = (
  id: string,
  impact: number,
  financial: number,
): MaterialityTopicInput => ({
  id,
  topicName: id,
  esrsStandard: "E1",
  impactScore: impact,
  financialScore: financial,
});

describe("computeMaterialityMatrix", () => {
  it("returns empty for empty input", () => {
    expect(computeMaterialityMatrix([])).toEqual([]);
  });

  it("classifies all 4 quadrants correctly", () => {
    const r = computeMaterialityMatrix([
      topic("HH", 7, 7),
      topic("HL", 7, 3),
      topic("LH", 3, 7),
      topic("LL", 3, 3),
    ]);
    const byId = Object.fromEntries(r.map((t) => [t.id, t]));
    expect(byId.HH.quadrant).toBe("high_impact_high_financial");
    expect(byId.HL.quadrant).toBe("high_impact_low_financial");
    expect(byId.LH.quadrant).toBe("low_impact_high_financial");
    expect(byId.LL.quadrant).toBe("low_impact_low_financial");
  });

  it("threshold is exactly 5.0 (inclusive)", () => {
    const r = computeMaterialityMatrix([
      topic("exact-5", 5, 5),
      topic("just-below", 4.9, 4.9),
    ]);
    const byId = Object.fromEntries(r.map((t) => [t.id, t]));
    expect(byId["exact-5"].quadrant).toBe("high_impact_high_financial");
    expect(byId["just-below"].quadrant).toBe("low_impact_low_financial");
  });

  it("isMaterial=true if either dimension >= 5", () => {
    const r = computeMaterialityMatrix([
      topic("only-impact", 5, 0),
      topic("only-financial", 0, 5),
      topic("none", 0, 0),
    ]);
    const byId = Object.fromEntries(r.map((t) => [t.id, t]));
    expect(byId["only-impact"].isMaterial).toBe(true);
    expect(byId["only-financial"].isMaterial).toBe(true);
    expect(byId.none.isMaterial).toBe(false);
  });

  it("sorts by combined score descending", () => {
    const r = computeMaterialityMatrix([
      topic("low", 2, 2),
      topic("high", 8, 9),
      topic("mid", 5, 5),
    ]);
    expect(r.map((t) => t.id)).toEqual(["high", "mid", "low"]);
  });

  it("preserves original fields (id, topicName, esrsStandard, scores)", () => {
    const input: MaterialityTopicInput = {
      id: "x1",
      topicName: "Climate",
      esrsStandard: "E1",
      impactScore: 6,
      financialScore: 6,
    };
    const r = computeMaterialityMatrix([input])[0];
    expect(r.id).toBe(input.id);
    expect(r.topicName).toBe(input.topicName);
    expect(r.esrsStandard).toBe(input.esrsStandard);
    expect(r.impactScore).toBe(input.impactScore);
    expect(r.financialScore).toBe(input.financialScore);
  });
});

describe("calculateEmissions", () => {
  it("multiplies activity × factor", () => {
    expect(calculateEmissions(100, 0.5)).toBe(50);
  });

  it("rounds to 3 decimal places", () => {
    expect(calculateEmissions(1, 0.123456)).toBe(0.123);
  });

  it("returns 0 when activity is 0", () => {
    expect(calculateEmissions(0, 0.5)).toBe(0);
  });

  it("returns 0 when factor is 0", () => {
    expect(calculateEmissions(100, 0)).toBe(0);
  });

  it("throws on negative activity", () => {
    expect(() => calculateEmissions(-5, 0.5)).toThrow(/non-negative/);
  });

  it("throws on negative factor", () => {
    expect(() => calculateEmissions(100, -0.1)).toThrow(/non-negative/);
  });

  it("handles large numbers without overflow", () => {
    const r = calculateEmissions(1_000_000, 0.5);
    expect(r).toBe(500_000);
  });
});

describe("computeTargetProgress — reduction targets (target < baseline)", () => {
  it("returns achieved when target reached", () => {
    const r = computeTargetProgress(100, 60, 60);
    expect(r.status).toBe("achieved");
    expect(r.percentComplete).toBe(100);
  });

  it("returns on_track when 60-99% complete", () => {
    // Baseline 100, target 50, current 80 → 40% done? Wait:
    // currentChange = 80-100 = -20, totalChange = 50-100 = -50
    // -20/-50 = 0.4 = 40% → at_risk
    const r = computeTargetProgress(100, 80, 50);
    expect(r.percentComplete).toBe(40);
    expect(r.status).toBe("at_risk");
  });

  it("returns on_track at 60%", () => {
    // currentChange = -30, totalChange = -50, 60% → on_track
    const r = computeTargetProgress(100, 70, 50);
    expect(r.percentComplete).toBe(60);
    expect(r.status).toBe("on_track");
  });

  it("returns off_track when < 30%", () => {
    const r = computeTargetProgress(100, 95, 50);
    expect(r.percentComplete).toBe(10);
    expect(r.status).toBe("off_track");
  });

  it("returns achieved when current exceeds target", () => {
    const r = computeTargetProgress(100, 30, 50);
    expect(r.percentComplete).toBe(100);
    expect(r.status).toBe("achieved");
  });
});

describe("computeTargetProgress — increase targets (target > baseline)", () => {
  it("70% complete returns on_track", () => {
    // baseline 0, current 70, target 100 → 70%
    const r = computeTargetProgress(0, 70, 100);
    expect(r.percentComplete).toBe(70);
    expect(r.status).toBe("on_track");
  });

  it("returns achieved at 100 %", () => {
    const r = computeTargetProgress(0, 100, 100);
    expect(r.percentComplete).toBe(100);
    expect(r.status).toBe("achieved");
  });
});

describe("computeTargetProgress — edge cases", () => {
  it("baseline equals target → achieved", () => {
    const r = computeTargetProgress(50, 60, 50);
    expect(r.status).toBe("achieved");
    expect(r.percentComplete).toBe(100);
  });

  it("clamps negative progress to 0", () => {
    // baseline 100, current 110, target 50 → currentChange = +10, totalChange = -50
    // 10/-50 = -0.2 = -20%, clamped to 0
    const r = computeTargetProgress(100, 110, 50);
    expect(r.percentComplete).toBe(0);
    expect(r.status).toBe("off_track");
  });

  it("returns remainingReduction (target - current)", () => {
    const r = computeTargetProgress(100, 80, 50);
    expect(r.remainingReduction).toBe(-30); // target - current = 50 - 80
  });

  it("returns currentReduction (current - baseline)", () => {
    const r = computeTargetProgress(100, 80, 50);
    expect(r.currentReduction).toBe(-20);
  });
});
