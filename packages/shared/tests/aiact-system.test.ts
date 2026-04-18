import { describe, it, expect } from "vitest";
import {
  AI_STAGE_ALLOWED_TRANSITIONS,
  hasProhibitedPractice,
  countProhibitedPractices,
  canTransitionToProduction,
  classifyAiSystem,
  validateHighRiskProductionGate,
  type ProhibitedPracticesFlags,
  type ClassificationContext,
  type HighRiskProductionReadiness,
} from "../src/state-machines/aiact-system";

const noFlags: ProhibitedPracticesFlags = {
  subliminalManipulation: false,
  exploitationVulnerable: false,
  socialScoring: false,
  predictivePolicingIndividual: false,
  facialRecognitionScraping: false,
  emotionInferenceWorkplace: false,
  biometricCategorization: false,
  realTimeBiometricPublic: false,
};

const prodReady: HighRiskProductionReadiness = {
  hasQms: true,
  hasRiskManagement: true,
  hasDataGovernance: true,
  hasTechnicalDocumentation: true,
  hasOperationalLogging: true,
  hasHumanOversight: true,
  hasConformityAssessment: true,
  ceMarkingAffixed: true,
};

const baseClassificationCtx: ClassificationContext = {
  annexIIIBiometric: false,
  annexIIICriticalInfra: false,
  annexIIIEducation: false,
  annexIIIEmployment: false,
  annexIIIEssentialServices: false,
  annexIIILawEnforcement: false,
  annexIIIMigrationBorder: false,
  annexIIIJustice: false,
  art6ExceptionApplies: false,
  isGpaiFoundation: false,
  isGpaiSystemicRisk: false,
  hasArt50TransparencyObligation: false,
  prohibitedFlags: noFlags,
};

describe("AI_STAGE_ALLOWED_TRANSITIONS", () => {
  it("research -> prototype", () => {
    expect(AI_STAGE_ALLOWED_TRANSITIONS.research).toContain("prototype");
  });
  it("prototype -> production", () => {
    expect(AI_STAGE_ALLOWED_TRANSITIONS.prototype).toContain("production");
  });
  it("production -> retired only", () => {
    expect(AI_STAGE_ALLOWED_TRANSITIONS.production).toEqual(["retired"]);
  });
  it("retired terminal", () => {
    expect(AI_STAGE_ALLOWED_TRANSITIONS.retired).toEqual([]);
  });
});

describe("hasProhibitedPractice + countProhibitedPractices", () => {
  it("false for noFlags", () => {
    expect(hasProhibitedPractice(noFlags)).toBe(false);
    expect(countProhibitedPractices(noFlags)).toBe(0);
  });
  it("true with any flag", () => {
    expect(hasProhibitedPractice({ ...noFlags, socialScoring: true })).toBe(true);
  });
  it("counts correctly", () => {
    expect(
      countProhibitedPractices({
        ...noFlags,
        socialScoring: true,
        biometricCategorization: true,
      }),
    ).toBe(2);
  });
});

describe("canTransitionToProduction", () => {
  it("allows prototype -> production without prohibited", () => {
    const r = canTransitionToProduction("prototype", noFlags, false, null);
    expect(r.allowed).toBe(true);
  });
  it("blocks research -> production (wrong stage)", () => {
    const r = canTransitionToProduction("research", noFlags, false, null);
    expect(r.allowed).toBe(false);
  });
  it("HARD-STOP bei prohibited ohne exception", () => {
    const r = canTransitionToProduction("prototype", { ...noFlags, socialScoring: true }, false, null);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("HARD-STOP");
  });
  it("allows mit exception + justification >= 100 chars", () => {
    const r = canTransitionToProduction(
      "prototype",
      { ...noFlags, realTimeBiometricPublic: true },
      true,
      "x".repeat(150),
    );
    expect(r.allowed).toBe(true);
  });
  it("blocks bei exception ohne genuegend justification", () => {
    const r = canTransitionToProduction("prototype", { ...noFlags, socialScoring: true }, true, "short");
    expect(r.allowed).toBe(false);
  });
});

describe("classifyAiSystem", () => {
  it("prohibited when any prohibited flag set", () => {
    const ctx = { ...baseClassificationCtx, prohibitedFlags: { ...noFlags, socialScoring: true } };
    const r = classifyAiSystem(ctx);
    expect(r.category).toBe("prohibited");
  });

  it("gpai_sr when foundation + systemic_risk", () => {
    const r = classifyAiSystem({
      ...baseClassificationCtx,
      isGpaiFoundation: true,
      isGpaiSystemicRisk: true,
    });
    expect(r.category).toBe("gpai_sr");
  });

  it("gpai when foundation no systemic", () => {
    const r = classifyAiSystem({ ...baseClassificationCtx, isGpaiFoundation: true });
    expect(r.category).toBe("gpai");
  });

  it("high_risk for Annex-III ohne Art. 6(3)", () => {
    const r = classifyAiSystem({ ...baseClassificationCtx, annexIIIEmployment: true });
    expect(r.category).toBe("high_risk");
  });

  it("limited_risk fuer Annex-III + Art. 6(3) + Art. 50", () => {
    const r = classifyAiSystem({
      ...baseClassificationCtx,
      annexIIIEmployment: true,
      art6ExceptionApplies: true,
      hasArt50TransparencyObligation: true,
    });
    expect(r.category).toBe("limited_risk");
  });

  it("minimal_risk fuer Annex-III + Art. 6(3) ohne Art. 50", () => {
    const r = classifyAiSystem({
      ...baseClassificationCtx,
      annexIIIEmployment: true,
      art6ExceptionApplies: true,
    });
    expect(r.category).toBe("minimal_risk");
  });

  it("limited_risk nur fuer Art. 50 (Chatbot/Deepfake)", () => {
    const r = classifyAiSystem({
      ...baseClassificationCtx,
      hasArt50TransparencyObligation: true,
    });
    expect(r.category).toBe("limited_risk");
  });

  it("minimal_risk sonst", () => {
    const r = classifyAiSystem(baseClassificationCtx);
    expect(r.category).toBe("minimal_risk");
  });
});

describe("validateHighRiskProductionGate", () => {
  it("passes mit allem true", () => {
    const blockers = validateHighRiskProductionGate(prodReady);
    expect(blockers).toHaveLength(0);
  });
  it("blockiert jedes fehlende Element", () => {
    const blockers = validateHighRiskProductionGate({ ...prodReady, hasQms: false });
    expect(blockers.some((b) => b.code === "missing_qms")).toBe(true);
  });
  it("sammelt mehrere Blocker", () => {
    const blockers = validateHighRiskProductionGate({
      ...prodReady,
      hasQms: false,
      hasRiskManagement: false,
      ceMarkingAffixed: false,
    });
    expect(blockers).toHaveLength(3);
  });
});
