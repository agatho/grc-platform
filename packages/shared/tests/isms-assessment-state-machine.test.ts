import { describe, it, expect } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  phaseForStatus,
  validateGate1Setup,
  validateGate2SoaCoverage,
  validateGate3RiskAssessment,
  validateGate4Coverage,
  validateTransition,
  buildSetupChecklist,
  type AssessmentSnapshot,
  type RiskEvalStats,
  type SoaStats,
} from "../src/state-machines/isms-assessment";

const LONG_DESCRIPTION = "x".repeat(250);

const validSnapshot: AssessmentSnapshot = {
  status: "planning",
  completionPercentage: 0,
  name: "Test Assessment",
  description: LONG_DESCRIPTION,
  scopeType: "full",
  scopeFilter: null,
  framework: "iso27001",
  periodStart: "2026-05-01",
  periodEnd: "2026-06-30",
  leadAssessorId: "00000000-0000-0000-0000-000000000001",
  totalEvaluations: 100,
  completedEvaluations: 90,
};

describe("phaseForStatus", () => {
  it("maps planning + low % to setup", () => {
    expect(phaseForStatus("planning", 0)).toBe("setup");
  });
  it("maps planning + mid % to framework_select", () => {
    expect(phaseForStatus("planning", 60)).toBe("framework_select");
  });
  it("maps in_progress + 30% to risk_assessment", () => {
    expect(phaseForStatus("in_progress", 30)).toBe("risk_assessment");
  });
  it("maps in_progress + 70% to control_evaluation", () => {
    expect(phaseForStatus("in_progress", 70)).toBe("control_evaluation");
  });
  it("maps review to reporting", () => {
    expect(phaseForStatus("review", 100)).toBe("reporting");
  });
  it("maps completed to follow_up", () => {
    expect(phaseForStatus("completed", 100)).toBe("follow_up");
  });
});

describe("ALLOWED_TRANSITIONS", () => {
  it("allows planning -> in_progress", () => {
    expect(ALLOWED_TRANSITIONS.planning).toContain("in_progress");
  });
  it("blocks planning -> completed (direct)", () => {
    expect(ALLOWED_TRANSITIONS.planning).not.toContain("completed");
  });
  it("allows review -> in_progress (reopen)", () => {
    expect(ALLOWED_TRANSITIONS.review).toContain("in_progress");
  });
  it("blocks any transition from completed", () => {
    expect(ALLOWED_TRANSITIONS.completed).toHaveLength(0);
  });
  it("blocks any transition from cancelled", () => {
    expect(ALLOWED_TRANSITIONS.cancelled).toHaveLength(0);
  });
});

describe("validateGate1Setup", () => {
  it("passes with valid snapshot", () => {
    const blockers = validateGate1Setup(validSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });

  it("blocks if name missing", () => {
    const blockers = validateGate1Setup({ ...validSnapshot, name: "" });
    expect(blockers.some((b) => b.code === "missing_name")).toBe(true);
  });

  it("blocks if description < 200 chars", () => {
    const blockers = validateGate1Setup({
      ...validSnapshot,
      description: "too short",
    });
    expect(blockers.some((b) => b.code === "scope_description_too_short")).toBe(true);
  });

  it("blocks if no lead-assessor", () => {
    const blockers = validateGate1Setup({ ...validSnapshot, leadAssessorId: null });
    expect(blockers.some((b) => b.code === "missing_lead_assessor")).toBe(true);
  });

  it("blocks if period < 14 days", () => {
    const blockers = validateGate1Setup({
      ...validSnapshot,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-10",
    });
    expect(blockers.some((b) => b.code === "period_too_short")).toBe(true);
  });

  it("blocks if framework missing", () => {
    const blockers = validateGate1Setup({ ...validSnapshot, framework: null });
    expect(blockers.some((b) => b.code === "missing_framework")).toBe(true);
  });
});

describe("validateGate2SoaCoverage", () => {
  const validStats: SoaStats = {
    totalCatalogEntries: 100,
    entriesWithSoa: 95,
    notApplicableWithoutJustification: 0,
  };

  it("passes with full coverage and all justifications", () => {
    const blockers = validateGate2SoaCoverage(validStats);
    expect(blockers).toHaveLength(0);
  });

  it("blocks with no active catalogs", () => {
    const blockers = validateGate2SoaCoverage({
      totalCatalogEntries: 0,
      entriesWithSoa: 0,
      notApplicableWithoutJustification: 0,
    });
    expect(blockers.some((b) => b.code === "no_active_catalogs")).toBe(true);
  });

  it("blocks at 79% coverage", () => {
    const blockers = validateGate2SoaCoverage({
      totalCatalogEntries: 100,
      entriesWithSoa: 79,
      notApplicableWithoutJustification: 0,
    });
    expect(blockers.some((b) => b.code === "soa_coverage_below_threshold")).toBe(true);
  });

  it("passes at 80% coverage", () => {
    const blockers = validateGate2SoaCoverage({
      totalCatalogEntries: 100,
      entriesWithSoa: 80,
      notApplicableWithoutJustification: 0,
    });
    expect(blockers).toHaveLength(0);
  });

  it("blocks if not_applicable entries lack justification", () => {
    const blockers = validateGate2SoaCoverage({
      ...validStats,
      notApplicableWithoutJustification: 3,
    });
    expect(blockers.some((b) => b.code === "not_applicable_without_justification")).toBe(true);
  });

  it("reports both blockers when both conditions fail", () => {
    const blockers = validateGate2SoaCoverage({
      totalCatalogEntries: 100,
      entriesWithSoa: 50,
      notApplicableWithoutJustification: 5,
    });
    expect(blockers).toHaveLength(2);
  });
});

describe("validateGate3RiskAssessment", () => {
  const fullStats: RiskEvalStats = {
    totalRiskEvals: 50,
    decided: 50,
    scored: 50,
  };

  it("passes when all decisions + scores set", () => {
    const blockers = validateGate3RiskAssessment(fullStats);
    expect(blockers).toHaveLength(0);
  });

  it("blocks when no evals exist", () => {
    const blockers = validateGate3RiskAssessment({
      totalRiskEvals: 0,
      decided: 0,
      scored: 0,
    });
    expect(blockers.some((b) => b.code === "no_risk_evals")).toBe(true);
  });

  it("blocks when any scenario still pending", () => {
    const blockers = validateGate3RiskAssessment({
      ...fullStats,
      decided: 45, // 5 pending
    });
    const pending = blockers.find((b) => b.code === "pending_decisions");
    expect(pending).toBeDefined();
    expect(pending?.severity).toBe("error");
    expect(pending?.message).toContain("5 von 50");
  });

  it("warns (non-blocking) about unscored scenarios", () => {
    const blockers = validateGate3RiskAssessment({
      ...fullStats,
      scored: 40, // 10 unscored
    });
    const unscored = blockers.find((b) => b.code === "unscored_scenarios");
    expect(unscored).toBeDefined();
    expect(unscored?.severity).toBe("warning");
  });

  it("error + warning zusammen", () => {
    const blockers = validateGate3RiskAssessment({
      totalRiskEvals: 50,
      decided: 45,
      scored: 40,
    });
    expect(blockers).toHaveLength(2);
    expect(blockers.some((b) => b.severity === "error")).toBe(true);
    expect(blockers.some((b) => b.severity === "warning")).toBe(true);
  });
});

describe("validateGate4Coverage", () => {
  it("passes with 90% coverage", () => {
    const blockers = validateGate4Coverage(validSnapshot);
    expect(blockers).toHaveLength(0);
  });

  it("blocks with 0% coverage", () => {
    const blockers = validateGate4Coverage({
      ...validSnapshot,
      totalEvaluations: 100,
      completedEvaluations: 0,
    });
    expect(blockers.some((b) => b.code === "coverage_below_threshold")).toBe(true);
  });

  it("blocks with no evaluations at all", () => {
    const blockers = validateGate4Coverage({
      ...validSnapshot,
      totalEvaluations: 0,
      completedEvaluations: 0,
    });
    expect(blockers.some((b) => b.code === "no_evaluations")).toBe(true);
  });

  it("blocks at exactly 79%", () => {
    const blockers = validateGate4Coverage({
      ...validSnapshot,
      totalEvaluations: 100,
      completedEvaluations: 79,
    });
    expect(blockers.some((b) => b.code === "coverage_below_threshold")).toBe(true);
  });

  it("passes at exactly 80%", () => {
    const blockers = validateGate4Coverage({
      ...validSnapshot,
      totalEvaluations: 100,
      completedEvaluations: 80,
    });
    expect(blockers).toHaveLength(0);
  });
});

describe("validateTransition", () => {
  it("blocks invalid transitions", () => {
    const result = validateTransition({
      currentStatus: "planning",
      targetStatus: "completed",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers[0].code).toBe("invalid_transition");
  });

  it("runs Gate G1 on planning -> in_progress", () => {
    const result = validateTransition({
      currentStatus: "planning",
      targetStatus: "in_progress",
      snapshot: { ...validSnapshot, description: "short" },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "G1")).toBe(true);
  });

  it("allows planning -> in_progress when G1 passes", () => {
    const result = validateTransition({
      currentStatus: "planning",
      targetStatus: "in_progress",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(true);
    expect(result.updates?.status).toBe("in_progress");
  });

  it("runs Gate G4 on in_progress -> review", () => {
    const result = validateTransition({
      currentStatus: "in_progress",
      targetStatus: "review",
      snapshot: { ...validSnapshot, completedEvaluations: 50 },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "G4")).toBe(true);
  });

  it("allows in_progress -> review when G4 passes", () => {
    const result = validateTransition({
      currentStatus: "in_progress",
      targetStatus: "review",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(true);
  });

  it("allows cancel from any active state", () => {
    for (const fromState of ["planning", "in_progress", "review"] as const) {
      const result = validateTransition({
        currentStatus: fromState,
        targetStatus: "cancelled",
        snapshot: validSnapshot,
      });
      expect(result.allowed).toBe(true);
    }
  });
});

describe("buildSetupChecklist", () => {
  it("reports 100% when all fields ok", () => {
    const checklist = buildSetupChecklist(validSnapshot);
    expect(checklist.progressPercentage).toBe(100);
    expect(checklist.requiredSteps.every((s) => s.done)).toBe(true);
  });

  it("reports partial progress", () => {
    const checklist = buildSetupChecklist({
      ...validSnapshot,
      description: "short",
      leadAssessorId: null,
    });
    expect(checklist.progressPercentage).toBeLessThan(100);
    expect(checklist.requiredSteps.find((s) => s.key === "scope_statement")?.done).toBe(false);
    expect(checklist.requiredSteps.find((s) => s.key === "lead_assessor")?.done).toBe(false);
  });
});
