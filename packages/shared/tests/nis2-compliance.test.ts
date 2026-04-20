// Unit tests for Sprint 24: NIS2 Compliance + Certification Readiness

import { describe, it, expect } from "vitest";
import {
  computeRequirementStatus,
  findMissingControls,
  computeSingleRequirement,
  computeNIS2OverallScore,
  computeCertReadinessScore,
  estimateWeeksToReadiness,
  NIS2_ART21_REQUIREMENTS,
  type ControlWithCES,
  type CertReadinessCheckResult,
  type NIS2RequirementResult,
} from "../src/nis2-compliance";

// ──────────────────────────────────────────────────────────────
// computeRequirementStatus
// ──────────────────────────────────────────────────────────────

describe("computeRequirementStatus", () => {
  it("marks requirement as compliant when all controls CES >= 80 + evidence", () => {
    const controls: ControlWithCES[] = [
      { annexARef: "A.5.1", ces: 85, hasEvidence: true },
      { annexARef: "A.5.2", ces: 90, hasEvidence: true },
    ];
    expect(computeRequirementStatus(controls)).toBe("compliant");
  });

  it("marks as partially_compliant when CES 50-79", () => {
    const controls: ControlWithCES[] = [
      { annexARef: "A.5.1", ces: 60, hasEvidence: true },
    ];
    expect(computeRequirementStatus(controls)).toBe("partially_compliant");
  });

  it("marks as partially_compliant when CES >= 80 but evidence incomplete", () => {
    const controls: ControlWithCES[] = [
      { annexARef: "A.5.1", ces: 90, hasEvidence: false },
    ];
    expect(computeRequirementStatus(controls)).toBe("partially_compliant");
  });

  it("marks as non_compliant when no controls mapped", () => {
    expect(computeRequirementStatus([])).toBe("non_compliant");
  });

  it("marks as non_compliant when CES below 50", () => {
    const controls: ControlWithCES[] = [
      { annexARef: "A.5.1", ces: 30, hasEvidence: true },
      { annexARef: "A.5.2", ces: 20, hasEvidence: true },
    ];
    expect(computeRequirementStatus(controls)).toBe("non_compliant");
  });

  it("averages CES correctly across multiple controls", () => {
    const controls: ControlWithCES[] = [
      { annexARef: "A.5.1", ces: 100, hasEvidence: true },
      { annexARef: "A.5.2", ces: 60, hasEvidence: true },
    ];
    // Average CES = 80, evidence complete => compliant
    expect(computeRequirementStatus(controls)).toBe("compliant");
  });
});

// ──────────────────────────────────────────────────────────────
// findMissingControls
// ──────────────────────────────────────────────────────────────

describe("findMissingControls", () => {
  it("identifies missing controls from mapping", () => {
    const mapped = ["A.5.1", "A.5.2", "A.8.1"];
    const existing = [{ annexARef: "A.5.1" }];
    expect(findMissingControls(mapped, existing)).toEqual(["A.5.2", "A.8.1"]);
  });

  it("returns empty array when all controls exist", () => {
    const mapped = ["A.5.1", "A.5.2"];
    const existing = [{ annexARef: "A.5.1" }, { annexARef: "A.5.2" }];
    expect(findMissingControls(mapped, existing)).toEqual([]);
  });

  it("returns all mappings when no controls exist", () => {
    const mapped = ["A.5.1", "A.5.2"];
    expect(findMissingControls(mapped, [])).toEqual(["A.5.1", "A.5.2"]);
  });
});

// ──────────────────────────────────────────────────────────────
// computeSingleRequirement
// ──────────────────────────────────────────────────────────────

describe("computeSingleRequirement", () => {
  const reqDef = NIS2_ART21_REQUIREMENTS[0]; // 21.2a

  it("computes requirement with full controls", () => {
    const controls: ControlWithCES[] = [
      { annexARef: "A.5.1", ces: 90, hasEvidence: true },
      { annexARef: "A.5.2", ces: 85, hasEvidence: true },
      { annexARef: "A.8.1", ces: 80, hasEvidence: true },
    ];
    const result = computeSingleRequirement(reqDef, controls);
    expect(result.status).toBe("compliant");
    expect(result.controlCount).toBe(3);
    expect(result.missingControls).toEqual([]);
    expect(result.evidenceComplete).toBe(true);
    expect(result.id).toBe("21.2a");
  });

  it("computes requirement with missing controls", () => {
    const controls: ControlWithCES[] = [
      { annexARef: "A.5.1", ces: 90, hasEvidence: true },
    ];
    const result = computeSingleRequirement(reqDef, controls);
    expect(result.missingControls).toContain("A.5.2");
    expect(result.missingControls).toContain("A.8.1");
  });

  it("computes requirement with no controls", () => {
    const result = computeSingleRequirement(reqDef, []);
    expect(result.status).toBe("non_compliant");
    expect(result.avgCES).toBe(0);
    expect(result.controlCount).toBe(0);
    expect(result.evidenceComplete).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// computeNIS2OverallScore
// ──────────────────────────────────────────────────────────────

describe("computeNIS2OverallScore", () => {
  it("returns 100 when all requirements are compliant", () => {
    const requirements: NIS2RequirementResult[] = NIS2_ART21_REQUIREMENTS.map(
      (r) => ({
        ...r,
        status: "compliant" as const,
        avgCES: 90,
        controlCount: 3,
        missingControls: [],
        evidenceComplete: true,
      }),
    );
    expect(computeNIS2OverallScore(requirements)).toBe(100);
  });

  it("returns 0 when all requirements are non-compliant", () => {
    const requirements: NIS2RequirementResult[] = NIS2_ART21_REQUIREMENTS.map(
      (r) => ({
        ...r,
        status: "non_compliant" as const,
        avgCES: 0,
        controlCount: 0,
        missingControls: r.isoMapping,
        evidenceComplete: false,
      }),
    );
    expect(computeNIS2OverallScore(requirements)).toBe(0);
  });

  it("returns 50 when all requirements are partially compliant", () => {
    const requirements: NIS2RequirementResult[] = NIS2_ART21_REQUIREMENTS.map(
      (r) => ({
        ...r,
        status: "partially_compliant" as const,
        avgCES: 60,
        controlCount: 2,
        missingControls: [],
        evidenceComplete: false,
      }),
    );
    expect(computeNIS2OverallScore(requirements)).toBe(50);
  });

  it("returns 0 for empty requirements", () => {
    expect(computeNIS2OverallScore([])).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// computeCertReadinessScore
// ──────────────────────────────────────────────────────────────

describe("computeCertReadinessScore", () => {
  it("returns 100% when all checks pass", () => {
    const checks: CertReadinessCheckResult[] = Array.from(
      { length: 10 },
      (_, i) => ({
        id: `check_${i}`,
        labelDE: `Pruefung ${i}`,
        labelEN: `Check ${i}`,
        category: "test",
        passed: true,
      }),
    );
    const result = computeCertReadinessScore(checks);
    expect(result.score).toBe(100);
    expect(result.passedCount).toBe(10);
    expect(result.totalChecks).toBe(10);
  });

  it("returns 0% when no checks pass", () => {
    const checks: CertReadinessCheckResult[] = Array.from(
      { length: 10 },
      (_, i) => ({
        id: `check_${i}`,
        labelDE: `Pruefung ${i}`,
        labelEN: `Check ${i}`,
        category: "test",
        passed: false,
      }),
    );
    const result = computeCertReadinessScore(checks);
    expect(result.score).toBe(0);
    expect(result.passedCount).toBe(0);
  });

  it("returns correct percentage for mixed results", () => {
    const checks: CertReadinessCheckResult[] = [
      { id: "c1", labelDE: "P1", labelEN: "C1", category: "a", passed: true },
      { id: "c2", labelDE: "P2", labelEN: "C2", category: "a", passed: true },
      { id: "c3", labelDE: "P3", labelEN: "C3", category: "a", passed: false },
      { id: "c4", labelDE: "P4", labelEN: "C4", category: "a", passed: true },
    ];
    const result = computeCertReadinessScore(checks);
    expect(result.score).toBe(75);
    expect(result.passedCount).toBe(3);
    expect(result.totalChecks).toBe(4);
  });

  it("identifies specific failures", () => {
    const checks: CertReadinessCheckResult[] = [
      {
        id: "soa_complete",
        labelDE: "SoA",
        labelEN: "SoA",
        category: "doc",
        passed: false,
      },
      {
        id: "mgmt_review",
        labelDE: "Review",
        labelEN: "Review",
        category: "gov",
        passed: true,
      },
    ];
    const result = computeCertReadinessScore(checks);
    const soaCheck = result.checks.find((c) => c.id === "soa_complete");
    expect(soaCheck?.passed).toBe(false);
  });

  it("handles empty checks", () => {
    const result = computeCertReadinessScore([]);
    expect(result.score).toBe(0);
    expect(result.passedCount).toBe(0);
    expect(result.totalChecks).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// estimateWeeksToReadiness
// ──────────────────────────────────────────────────────────────

describe("estimateWeeksToReadiness", () => {
  it("returns 0 when no gaps", () => {
    expect(estimateWeeksToReadiness(0, 5)).toBe(0);
  });

  it("returns null when no closures", () => {
    expect(estimateWeeksToReadiness(10, 0)).toBeNull();
  });

  it("returns null when negative closures", () => {
    expect(estimateWeeksToReadiness(10, -1)).toBeNull();
  });

  it("estimates correctly based on closure rate", () => {
    // 10 gaps, 5 closed per month = 2 months = ~8 weeks
    const result = estimateWeeksToReadiness(10, 5);
    expect(result).toBe(8);
  });

  it("rounds up partial weeks", () => {
    // 3 gaps, 2 closed per month = 1.5 months = 6 weeks
    const result = estimateWeeksToReadiness(3, 2);
    expect(result).toBe(6);
  });
});

// ──────────────────────────────────────────────────────────────
// NIS2_ART21_REQUIREMENTS constants
// ──────────────────────────────────────────────────────────────

describe("NIS2_ART21_REQUIREMENTS", () => {
  it("contains exactly 10 requirements", () => {
    expect(NIS2_ART21_REQUIREMENTS).toHaveLength(10);
  });

  it("all requirements have valid structure", () => {
    for (const req of NIS2_ART21_REQUIREMENTS) {
      expect(req.id).toBeTruthy();
      expect(req.article).toBeTruthy();
      expect(req.chapter).toBeTruthy();
      expect(req.nameDE).toBeTruthy();
      expect(req.nameEN).toBeTruthy();
      expect(req.isoMapping.length).toBeGreaterThan(0);
      expect(req.weight).toBeGreaterThan(0);
    }
  });

  it("total weight sums to 100", () => {
    const totalWeight = NIS2_ART21_REQUIREMENTS.reduce(
      (sum, r) => sum + r.weight,
      0,
    );
    expect(totalWeight).toBe(100);
  });

  it("all IDs follow pattern 21.2[a-j]", () => {
    for (const req of NIS2_ART21_REQUIREMENTS) {
      expect(req.id).toMatch(/^21\.2[a-j]$/);
    }
  });
});
