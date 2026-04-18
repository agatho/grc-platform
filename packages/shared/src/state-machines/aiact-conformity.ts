// AI-Act Conformity-Assessment + CE-Marking (Art. 43, 47, 48)
//
// Referenz: docs/assessment-plans/04-aiact-assessment-plan.md §5.1-5.2.
//
// Art. 43 Conformity-Assessment-Procedures:
// - Annex VI: internal-control (self-assessment) -- default fuer viele High-Risk
// - Annex VII: third-party-conformity mit notified body -- Pflicht fuer einzelne
//   Annex-III-Kategorien (Biometrics etc.)

export type ConformityProcedure = "annex_vi" | "annex_vii";

export type AnnexIIICategory =
  | "biometric"
  | "critical_infra"
  | "education"
  | "employment"
  | "essential_services"
  | "law_enforcement"
  | "migration_border"
  | "justice";

/**
 * Entscheidet welches Conformity-Procedure anzuwenden ist.
 * Biometric + Law-Enforcement erfordern in der Regel Annex VII (notified body).
 * Andere Annex-III-Kategorien koennen Annex VI verwenden.
 */
export function selectConformityProcedure(
  category: AnnexIIICategory,
  hasHarmonisedStandardCompliance: boolean,
): ConformityProcedure {
  // Biometrics Stand-alone-Systems -> Annex VII Pflicht
  if (category === "biometric") return "annex_vii";

  // Law-Enforcement mit Individual-Risk -> Annex VII
  if (category === "law_enforcement") return "annex_vii";

  // Alle anderen: wenn harmonised standards voll umgesetzt -> Annex VI reicht.
  return hasHarmonisedStandardCompliance ? "annex_vi" : "annex_vii";
}

// ─── Conformity-Requirement-Checklist ─────────────────────────

export interface ConformityRequirement {
  requirementId: string;
  description: string;
  status: "not_assessed" | "pass" | "fail" | "partial" | "not_applicable";
  evidence: string | null;
  notes: string | null;
}

export interface ConformityChecklistResult {
  totalRequirements: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  naCount: number;
  notAssessedCount: number;
  coveragePercent: number;
  readyForDecision: boolean;
  overallResult: "pass" | "fail" | "conditional" | "pending";
}

export function evaluateConformityChecklist(
  requirements: ConformityRequirement[],
): ConformityChecklistResult {
  const total = requirements.length;
  const pass = requirements.filter((r) => r.status === "pass").length;
  const fail = requirements.filter((r) => r.status === "fail").length;
  const partial = requirements.filter((r) => r.status === "partial").length;
  const na = requirements.filter((r) => r.status === "not_applicable").length;
  const notAssessed = requirements.filter((r) => r.status === "not_assessed").length;

  const applicable = total - na;
  const coveragePercent =
    applicable > 0 ? Math.round(((pass + fail + partial) / applicable) * 100) : 100;

  const readyForDecision = notAssessed === 0;

  let overallResult: ConformityChecklistResult["overallResult"] = "pending";
  if (!readyForDecision) {
    overallResult = "pending";
  } else if (fail > 0) {
    overallResult = "fail";
  } else if (partial > 0) {
    overallResult = "conditional";
  } else {
    overallResult = "pass";
  }

  return {
    totalRequirements: total,
    passCount: pass,
    failCount: fail,
    partialCount: partial,
    naCount: na,
    notAssessedCount: notAssessed,
    coveragePercent,
    readyForDecision,
    overallResult,
  };
}

// ─── CE-Marking-Gate ──────────────────────────────────────────
//
// CE-Marking darf nur affixed werden wenn:
// 1. Conformity-Assessment abgeschlossen (overallResult = pass oder conditional-with-plan)
// 2. Declaration-of-Conformity unterzeichnet
// 3. Technical-Documentation komplett (Annex IV >= 9/9)
// 4. Bei Annex VII: notified-body-Certificate vorhanden
// 5. System in EU-Database registriert
// 6. Post-Market-Monitoring-Plan existiert

export interface CeMarkingGateContext {
  conformityResult: "pass" | "fail" | "conditional" | "pending";
  procedure: ConformityProcedure;
  hasSignedDeclarationOfConformity: boolean;
  annexIvSectionsCompleted: number;
  hasNotifiedBodyCertificate: boolean;
  registeredInEuDatabase: boolean;
  hasPostMarketMonitoringPlan: boolean;
  certificateValidUntil: Date | null;
}

export interface CeMarkingGateResult {
  canAffixCeMarking: boolean;
  blockers: string[];
  warnings: string[];
  certificateExpiresInDays: number | null;
}

export function validateCeMarkingGate(ctx: CeMarkingGateContext): CeMarkingGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (ctx.conformityResult === "fail") {
    blockers.push("Conformity-Assessment result = fail -- CE-Marking unzulaessig.");
  }
  if (ctx.conformityResult === "pending") {
    blockers.push("Conformity-Assessment noch nicht abgeschlossen.");
  }
  if (ctx.conformityResult === "conditional") {
    warnings.push(
      "Conformity-Assessment = conditional -- CE-Marking nur mit abgeschlossenem Action-Plan.",
    );
  }
  if (!ctx.hasSignedDeclarationOfConformity) {
    blockers.push("Declaration-of-Conformity nicht unterzeichnet (Art. 47).");
  }
  if (ctx.annexIvSectionsCompleted < 9) {
    blockers.push(
      `Annex IV nur ${ctx.annexIvSectionsCompleted}/9 Sections komplett (Art. 11).`,
    );
  }
  if (ctx.procedure === "annex_vii" && !ctx.hasNotifiedBodyCertificate) {
    blockers.push("Annex VII Procedure erfordert notified-body certificate.");
  }
  if (!ctx.registeredInEuDatabase) {
    blockers.push("System nicht in EU-Database registriert (Art. 49).");
  }
  if (!ctx.hasPostMarketMonitoringPlan) {
    blockers.push("Post-Market-Monitoring-Plan fehlt (Art. 72).");
  }

  let certificateExpiresInDays: number | null = null;
  if (ctx.certificateValidUntil) {
    certificateExpiresInDays = Math.floor(
      (ctx.certificateValidUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (certificateExpiresInDays < 0) {
      blockers.push("Notified-body certificate abgelaufen.");
    } else if (certificateExpiresInDays < 90) {
      warnings.push(
        `Notified-body certificate laeuft in ${certificateExpiresInDays} Tagen ab -- Re-Assessment einleiten.`,
      );
    }
  }

  return {
    canAffixCeMarking: blockers.length === 0 && ctx.conformityResult !== "fail",
    blockers,
    warnings,
    certificateExpiresInDays,
  };
}

// ─── Post-Market-Monitoring-Plan-Quality ──────────────────────

export interface PostMarketPlanQuality {
  hasDataCollectionProcess: boolean;
  hasPerformanceMetricsTracking: boolean;
  hasDriftDetection: boolean;
  hasIncidentReportingChannel: boolean;
  hasCorrectiveActionProcess: boolean;
  hasProviderFeedbackLoop: boolean;
  reviewFrequencyDays: number;
}

export interface PostMarketPlanResult {
  completenessPercent: number;
  isAdequate: boolean;
  missing: string[];
  warnings: string[];
}

export function assessPostMarketPlan(plan: PostMarketPlanQuality): PostMarketPlanResult {
  const checks: Array<[boolean, string]> = [
    [plan.hasDataCollectionProcess, "data_collection_process"],
    [plan.hasPerformanceMetricsTracking, "performance_metrics_tracking"],
    [plan.hasDriftDetection, "drift_detection"],
    [plan.hasIncidentReportingChannel, "incident_reporting_channel"],
    [plan.hasCorrectiveActionProcess, "corrective_action_process"],
    [plan.hasProviderFeedbackLoop, "provider_feedback_loop"],
  ];
  const passed = checks.filter(([v]) => v).length;
  const missing = checks.filter(([v]) => !v).map(([, k]) => k);
  const completenessPercent = Math.round((passed / checks.length) * 100);

  const warnings: string[] = [];
  if (plan.reviewFrequencyDays > 365) {
    warnings.push("Review-Frequenz > 365d: jaehrliche Reviews sind Minimum.");
  }
  if (plan.reviewFrequencyDays < 1) {
    warnings.push("Review-Frequenz ungueltig (<1d).");
  }

  // Adequate = alle 6 Prozesse vorhanden + Review <= 365d
  const isAdequate = passed === checks.length && plan.reviewFrequencyDays <= 365 && plan.reviewFrequencyDays >= 1;

  return { completenessPercent, isAdequate, missing, warnings };
}
