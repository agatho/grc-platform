import { describe, it, expect } from "vitest";
import {
  selectConformityProcedure,
  evaluateConformityChecklist,
  validateCeMarkingGate,
  assessPostMarketPlan,
  type ConformityRequirement,
  type CeMarkingGateContext,
  type PostMarketPlanQuality,
} from "../src/state-machines/aiact-conformity";

describe("selectConformityProcedure", () => {
  it("biometric => annex_vii always", () => {
    expect(selectConformityProcedure("biometric", true)).toBe("annex_vii");
    expect(selectConformityProcedure("biometric", false)).toBe("annex_vii");
  });
  it("law_enforcement => annex_vii always", () => {
    expect(selectConformityProcedure("law_enforcement", true)).toBe(
      "annex_vii",
    );
  });
  it("employment + harmonised standards => annex_vi", () => {
    expect(selectConformityProcedure("employment", true)).toBe("annex_vi");
  });
  it("employment without harmonised standards => annex_vii", () => {
    expect(selectConformityProcedure("employment", false)).toBe("annex_vii");
  });
});

describe("evaluateConformityChecklist", () => {
  const pass = (id: string): ConformityRequirement => ({
    requirementId: id,
    description: id,
    status: "pass",
    evidence: "doc",
    notes: null,
  });

  it("all pass => overall pass", () => {
    const r = evaluateConformityChecklist([pass("r1"), pass("r2"), pass("r3")]);
    expect(r.overallResult).toBe("pass");
    expect(r.readyForDecision).toBe(true);
    expect(r.coveragePercent).toBe(100);
  });

  it("one fail => overall fail", () => {
    const r = evaluateConformityChecklist([
      pass("r1"),
      { ...pass("r2"), status: "fail" },
      pass("r3"),
    ]);
    expect(r.overallResult).toBe("fail");
    expect(r.failCount).toBe(1);
  });

  it("one partial => overall conditional", () => {
    const r = evaluateConformityChecklist([
      pass("r1"),
      { ...pass("r2"), status: "partial" },
      pass("r3"),
    ]);
    expect(r.overallResult).toBe("conditional");
  });

  it("not_assessed present => pending", () => {
    const r = evaluateConformityChecklist([
      pass("r1"),
      { ...pass("r2"), status: "not_assessed", evidence: null },
    ]);
    expect(r.overallResult).toBe("pending");
    expect(r.readyForDecision).toBe(false);
  });

  it("not_applicable excluded from coverage", () => {
    const r = evaluateConformityChecklist([
      pass("r1"),
      pass("r2"),
      { ...pass("r3"), status: "not_applicable" },
    ]);
    expect(r.naCount).toBe(1);
    expect(r.coveragePercent).toBe(100);
    expect(r.overallResult).toBe("pass");
  });

  it("empty list => 100% coverage, pass", () => {
    const r = evaluateConformityChecklist([]);
    expect(r.coveragePercent).toBe(100);
    expect(r.overallResult).toBe("pass");
  });
});

describe("validateCeMarkingGate", () => {
  const full: CeMarkingGateContext = {
    conformityResult: "pass",
    procedure: "annex_vi",
    hasSignedDeclarationOfConformity: true,
    annexIvSectionsCompleted: 9,
    hasNotifiedBodyCertificate: false,
    registeredInEuDatabase: true,
    hasPostMarketMonitoringPlan: true,
    certificateValidUntil: null,
  };

  it("full pass => can affix", () => {
    const r = validateCeMarkingGate(full);
    expect(r.canAffixCeMarking).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it("fail conformity => cannot affix", () => {
    const r = validateCeMarkingGate({ ...full, conformityResult: "fail" });
    expect(r.canAffixCeMarking).toBe(false);
    expect(r.blockers.some((b) => b.includes("fail"))).toBe(true);
  });

  it("pending conformity => cannot affix", () => {
    const r = validateCeMarkingGate({ ...full, conformityResult: "pending" });
    expect(r.canAffixCeMarking).toBe(false);
  });

  it("conditional => warning but no blocker", () => {
    const r = validateCeMarkingGate({
      ...full,
      conformityResult: "conditional",
    });
    expect(r.canAffixCeMarking).toBe(true);
    expect(r.warnings.some((w) => w.includes("conditional"))).toBe(true);
  });

  it("unsigned DoC blocks", () => {
    const r = validateCeMarkingGate({
      ...full,
      hasSignedDeclarationOfConformity: false,
    });
    expect(r.canAffixCeMarking).toBe(false);
  });

  it("Annex IV incomplete blocks", () => {
    const r = validateCeMarkingGate({ ...full, annexIvSectionsCompleted: 7 });
    expect(r.canAffixCeMarking).toBe(false);
    expect(r.blockers.some((b) => b.includes("7/9"))).toBe(true);
  });

  it("annex_vii without certificate blocks", () => {
    const r = validateCeMarkingGate({
      ...full,
      procedure: "annex_vii",
      hasNotifiedBodyCertificate: false,
    });
    expect(r.canAffixCeMarking).toBe(false);
  });

  it("annex_vii WITH certificate passes", () => {
    const future = new Date();
    future.setDate(future.getDate() + 365);
    const r = validateCeMarkingGate({
      ...full,
      procedure: "annex_vii",
      hasNotifiedBodyCertificate: true,
      certificateValidUntil: future,
    });
    expect(r.canAffixCeMarking).toBe(true);
  });

  it("expired certificate blocks", () => {
    const past = new Date();
    past.setDate(past.getDate() - 30);
    const r = validateCeMarkingGate({
      ...full,
      procedure: "annex_vii",
      hasNotifiedBodyCertificate: true,
      certificateValidUntil: past,
    });
    expect(r.canAffixCeMarking).toBe(false);
    expect(r.blockers.some((b) => b.includes("abgelaufen"))).toBe(true);
  });

  it("certificate expiring soon triggers warning", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const r = validateCeMarkingGate({
      ...full,
      procedure: "annex_vii",
      hasNotifiedBodyCertificate: true,
      certificateValidUntil: soon,
    });
    expect(r.canAffixCeMarking).toBe(true);
    expect(r.warnings.some((w) => w.includes("laeuft in"))).toBe(true);
  });

  it("not registered in EU DB blocks", () => {
    const r = validateCeMarkingGate({ ...full, registeredInEuDatabase: false });
    expect(r.canAffixCeMarking).toBe(false);
  });

  it("no post-market plan blocks", () => {
    const r = validateCeMarkingGate({
      ...full,
      hasPostMarketMonitoringPlan: false,
    });
    expect(r.canAffixCeMarking).toBe(false);
  });
});

describe("assessPostMarketPlan", () => {
  const full: PostMarketPlanQuality = {
    hasDataCollectionProcess: true,
    hasPerformanceMetricsTracking: true,
    hasDriftDetection: true,
    hasIncidentReportingChannel: true,
    hasCorrectiveActionProcess: true,
    hasProviderFeedbackLoop: true,
    reviewFrequencyDays: 90,
  };

  it("fully adequate", () => {
    const r = assessPostMarketPlan(full);
    expect(r.isAdequate).toBe(true);
    expect(r.completenessPercent).toBe(100);
    expect(r.missing).toHaveLength(0);
  });

  it("missing drift detection", () => {
    const r = assessPostMarketPlan({ ...full, hasDriftDetection: false });
    expect(r.isAdequate).toBe(false);
    expect(r.missing).toContain("drift_detection");
  });

  it("review-frequency > 365 days warns and fails adequate", () => {
    const r = assessPostMarketPlan({ ...full, reviewFrequencyDays: 400 });
    expect(r.isAdequate).toBe(false);
    expect(r.warnings.some((w) => w.includes("365d"))).toBe(true);
  });

  it("invalid review frequency", () => {
    const r = assessPostMarketPlan({ ...full, reviewFrequencyDays: 0 });
    expect(r.isAdequate).toBe(false);
    expect(r.warnings.some((w) => w.includes("ungueltig"))).toBe(true);
  });
});
