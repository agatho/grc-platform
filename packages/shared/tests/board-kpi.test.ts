// Tests für Board-KPI Pure Functions
// Bezug: packages/shared/src/board-kpi.ts

import { describe, it, expect } from "vitest";
import {
  isAppetiteBreach,
  computeBreachDelta,
  computeAssuranceScore,
  computeSecurityPosture,
  computeScoreTrend,
} from "../src/board-kpi";

describe("isAppetiteBreach", () => {
  it("returns true when residual > max", () => {
    expect(isAppetiteBreach({ residualScore: 15, maxResidualScore: 10 })).toBe(
      true,
    );
  });

  it("returns false when residual <= max", () => {
    expect(isAppetiteBreach({ residualScore: 10, maxResidualScore: 10 })).toBe(
      false,
    );
    expect(isAppetiteBreach({ residualScore: 5, maxResidualScore: 10 })).toBe(
      false,
    );
  });
});

describe("computeBreachDelta", () => {
  it("returns positive delta when over threshold", () => {
    expect(computeBreachDelta(15, 10)).toBe(5);
  });

  it("returns 0 when at threshold", () => {
    expect(computeBreachDelta(10, 10)).toBe(0);
  });

  it("returns 0 when under threshold (no negative delta)", () => {
    expect(computeBreachDelta(5, 10)).toBe(0);
  });
});

describe("computeAssuranceScore", () => {
  const baseData = {
    avgEvidenceAgeDays: 0,
    totalControls: 100,
    testedControls: 100,
    measuredCount: 100,
    estimatedCount: 0,
    thirdLinePercent: 100,
    secondLinePercent: 0,
    firstLinePercent: 0,
    totalEvidence: 100,
    autoCollectedEvidence: 100,
  };

  it("returns 100 for perfect input", () => {
    const r = computeAssuranceScore("isms", baseData);
    expect(r.score).toBe(100);
    expect(r.recommendations).toEqual([]);
  });

  it("score is bounded 0-100", () => {
    const r = computeAssuranceScore("isms", {
      ...baseData,
      avgEvidenceAgeDays: 9999,
      testedControls: 0,
      measuredCount: 0,
      estimatedCount: 100,
      thirdLinePercent: 0,
      autoCollectedEvidence: 0,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("emits recommendation when evidence age is high", () => {
    const r = computeAssuranceScore("isms", {
      ...baseData,
      avgEvidenceAgeDays: 200, // -> evidenceAge = 100 - 200/3.65 ≈ 45 < 60
    });
    expect(
      r.recommendations.some((rec) => rec.action.includes("Evidenz")),
    ).toBe(true);
  });

  it("emits recommendation when test coverage low", () => {
    const r = computeAssuranceScore("isms", {
      ...baseData,
      testedControls: 50, // 50% < 80%
    });
    expect(
      r.recommendations.some((rec) => rec.action.includes("Control-Tests")),
    ).toBe(true);
  });

  it("emits recommendation when data quality low", () => {
    const r = computeAssuranceScore("isms", {
      ...baseData,
      measuredCount: 30,
      estimatedCount: 70, // 30% measured < 70%
    });
    expect(
      r.recommendations.some((rec) => rec.action.includes("Schätzwerte")),
    ).toBe(true);
  });

  it("emits recommendation when assessment source weak", () => {
    const r = computeAssuranceScore("isms", {
      ...baseData,
      thirdLinePercent: 0,
      secondLinePercent: 0,
      firstLinePercent: 100, // = 40 weighted < 50
    });
    expect(
      r.recommendations.some((rec) => rec.action.includes("2nd/3rd Line")),
    ).toBe(true);
  });

  it("emits recommendation when automation low", () => {
    const r = computeAssuranceScore("isms", {
      ...baseData,
      autoCollectedEvidence: 30, // 30% < 60%
    });
    expect(
      r.recommendations.some((rec) =>
        rec.action.includes("Automatisierte Evidenz"),
      ),
    ).toBe(true);
  });

  it("returns factors object with all 5 dimensions", () => {
    const r = computeAssuranceScore("isms", baseData);
    expect(r.factors).toEqual(
      expect.objectContaining({
        evidenceAge: expect.any(Number),
        testCoverage: expect.any(Number),
        dataQuality: expect.any(Number),
        assessmentSource: expect.any(Number),
        automationLevel: expect.any(Number),
      }),
    );
  });

  it("respects custom weights", () => {
    const customWeights = {
      evidenceAge: 1.0,
      testCoverage: 0,
      dataQuality: 0,
      assessmentSource: 0,
      automationLevel: 0,
    };
    const r = computeAssuranceScore(
      "isms",
      { ...baseData, avgEvidenceAgeDays: 0 },
      customWeights,
    );
    expect(r.score).toBe(100); // evidenceAge=100 × 1.0
  });
});

describe("computeSecurityPosture", () => {
  const baseData = {
    totalAssets: 100,
    assetsWithPRQ: 100,
    avgMaturity: 5,
    avgCES: 100,
    criticalVulns: 0,
    highVulns: 0,
    avgTTRDays: 0,
    avgAssessmentAgeDays: 0,
    totalAnnexAControls: 93,
    assessedControls: 93,
  };

  it("returns 100 for perfect input", () => {
    const r = computeSecurityPosture(baseData);
    expect(r.score).toBe(100);
  });

  it("penalises critical vulnerabilities (20 points each)", () => {
    const r = computeSecurityPosture({ ...baseData, criticalVulns: 5 });
    expect(r.factors.vulnExposure).toBe(0); // max(0, 100-100)
    expect(r.score).toBeLessThan(100);
  });

  it("penalises high vulnerabilities (10 points each)", () => {
    const r = computeSecurityPosture({ ...baseData, highVulns: 5 });
    expect(r.factors.vulnExposure).toBe(50);
  });

  it("clamps score to 0-100 range", () => {
    const r = computeSecurityPosture({
      ...baseData,
      criticalVulns: 99,
      avgMaturity: 0,
      avgCES: 0,
      avgTTRDays: 999,
      avgAssessmentAgeDays: 9999,
      totalAssets: 0,
      assetsWithPRQ: 0,
      totalAnnexAControls: 0,
      assessedControls: 0,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("returns 7-factor breakdown", () => {
    const r = computeSecurityPosture(baseData);
    expect(r.factors).toEqual(
      expect.objectContaining({
        assetCoverage: expect.any(Number),
        maturity: expect.any(Number),
        ces: expect.any(Number),
        vulnExposure: expect.any(Number),
        incidentTTR: expect.any(Number),
        freshness: expect.any(Number),
        soaCompleteness: expect.any(Number),
      }),
    );
  });

  it("zero-asset org returns 0 assetCoverage", () => {
    const r = computeSecurityPosture({
      ...baseData,
      totalAssets: 0,
      assetsWithPRQ: 0,
    });
    expect(r.factors.assetCoverage).toBe(0);
  });
});

describe("computeScoreTrend", () => {
  it("returns stable when previous is null", () => {
    expect(computeScoreTrend(80, null)).toBe("stable");
  });

  it("returns improving when delta > 3", () => {
    expect(computeScoreTrend(85, 80)).toBe("improving");
  });

  it("returns declining when delta < -3", () => {
    expect(computeScoreTrend(75, 80)).toBe("declining");
  });

  it("returns stable for small changes", () => {
    expect(computeScoreTrend(82, 80)).toBe("stable");
    expect(computeScoreTrend(78, 80)).toBe("stable");
    expect(computeScoreTrend(80, 80)).toBe("stable");
  });

  it("threshold is exactly 3 (exclusive)", () => {
    expect(computeScoreTrend(83, 80)).toBe("stable"); // delta=3, not >
    expect(computeScoreTrend(83.1, 80)).toBe("improving");
    expect(computeScoreTrend(77, 80)).toBe("stable");
    expect(computeScoreTrend(76.9, 80)).toBe("declining");
  });
});
