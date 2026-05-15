// #WAVE21-MAR-P2-03: regression guards for the BIA → Asset
// classification cascade. The mapping rules + max-wins semantics
// are easy to break in a refactor; these tests pin the contract
// against the design call.

import { describe, it, expect } from "vitest";
import {
  deriveAssetClassifications,
  priorityToProtectionLevel,
} from "../src/cascades/bia-asset-criticality";

describe("priorityToProtectionLevel", () => {
  it("maps priority 1 to very_high (mission-critical)", () => {
    expect(priorityToProtectionLevel(1, false)).toBe("very_high");
  });

  it("maps priority 2 and 3 to high (important)", () => {
    expect(priorityToProtectionLevel(2, false)).toBe("high");
    expect(priorityToProtectionLevel(3, false)).toBe("high");
  });

  it("maps priority 4-5+ to normal (supporting)", () => {
    expect(priorityToProtectionLevel(4, false)).toBe("normal");
    expect(priorityToProtectionLevel(5, false)).toBe("normal");
    expect(priorityToProtectionLevel(99, false)).toBe("normal");
  });

  it("treats unscored isEssential as high (defensive default)", () => {
    expect(priorityToProtectionLevel(null, true)).toBe("high");
  });

  it("treats unscored non-essential as normal", () => {
    expect(priorityToProtectionLevel(null, false)).toBe("normal");
  });
});

describe("deriveAssetClassifications", () => {
  it("returns empty when no impacts or links", () => {
    expect(deriveAssetClassifications([], [])).toEqual([]);
  });

  it("derives a single classification per linked asset", () => {
    const result = deriveAssetClassifications(
      [{ processId: "p1", priorityRanking: 2, isEssential: true }],
      [{ processId: "p1", assetId: "a1" }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe("a1");
    expect(result[0].protectionLevel).toBe("high");
    expect(result[0].drivingPriority).toBe(2);
  });

  it("applies max-wins when an asset is in multiple processes", () => {
    const result = deriveAssetClassifications(
      [
        { processId: "p1", priorityRanking: 5, isEssential: false },
        { processId: "p2", priorityRanking: 1, isEssential: true },
        { processId: "p3", priorityRanking: 3, isEssential: false },
      ],
      [
        { processId: "p1", assetId: "shared" },
        { processId: "p2", assetId: "shared" },
        { processId: "p3", assetId: "shared" },
      ],
    );
    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe("shared");
    expect(result[0].protectionLevel).toBe("very_high"); // p2 wins
    expect(result[0].drivingProcessId).toBe("p2");
  });

  it("essential beats non-essential at same priority", () => {
    const result = deriveAssetClassifications(
      [
        { processId: "p1", priorityRanking: 3, isEssential: false },
        { processId: "p2", priorityRanking: 3, isEssential: true },
      ],
      [
        { processId: "p1", assetId: "shared" },
        { processId: "p2", assetId: "shared" },
      ],
    );
    expect(result[0].drivingProcessId).toBe("p2");
    expect(result[0].isEssential).toBe(true);
  });

  it("scored process beats unscored with same essential flag", () => {
    const result = deriveAssetClassifications(
      [
        { processId: "p1", priorityRanking: null, isEssential: true },
        { processId: "p2", priorityRanking: 2, isEssential: true },
      ],
      [
        { processId: "p1", assetId: "shared" },
        { processId: "p2", assetId: "shared" },
      ],
    );
    expect(result[0].drivingProcessId).toBe("p2");
    expect(result[0].drivingPriority).toBe(2);
  });

  it("ignores links pointing at impacts not in the input set", () => {
    const result = deriveAssetClassifications(
      [{ processId: "p1", priorityRanking: 2, isEssential: false }],
      [
        { processId: "p1", assetId: "a1" },
        { processId: "ghost", assetId: "a2" }, // no impact for ghost
      ],
    );
    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe("a1");
  });
});
