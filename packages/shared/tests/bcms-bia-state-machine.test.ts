import { describe, it, expect } from "vitest";
import {
  BIA_ALLOWED_TRANSITIONS,
  validateBcmsGate1Setup,
  validateBcmsGate2Coverage,
  validateBiaTransition,
  type BiaSnapshot,
  type BiaCoverageStats,
} from "../src/state-machines/bcms-bia";

const validSnapshot: BiaSnapshot = {
  status: "draft",
  name: "BIA 2026",
  description: "Test",
  periodStart: "2026-05-01",
  periodEnd: "2026-06-30",
  leadAssessorId: "00000000-0000-0000-0000-000000000001",
  totalProcessImpacts: 10,
  scoredImpacts: 9,
  essentialCount: 4,
};

const validCoverage: BiaCoverageStats = {
  totalProcessImpacts: 10,
  scoredImpacts: 9,
  essentialCount: 4,
  minimumEssentialCount: 3,
};

describe("BIA_ALLOWED_TRANSITIONS", () => {
  it("draft -> in_progress", () => {
    expect(BIA_ALLOWED_TRANSITIONS.draft).toContain("in_progress");
  });
  it("review -> approved", () => {
    expect(BIA_ALLOWED_TRANSITIONS.review).toContain("approved");
  });
  it("approved -> archived (only)", () => {
    expect(BIA_ALLOWED_TRANSITIONS.approved).toEqual(["archived"]);
  });
  it("archived is terminal", () => {
    expect(BIA_ALLOWED_TRANSITIONS.archived).toEqual([]);
  });
});

describe("validateBcmsGate1Setup", () => {
  it("passes with valid snapshot", () => {
    const blockers = validateBcmsGate1Setup(validSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks if name missing", () => {
    const blockers = validateBcmsGate1Setup({ ...validSnapshot, name: "" });
    expect(blockers.some((b) => b.code === "missing_name")).toBe(true);
  });
  it("blocks if lead-assessor missing", () => {
    const blockers = validateBcmsGate1Setup({
      ...validSnapshot,
      leadAssessorId: null,
    });
    expect(blockers.some((b) => b.code === "missing_lead_assessor")).toBe(true);
  });
  it("blocks if period too short", () => {
    const blockers = validateBcmsGate1Setup({
      ...validSnapshot,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-03",
    });
    expect(blockers.some((b) => b.code === "period_too_short")).toBe(true);
  });
});

describe("validateBcmsGate2Coverage", () => {
  it("passes with >= 80% coverage + enough essentials", () => {
    const blockers = validateBcmsGate2Coverage(validCoverage);
    expect(blockers).toHaveLength(0);
  });
  it("blocks with no impacts", () => {
    const blockers = validateBcmsGate2Coverage({
      totalProcessImpacts: 0,
      scoredImpacts: 0,
      essentialCount: 0,
      minimumEssentialCount: 3,
    });
    expect(blockers.some((b) => b.code === "no_process_impacts")).toBe(true);
  });
  it("blocks at 79% coverage", () => {
    const blockers = validateBcmsGate2Coverage({
      ...validCoverage,
      scoredImpacts: 7, // 7/10 = 70%
    });
    expect(
      blockers.some((b) => b.code === "score_coverage_below_threshold"),
    ).toBe(true);
  });
  it("warns if not enough essentials (< minimumEssentialCount)", () => {
    const blockers = validateBcmsGate2Coverage({
      ...validCoverage,
      essentialCount: 2,
    });
    const warn = blockers.find((b) => b.code === "not_enough_essentials");
    expect(warn).toBeDefined();
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateBiaTransition", () => {
  it("blocks invalid transitions", () => {
    const result = validateBiaTransition({
      currentStatus: "draft",
      targetStatus: "approved",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers[0].code).toBe("invalid_transition");
  });

  it("runs B1 on draft -> in_progress", () => {
    const result = validateBiaTransition({
      currentStatus: "draft",
      targetStatus: "in_progress",
      snapshot: { ...validSnapshot, name: "" },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "B1")).toBe(true);
  });

  it("allows draft -> in_progress when B1 passes", () => {
    const result = validateBiaTransition({
      currentStatus: "draft",
      targetStatus: "in_progress",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(true);
  });

  it("requires coverageStats for in_progress -> review", () => {
    const result = validateBiaTransition({
      currentStatus: "in_progress",
      targetStatus: "review",
      snapshot: validSnapshot,
      // Note: coverageStats missing
    });
    expect(result.allowed).toBe(false);
    expect(
      result.blockers.some((b) => b.code === "missing_coverage_stats"),
    ).toBe(true);
  });

  it("runs B2 on in_progress -> review", () => {
    const result = validateBiaTransition({
      currentStatus: "in_progress",
      targetStatus: "review",
      snapshot: validSnapshot,
      coverageStats: {
        ...validCoverage,
        scoredImpacts: 3,
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "B2")).toBe(true);
  });

  it("allows in_progress -> review when B2 passes", () => {
    const result = validateBiaTransition({
      currentStatus: "in_progress",
      targetStatus: "review",
      snapshot: validSnapshot,
      coverageStats: validCoverage,
    });
    expect(result.allowed).toBe(true);
  });
});
