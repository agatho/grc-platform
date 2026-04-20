import { describe, it, expect } from "vitest";
import {
  classifyGpaiSystemicRisk,
  assessGpaiObligations,
  computeAnnualReport,
  type GpaiSystemicRiskContext,
  type GpaiObligationContext,
  type AnnualReportInput,
} from "../src/state-machines/aiact-gpai-report";

describe("classifyGpaiSystemicRisk", () => {
  const baseline: GpaiSystemicRiskContext = {
    trainingComputeFlops: null,
    commissionDesignated: false,
    hasHighImpactCapabilities: false,
    parametersCount: null,
    hasAdvancedReasoning: false,
    hasMultimodalCapabilities: false,
  };

  it("systemic by compute threshold (10^25)", () => {
    const r = classifyGpaiSystemicRisk({
      ...baseline,
      trainingComputeFlops: 2e25,
    });
    expect(r.isSystemic).toBe(true);
    expect(r.tierLevel).toBe("systemic");
    expect(r.triggers.some((t) => t.includes("training_compute"))).toBe(true);
  });

  it("systemic by commission designation", () => {
    const r = classifyGpaiSystemicRisk({
      ...baseline,
      commissionDesignated: true,
    });
    expect(r.isSystemic).toBe(true);
    expect(r.triggers).toContain("commission_designation");
  });

  it("systemic by high-impact capabilities", () => {
    const r = classifyGpaiSystemicRisk({
      ...baseline,
      hasHighImpactCapabilities: true,
    });
    expect(r.isSystemic).toBe(true);
  });

  it("high_capability by near-compute (10^24)", () => {
    const r = classifyGpaiSystemicRisk({
      ...baseline,
      trainingComputeFlops: 5e24,
    });
    expect(r.isSystemic).toBe(false);
    expect(r.tierLevel).toBe("high_capability");
  });

  it("high_capability by reasoning + multimodal", () => {
    const r = classifyGpaiSystemicRisk({
      ...baseline,
      hasAdvancedReasoning: true,
      hasMultimodalCapabilities: true,
    });
    expect(r.tierLevel).toBe("high_capability");
  });

  it("standard for vanilla GPAI", () => {
    const r = classifyGpaiSystemicRisk(baseline);
    expect(r.tierLevel).toBe("standard");
    expect(r.isSystemic).toBe(false);
  });
});

describe("assessGpaiObligations", () => {
  const standardCompliant: GpaiObligationContext = {
    hasTechnicalDocumentation: true,
    hasTrainingDataSummary: true,
    respectsCopyrightDirective: true,
    downstreamProviderInfoShared: true,
    hasEuRepresentative: false,
    isNonEuProvider: false,
    isSystemic: false,
    hasModelEvaluations: false,
    hasAdversarialTesting: false,
    hasSystemicRiskAssessment: false,
    hasIncidentReporting: false,
    hasCybersecurityMeasures: false,
  };

  it("standard-only compliant", () => {
    const r = assessGpaiObligations(standardCompliant);
    expect(r.isFullyCompliant).toBe(true);
    expect(r.standardPercent).toBe(100);
    expect(r.systemicPercent).toBeNull();
  });

  it("non-EU provider needs EU representative", () => {
    const r = assessGpaiObligations({
      ...standardCompliant,
      isNonEuProvider: true,
      hasEuRepresentative: false,
    });
    expect(r.isFullyCompliant).toBe(false);
    expect(r.missing).toContain("eu_representative");
  });

  it("systemic requires Art. 55 compliance", () => {
    const r = assessGpaiObligations({
      ...standardCompliant,
      isSystemic: true,
      hasModelEvaluations: true,
      hasAdversarialTesting: true,
      hasSystemicRiskAssessment: true,
      hasIncidentReporting: true,
      hasCybersecurityMeasures: true,
    });
    expect(r.isFullyCompliant).toBe(true);
    expect(r.systemicPercent).toBe(100);
  });

  it("systemic with partial systemic compliance fails", () => {
    const r = assessGpaiObligations({
      ...standardCompliant,
      isSystemic: true,
      hasModelEvaluations: true,
      hasAdversarialTesting: true,
      hasSystemicRiskAssessment: false,
      hasIncidentReporting: false,
      hasCybersecurityMeasures: false,
    });
    expect(r.isFullyCompliant).toBe(false);
    expect(r.systemicObligationsMet).toBe(2);
    expect(r.missing).toContain("systemic_risk_assessment");
  });

  it("missing training data summary blocks", () => {
    const r = assessGpaiObligations({
      ...standardCompliant,
      hasTrainingDataSummary: false,
    });
    expect(r.isFullyCompliant).toBe(false);
    expect(r.missing).toContain("training_data_summary");
  });
});

describe("computeAnnualReport", () => {
  const healthy: AnnualReportInput = {
    year: 2026,
    systems: {
      total: 10,
      byRisk: { unacceptable: 0, high: 4, limited: 4, minimal: 2 },
      compliant: 9,
      nonCompliant: 0,
      inAssessment: 1,
    },
    conformityAssessments: { completed: 4, passed: 4, failed: 0, pending: 0 },
    incidents: {
      totalReported: 3,
      seriousIncidents: 0,
      overdueNotifications: 0,
      averageTimeToNotifyHours: 24,
    },
    fria: { required: 2, completed: 2, approved: 2 },
    qms: { avgMaturity: 85, readyForCe: 4, notReadyForCe: 0 },
    gpai: { total: 1, systemic: 0 },
    correctiveActions: { open: 2, closed: 8, overdue: 0 },
  };

  it("healthy org passes submission", () => {
    const r = computeAnnualReport(healthy);
    expect(r.readyForSubmission).toBe(true);
    expect(r.overallComplianceScore).toBeGreaterThanOrEqual(80);
    expect(r.criticalFindings).toHaveLength(0);
    expect(r.sections.qms.healthScore).toBe(85);
  });

  it("unacceptable-risk system = critical finding", () => {
    const r = computeAnnualReport({
      ...healthy,
      systems: {
        ...healthy.systems,
        byRisk: { ...healthy.systems.byRisk, unacceptable: 1 },
      },
    });
    expect(r.readyForSubmission).toBe(false);
    expect(r.criticalFindings.some((c) => c.includes("unacceptable"))).toBe(
      true,
    );
  });

  it("overdue notifications = critical finding", () => {
    const r = computeAnnualReport({
      ...healthy,
      incidents: {
        ...healthy.incidents,
        overdueNotifications: 2,
        seriousIncidents: 2,
      },
    });
    expect(r.readyForSubmission).toBe(false);
    expect(r.criticalFindings.some((c) => c.includes("Art. 73"))).toBe(true);
    expect(r.sections.incidents.healthScore).toBe(30);
  });

  it("mandatory FRIAs incomplete = critical", () => {
    const r = computeAnnualReport({
      ...healthy,
      fria: { required: 4, completed: 2, approved: 2 },
    });
    expect(r.sections.fria.healthScore).toBe(50);
    expect(r.criticalFindings.some((c) => c.includes("FRIA"))).toBe(true);
  });

  it("failed conformity = critical", () => {
    const r = computeAnnualReport({
      ...healthy,
      conformityAssessments: { completed: 4, passed: 2, failed: 2, pending: 0 },
    });
    expect(r.criticalFindings.some((c) => c.includes("Conformity"))).toBe(true);
  });

  it("overall score weighted correctly (sum = 1)", () => {
    // Mit all-100 Werten sollte das Ergebnis 100 sein
    const perfect = computeAnnualReport({
      ...healthy,
      systems: { ...healthy.systems, compliant: 10, total: 10 },
      conformityAssessments: { completed: 1, passed: 1, failed: 0, pending: 0 },
      qms: { avgMaturity: 100, readyForCe: 1, notReadyForCe: 0 },
      gpai: { total: 0, systemic: 0 },
    });
    expect(perfect.overallComplianceScore).toBe(100);
  });
});
