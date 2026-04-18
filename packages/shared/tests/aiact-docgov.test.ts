import { describe, it, expect } from "vitest";
import {
  assessDataGovernance,
  assessAnnexIvCompleteness,
  validateDeclarationOfConformity,
  assessSubstantialChange,
  type DataGovernanceQuality,
  type AnnexIvSections,
  type DeclarationOfConformityInput,
  type ChangeSignal,
} from "../src/state-machines/aiact-docgov";

const longText = "x".repeat(250);

describe("assessDataGovernance", () => {
  const full: DataGovernanceQuality = {
    hasTrainingDataDescription: true,
    hasDataCollectionProcess: true,
    hasLabelingProcess: true,
    hasDataCleaningSteps: true,
    datasetSize: 100_000,
    hasDemographicCoverage: true,
    hasBiasTestingDone: true,
    biasTestResults: [
      { cohort: "gender", metric: "parity", score: 0.92 },
      { cohort: "age", metric: "parity", score: 0.89 },
      { cohort: "ethnicity", metric: "parity", score: 0.85 },
    ],
    hasDataProvenance: true,
    hasLegalBasisForTraining: true,
  };

  it("100% complete + ready for high-risk", () => {
    const r = assessDataGovernance(full);
    expect(r.completenessPercent).toBe(100);
    expect(r.hasCriticalGaps).toBe(false);
    expect(r.readyForHighRisk).toBe(true);
    expect(r.biasTestingCoverage).toBe(3);
    expect(r.missing).toHaveLength(0);
  });

  it("missing bias testing => critical gap + not ready", () => {
    const r = assessDataGovernance({ ...full, hasBiasTestingDone: false, biasTestResults: null });
    expect(r.hasCriticalGaps).toBe(true);
    expect(r.readyForHighRisk).toBe(false);
    expect(r.missing).toContain("bias_testing");
  });

  it("missing legal basis => critical gap", () => {
    const r = assessDataGovernance({ ...full, hasLegalBasisForTraining: false });
    expect(r.hasCriticalGaps).toBe(true);
    expect(r.readyForHighRisk).toBe(false);
  });

  it("missing provenance => critical gap", () => {
    const r = assessDataGovernance({ ...full, hasDataProvenance: false });
    expect(r.hasCriticalGaps).toBe(true);
    expect(r.readyForHighRisk).toBe(false);
  });

  it("dataset size null counts as missing but not critical", () => {
    const r = assessDataGovernance({ ...full, datasetSize: null });
    expect(r.missing).toContain("dataset_size");
    // dataset_size ist kein critical-flag; readyForHighRisk bleibt true da 89% >= 80%.
    expect(r.hasCriticalGaps).toBe(false);
  });

  it("less than 3 cohorts => not ready for high-risk", () => {
    const r = assessDataGovernance({
      ...full,
      biasTestResults: [{ cohort: "gender", metric: "parity", score: 0.9 }],
    });
    expect(r.biasTestingCoverage).toBe(1);
    expect(r.readyForHighRisk).toBe(false);
  });
});

describe("assessAnnexIvCompleteness", () => {
  const full: AnnexIvSections = {
    section1_GeneralDescription: longText,
    section2_DetailedElements: longText,
    section3_Monitoring: longText,
    section4_PerformanceMetrics: longText,
    section5_RiskManagement: longText,
    section6_LifecycleChanges: longText,
    section7_HarmonisedStandards: longText,
    section8_DeclarationOfConformity: longText,
    section9_PostMarketMonitoring: longText,
  };

  it("all 9 sections complete => ready for submission", () => {
    const r = assessAnnexIvCompleteness(full);
    expect(r.sectionsCompleted).toBe(9);
    expect(r.totalSections).toBe(9);
    expect(r.coveragePercent).toBe(100);
    expect(r.readyForSubmission).toBe(true);
    expect(r.missingSections).toHaveLength(0);
    expect(r.averageSectionLengthChars).toBe(250);
  });

  it("section too short counts as missing", () => {
    const r = assessAnnexIvCompleteness({
      ...full,
      section3_Monitoring: "too short",
    });
    expect(r.sectionsCompleted).toBe(8);
    expect(r.missingSections).toContain("section3_Monitoring");
    expect(r.readyForSubmission).toBe(false);
  });

  it("null section counts as missing", () => {
    const r = assessAnnexIvCompleteness({ ...full, section5_RiskManagement: null });
    expect(r.missingSections).toContain("section5_RiskManagement");
    expect(r.coveragePercent).toBe(89);
  });

  it("empty whitespace doesn't count", () => {
    const r = assessAnnexIvCompleteness({ ...full, section1_GeneralDescription: "   " });
    expect(r.missingSections).toContain("section1_GeneralDescription");
  });
});

describe("validateDeclarationOfConformity", () => {
  const fullInput: DeclarationOfConformityInput = {
    providerName: "Acme AI GmbH",
    providerAddress: "Musterstr. 1, 10115 Berlin",
    aiSystemName: "Acme HR-Scoring",
    aiSystemVersion: "1.0.0",
    intendedPurpose: "Unterstuetzung im Recruiting",
    harmonisedStandards: ["ISO/IEC 42001:2023", "ISO/IEC 23894:2023"],
    conformityAssessmentProcedure: "annex_vi",
    notifiedBodyId: null,
    notifiedBodyName: null,
    signatoryName: "Max Mustermann",
    signatoryTitle: "CEO",
    dateOfDeclaration: "2026-04-18",
    placeOfIssue: "Berlin",
  };

  it("valid full input", () => {
    const r = validateDeclarationOfConformity(fullInput);
    expect(r.valid).toBe(true);
    expect(r.missing).toHaveLength(0);
  });

  it("missing providerName", () => {
    const { providerName: _unused, ...rest } = fullInput;
    void _unused;
    const r = validateDeclarationOfConformity(rest);
    expect(r.valid).toBe(false);
    expect(r.missing).toContain("providerName");
  });

  it("empty harmonisedStandards", () => {
    const r = validateDeclarationOfConformity({ ...fullInput, harmonisedStandards: [] });
    expect(r.valid).toBe(false);
    expect(r.missing).toContain("harmonisedStandards");
  });

  it("whitespace-only string counts as missing", () => {
    const r = validateDeclarationOfConformity({ ...fullInput, signatoryName: "   " });
    expect(r.valid).toBe(false);
    expect(r.missing).toContain("signatoryName");
  });

  it("annex_vii without notified body fails", () => {
    const r = validateDeclarationOfConformity({
      ...fullInput,
      conformityAssessmentProcedure: "annex_vii",
      notifiedBodyId: null,
    });
    expect(r.valid).toBe(false);
    expect(r.missing.some((m) => m.startsWith("notifiedBodyId"))).toBe(true);
  });

  it("annex_vii WITH notified body passes", () => {
    const r = validateDeclarationOfConformity({
      ...fullInput,
      conformityAssessmentProcedure: "annex_vii",
      notifiedBodyId: "NB-1234",
      notifiedBodyName: "TUV SUD",
    });
    expect(r.valid).toBe(true);
  });
});

describe("assessSubstantialChange", () => {
  const noChange: ChangeSignal = {
    trainingDataChange: false,
    architectureChange: false,
    purposeChange: false,
    performanceDrift: false,
    newDataCategories: false,
    contextChange: false,
  };

  it("no changes => not substantial", () => {
    const r = assessSubstantialChange(noChange);
    expect(r.isSubstantial).toBe(false);
    expect(r.requiresReassessment).toBe(false);
    expect(r.changeCount).toBe(0);
  });

  it("only purposeChange => always substantial", () => {
    const r = assessSubstantialChange({ ...noChange, purposeChange: true });
    expect(r.isSubstantial).toBe(true);
    expect(r.requiresReassessment).toBe(true);
    expect(r.reason).toContain("purposeChange");
  });

  it("only architectureChange => substantial", () => {
    const r = assessSubstantialChange({ ...noChange, architectureChange: true });
    expect(r.isSubstantial).toBe(true);
  });

  it("2 minor changes => substantial", () => {
    const r = assessSubstantialChange({
      ...noChange,
      performanceDrift: true,
      newDataCategories: true,
    });
    expect(r.isSubstantial).toBe(true);
    expect(r.changeCount).toBe(2);
  });

  it("1 minor change => NOT substantial", () => {
    const r = assessSubstantialChange({ ...noChange, performanceDrift: true });
    expect(r.isSubstantial).toBe(false);
    expect(r.requiresReassessment).toBe(false);
    expect(r.reason).toContain("Monitoring");
  });

  it("all signals triggered includes all signals in list", () => {
    const r = assessSubstantialChange({
      trainingDataChange: true,
      architectureChange: true,
      purposeChange: true,
      performanceDrift: true,
      newDataCategories: true,
      contextChange: true,
    });
    expect(r.triggeredSignals).toHaveLength(6);
    expect(r.isSubstantial).toBe(true);
  });
});
