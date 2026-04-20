import { describe, it, expect } from "vitest";
import {
  upsertFairParametersSchema,
  runSimulationSchema,
  fairTopRisksQuerySchema,
  fairCompareQuerySchema,
  updateRiskMethodologySchema,
} from "../src/schemas/fair";

describe("upsertFairParametersSchema", () => {
  it("validates correct parameters", () => {
    const result = upsertFairParametersSchema.safeParse({
      lefMin: 0.1,
      lefMostLikely: 1,
      lefMax: 5,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    });
    expect(result.success).toBe(true);
  });

  it("validates with loss components", () => {
    const result = upsertFairParametersSchema.safeParse({
      lefMin: 0.1,
      lefMostLikely: 1,
      lefMax: 5,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
      lossComponents: {
        productivity: 30,
        response: 20,
        replacement: 10,
        fines: 15,
        judgments: 10,
        reputation: 15,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects LEF out of order", () => {
    const result = upsertFairParametersSchema.safeParse({
      lefMin: 5,
      lefMostLikely: 1,
      lefMax: 0.1,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects LM out of order", () => {
    const result = upsertFairParametersSchema.safeParse({
      lefMin: 0.1,
      lefMostLikely: 1,
      lefMax: 5,
      lmMin: 1000000,
      lmMostLikely: 200000,
      lmMax: 50000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative LEF", () => {
    const result = upsertFairParametersSchema.safeParse({
      lefMin: -1,
      lefMostLikely: 1,
      lefMax: 5,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects loss components not summing to 100", () => {
    const result = upsertFairParametersSchema.safeParse({
      lefMin: 0.1,
      lefMostLikely: 1,
      lefMax: 5,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
      lossComponents: {
        productivity: 50,
        response: 50,
        replacement: 50,
        fines: 0,
        judgments: 0,
        reputation: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects LEF max = 0", () => {
    const result = upsertFairParametersSchema.safeParse({
      lefMin: 0,
      lefMostLikely: 0,
      lefMax: 0,
      lmMin: 50000,
      lmMostLikely: 200000,
      lmMax: 1000000,
    });
    expect(result.success).toBe(false);
  });
});

describe("runSimulationSchema", () => {
  it("validates correct iterations", () => {
    expect(runSimulationSchema.safeParse({ iterations: 10000 }).success).toBe(
      true,
    );
    expect(runSimulationSchema.safeParse({ iterations: 1000 }).success).toBe(
      true,
    );
    expect(runSimulationSchema.safeParse({ iterations: 100000 }).success).toBe(
      true,
    );
  });

  it("rejects out-of-range iterations", () => {
    expect(runSimulationSchema.safeParse({ iterations: 50 }).success).toBe(
      false,
    );
    expect(runSimulationSchema.safeParse({ iterations: 200000 }).success).toBe(
      false,
    );
  });
});

describe("fairTopRisksQuerySchema", () => {
  it("validates and defaults", () => {
    const result = fairTopRisksQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it("accepts custom limit", () => {
    const result = fairTopRisksQuerySchema.safeParse({ limit: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
    }
  });
});

describe("fairCompareQuerySchema", () => {
  it("parses comma-separated IDs", () => {
    const result = fairCompareQuerySchema.safeParse({
      riskIds: "abc,def,ghi",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskIds).toEqual(["abc", "def", "ghi"]);
    }
  });

  it("handles empty string", () => {
    const result = fairCompareQuerySchema.safeParse({ riskIds: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskIds).toEqual([]);
    }
  });
});

describe("updateRiskMethodologySchema", () => {
  it("validates all methodologies", () => {
    expect(
      updateRiskMethodologySchema.safeParse({ riskMethodology: "qualitative" })
        .success,
    ).toBe(true);
    expect(
      updateRiskMethodologySchema.safeParse({ riskMethodology: "fair" })
        .success,
    ).toBe(true);
    expect(
      updateRiskMethodologySchema.safeParse({ riskMethodology: "hybrid" })
        .success,
    ).toBe(true);
  });

  it("rejects invalid methodology", () => {
    expect(
      updateRiskMethodologySchema.safeParse({ riskMethodology: "invalid" })
        .success,
    ).toBe(false);
  });
});
