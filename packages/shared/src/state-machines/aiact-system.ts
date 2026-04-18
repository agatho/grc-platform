// AI-Act System Lifecycle + Classification Helpers (EU AI Act 2024/1689)
//
// Referenz: docs/assessment-plans/04-aiact-assessment-plan.md §3.1
// AI-System hat development_stage (research/prototype/production/retired)
// als Workflow-Signal.

export type AiRiskCategory =
  | "prohibited"
  | "high_risk"
  | "limited_risk"
  | "minimal_risk"
  | "gpai"
  | "gpai_sr";

export type AiDevelopmentStage = "research" | "prototype" | "production" | "retired";

export const AI_STAGE_ALLOWED_TRANSITIONS: Record<AiDevelopmentStage, AiDevelopmentStage[]> = {
  research: ["prototype", "retired"],
  prototype: ["production", "research", "retired"],
  production: ["retired"],
  retired: [],
};

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

// ─── Prohibited-Practices-Screening (Art. 5) ───────────────────

export interface ProhibitedPracticesFlags {
  /** Art. 5(1)(a): Subliminal or manipulative techniques */
  subliminalManipulation: boolean;
  /** Art. 5(1)(b): Exploitation of vulnerabilities */
  exploitationVulnerable: boolean;
  /** Art. 5(1)(c): Social scoring */
  socialScoring: boolean;
  /** Art. 5(1)(d): Predictive policing (individual risk assessment) */
  predictivePolicingIndividual: boolean;
  /** Art. 5(1)(e): Untargeted face-recognition-scraping */
  facialRecognitionScraping: boolean;
  /** Art. 5(1)(f): Emotion-inference in workplace / education */
  emotionInferenceWorkplace: boolean;
  /** Art. 5(1)(g): Biometric categorization based on sensitive attributes */
  biometricCategorization: boolean;
  /** Art. 5(1)(h): Real-time remote biometric ID in public spaces */
  realTimeBiometricPublic: boolean;
}

export function hasProhibitedPractice(flags: ProhibitedPracticesFlags): boolean {
  return Object.values(flags).some((v) => v === true);
}

export function countProhibitedPractices(flags: ProhibitedPracticesFlags): number {
  return Object.values(flags).filter((v) => v === true).length;
}

/**
 * HARD-STOP: AI-System mit prohibited practice darf NICHT in Production
 * gehen, ausser Exception-Applied (Art. 5(2), z. B. Law-Enforcement).
 */
export function canTransitionToProduction(
  stage: AiDevelopmentStage,
  flags: ProhibitedPracticesFlags,
  exceptionApplied: boolean,
  exceptionJustification: string | null,
): { allowed: boolean; reason: string } {
  if (stage !== "prototype") {
    return {
      allowed: false,
      reason: "Transition zu production nur von prototype-Stage aus erlaubt.",
    };
  }

  const hasProhibited = hasProhibitedPractice(flags);

  if (hasProhibited && !exceptionApplied) {
    return {
      allowed: false,
      reason:
        "HARD-STOP: Mindestens 1 prohibited practice (Art. 5) erkannt. Ohne exceptionApplied kann das System nicht in Produktion gehen.",
    };
  }

  if (hasProhibited && exceptionApplied && (!exceptionJustification || exceptionJustification.trim().length < 100)) {
    return {
      allowed: false,
      reason:
        "Exception-Justification muss mindestens 100 Zeichen umfassen (Law-Enforcement-Exception Art. 5(2) erfordert Nachweis).",
    };
  }

  return { allowed: true, reason: "OK" };
}

// ─── Risk-Classification (Annex III + GPAI-Rules) ─────────────

export interface ClassificationContext {
  /** Annex III Use-Cases (8 Kategorien) */
  annexIIIBiometric: boolean;
  annexIIICriticalInfra: boolean;
  annexIIIEducation: boolean;
  annexIIIEmployment: boolean;
  annexIIIEssentialServices: boolean;
  annexIIILawEnforcement: boolean;
  annexIIIMigrationBorder: boolean;
  annexIIIJustice: boolean;
  /** Art. 6(3): Exception -- reine Hilfs-Aufgabe, nicht ergebnisbeeinflussend */
  art6ExceptionApplies: boolean;
  /** GPAI: Foundation-Model */
  isGpaiFoundation: boolean;
  /** GPAI-SR: > 10^25 FLOPs (systemic risk) */
  isGpaiSystemicRisk: boolean;
  /** Art. 50: Limited-Risk Transparenzpflicht (Chatbot, Emotion-Rec, Deepfake) */
  hasArt50TransparencyObligation: boolean;
  /** Prohibited-Practices (Art. 5) */
  prohibitedFlags: ProhibitedPracticesFlags;
}

export function classifyAiSystem(ctx: ClassificationContext): {
  category: AiRiskCategory;
  reasoning: string[];
} {
  const reasoning: string[] = [];

  if (hasProhibitedPractice(ctx.prohibitedFlags)) {
    reasoning.push("Prohibited-Practice (Art. 5) erkannt -- Kategorie 'prohibited'.");
    return { category: "prohibited", reasoning };
  }

  if (ctx.isGpaiSystemicRisk) {
    reasoning.push("GPAI mit systemic risk (>10^25 FLOPs, Art. 51) -- Kategorie 'gpai_sr'.");
    return { category: "gpai_sr", reasoning };
  }

  if (ctx.isGpaiFoundation) {
    reasoning.push("GPAI-Foundation-Model (Art. 51) -- Kategorie 'gpai'.");
    return { category: "gpai", reasoning };
  }

  const anyAnnexIII =
    ctx.annexIIIBiometric ||
    ctx.annexIIICriticalInfra ||
    ctx.annexIIIEducation ||
    ctx.annexIIIEmployment ||
    ctx.annexIIIEssentialServices ||
    ctx.annexIIILawEnforcement ||
    ctx.annexIIIMigrationBorder ||
    ctx.annexIIIJustice;

  if (anyAnnexIII) {
    if (ctx.art6ExceptionApplies) {
      reasoning.push(
        "Annex-III-Use-Case erkannt ABER Art. 6(3)-Ausnahme greift (nur Hilfs-Aufgabe) -- Kategorie 'limited_risk' oder 'minimal_risk'.",
      );
      if (ctx.hasArt50TransparencyObligation) {
        return { category: "limited_risk", reasoning };
      }
      return { category: "minimal_risk", reasoning };
    }
    reasoning.push("Annex-III-Use-Case ohne Art. 6(3)-Ausnahme -- Kategorie 'high_risk'.");
    return { category: "high_risk", reasoning };
  }

  if (ctx.hasArt50TransparencyObligation) {
    reasoning.push("Art. 50 Transparenz-Pflicht (Chatbot/Deepfake/Emotion) -- Kategorie 'limited_risk'.");
    return { category: "limited_risk", reasoning };
  }

  reasoning.push("Keine relevanten Flags -- Kategorie 'minimal_risk'.");
  return { category: "minimal_risk", reasoning };
}

// ─── High-Risk-System Pre-Production-Gate ──────────────────────

export interface HighRiskProductionReadiness {
  hasQms: boolean;
  hasRiskManagement: boolean;
  hasDataGovernance: boolean;
  hasTechnicalDocumentation: boolean;
  hasOperationalLogging: boolean;
  hasHumanOversight: boolean;
  hasConformityAssessment: boolean;
  ceMarkingAffixed: boolean;
}

export function validateHighRiskProductionGate(
  readiness: HighRiskProductionReadiness,
): Blocker[] {
  const blockers: Blocker[] = [];

  const checks: Array<[keyof HighRiskProductionReadiness, string, string]> = [
    ["hasQms", "missing_qms", "QMS (Art. 17) erforderlich fuer High-Risk."],
    ["hasRiskManagement", "missing_risk_mgmt", "Risk-Management (Art. 9) erforderlich."],
    ["hasDataGovernance", "missing_data_gov", "Data-Governance (Art. 10) erforderlich."],
    ["hasTechnicalDocumentation", "missing_tech_doc", "Technical-Documentation (Art. 11 + Annex IV) erforderlich."],
    ["hasOperationalLogging", "missing_op_logging", "Operational-Logging (Art. 12) erforderlich."],
    ["hasHumanOversight", "missing_oversight", "Human-Oversight (Art. 14) erforderlich."],
    ["hasConformityAssessment", "missing_conformity", "Conformity-Assessment (Art. 43) erforderlich."],
    ["ceMarkingAffixed", "missing_ce_marking", "CE-Marking muss affixed sein vor Markteinfuehrung."],
  ];

  for (const [key, code, message] of checks) {
    if (!readiness[key]) {
      blockers.push({ code, message, gate: "AI-Prod", severity: "error" });
    }
  }

  return blockers;
}
