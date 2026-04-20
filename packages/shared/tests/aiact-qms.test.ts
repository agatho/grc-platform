import { describe, it, expect } from "vitest";
import {
  countCompletedProcedures,
  computeQmsMaturity,
  assessQmsReadinessForCe,
  assessIso42001Gap,
  assessAiRiskPortfolio,
  type QmsProcedureChecklist,
  type Iso42001Context,
  type AiRisk,
} from "../src/state-machines/aiact-qms";

const allFalseQms: QmsProcedureChecklist = {
  riskManagementProcedure: false,
  dataGovernanceProcedure: false,
  technicalDocumentationProcedure: false,
  recordKeepingProcedure: false,
  transparencyProcedure: false,
  humanOversightProcedure: false,
  accuracyRobustnessProcedure: false,
  cybersecurityProcedure: false,
  incidentReportingProcedure: false,
  thirdPartyManagementProcedure: false,
};

const allTrueQms: QmsProcedureChecklist = Object.fromEntries(
  Object.keys(allFalseQms).map((k) => [k, true]),
) as unknown as QmsProcedureChecklist;

describe("QMS counts + maturity", () => {
  it("0 completed all false", () => {
    expect(countCompletedProcedures(allFalseQms)).toBe(0);
    expect(computeQmsMaturity(allFalseQms)).toBe(0);
  });
  it("10 completed all true", () => {
    expect(countCompletedProcedures(allTrueQms)).toBe(10);
    expect(computeQmsMaturity(allTrueQms)).toBe(100);
  });
  it("partial", () => {
    const partial = {
      ...allFalseQms,
      riskManagementProcedure: true,
      humanOversightProcedure: true,
    };
    expect(computeQmsMaturity(partial)).toBe(20);
  });
});

describe("assessQmsReadinessForCe", () => {
  it("ready when all true", () => {
    const r = assessQmsReadinessForCe(allTrueQms);
    expect(r.readyForCe).toBe(true);
  });
  it("not ready when critical missing (humanOversight)", () => {
    const r = assessQmsReadinessForCe({
      ...allTrueQms,
      humanOversightProcedure: false,
    });
    expect(r.readyForCe).toBe(false);
    expect(r.reasoning).toContain("humanOversight");
  });
  it("not ready at 70% maturity even with all critical", () => {
    const qms: QmsProcedureChecklist = {
      ...allFalseQms,
      riskManagementProcedure: true,
      technicalDocumentationProcedure: true,
      humanOversightProcedure: true,
      cybersecurityProcedure: true,
      // Plus 3 nicht-critical -> total 7/10 = 70%
      dataGovernanceProcedure: true,
      transparencyProcedure: true,
      incidentReportingProcedure: true,
    };
    const r = assessQmsReadinessForCe(qms);
    expect(r.readyForCe).toBe(false);
    expect(r.reasoning).toContain("80");
  });
});

describe("assessIso42001Gap", () => {
  it("17 total controls", () => {
    const ctx: Iso42001Context = {
      qms: allFalseQms,
      hasAiPolicy: false,
      hasManagementObjectives: false,
      hasAiImpactAssessment: false,
      hasResourceAllocation: false,
      hasCompetenceManagement: false,
      hasInternalAudit: false,
      hasManagementReview: false,
    };
    const r = assessIso42001Gap(ctx);
    expect(r.totalControls).toBe(17);
    expect(r.implementedControls).toBe(0);
    expect(r.coveragePercent).toBe(0);
  });

  it("AI-Act QMS deckt ~60 % ab", () => {
    const ctx: Iso42001Context = {
      qms: allTrueQms,
      hasAiPolicy: false,
      hasManagementObjectives: false,
      hasAiImpactAssessment: false,
      hasResourceAllocation: false,
      hasCompetenceManagement: false,
      hasInternalAudit: false,
      hasManagementReview: false,
    };
    const r = assessIso42001Gap(ctx);
    expect(r.coveragePercent).toBeGreaterThan(50);
    expect(r.coveragePercent).toBeLessThan(70);
  });

  it("100% wenn alles", () => {
    const ctx: Iso42001Context = {
      qms: allTrueQms,
      hasAiPolicy: true,
      hasManagementObjectives: true,
      hasAiImpactAssessment: true,
      hasResourceAllocation: true,
      hasCompetenceManagement: true,
      hasInternalAudit: true,
      hasManagementReview: true,
    };
    const r = assessIso42001Gap(ctx);
    expect(r.coveragePercent).toBe(100);
    expect(r.gaps).toHaveLength(0);
  });
});

describe("assessAiRiskPortfolio", () => {
  const baseRisk: AiRisk = {
    title: "Bias gegen Frauen",
    dimension: "discrimination",
    likelihood: 4,
    impact: 5,
    residualLikelihood: 2,
    residualImpact: 3,
    mitigationMeasures: ["Adversarial training", "Post-Hoc-Calibration"],
  };

  it("empty portfolio not ready", () => {
    const r = assessAiRiskPortfolio([]);
    expect(r.readyForDeploy).toBe(false);
    expect(r.totalRisks).toBe(0);
  });

  it("fully mitigated portfolio ready", () => {
    const r = assessAiRiskPortfolio([baseRisk, baseRisk]);
    expect(r.readyForDeploy).toBe(true);
    expect(r.mitigationRate).toBe(1);
  });

  it("high residual blocks deploy", () => {
    const r = assessAiRiskPortfolio([
      { ...baseRisk, residualLikelihood: 5, residualImpact: 5 },
    ]);
    expect(r.hasHighResidual).toBe(true);
    expect(r.readyForDeploy).toBe(false);
  });

  it("flags < 80% mitigation", () => {
    const unmitigated: AiRisk = { ...baseRisk, mitigationMeasures: [] };
    const risks = [baseRisk, baseRisk, unmitigated, unmitigated, unmitigated];
    const r = assessAiRiskPortfolio(risks);
    expect(r.mitigationRate).toBe(0.4);
    expect(r.readyForDeploy).toBe(false);
  });
});
