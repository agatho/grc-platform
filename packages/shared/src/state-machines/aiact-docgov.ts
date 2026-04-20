// AI-Act Data-Governance + Technical-Documentation Helpers (Art. 10 + Art. 11/Annex IV)

// ─── Art. 10 Data-Governance ──────────────────────────────────

export interface DataGovernanceQuality {
  hasTrainingDataDescription: boolean;
  hasDataCollectionProcess: boolean;
  hasLabelingProcess: boolean;
  hasDataCleaningSteps: boolean;
  datasetSize: number | null;
  hasDemographicCoverage: boolean;
  hasBiasTestingDone: boolean;
  biasTestResults: { cohort: string; metric: string; score: number }[] | null;
  hasDataProvenance: boolean;
  hasLegalBasisForTraining: boolean;
}

export interface DataGovernanceResult {
  completenessPercent: number;
  biasTestingCoverage: number; // wie viele Cohorts
  missing: string[];
  hasCriticalGaps: boolean;
  readyForHighRisk: boolean;
}

export function assessDataGovernance(
  ctx: DataGovernanceQuality,
): DataGovernanceResult {
  const checks: Array<[boolean, string]> = [
    [ctx.hasTrainingDataDescription, "training_data_description"],
    [ctx.hasDataCollectionProcess, "data_collection_process"],
    [ctx.hasLabelingProcess, "labeling_process"],
    [ctx.hasDataCleaningSteps, "data_cleaning_steps"],
    [ctx.datasetSize !== null && ctx.datasetSize > 0, "dataset_size"],
    [ctx.hasDemographicCoverage, "demographic_coverage"],
    [ctx.hasBiasTestingDone, "bias_testing"],
    [ctx.hasDataProvenance, "data_provenance"],
    [ctx.hasLegalBasisForTraining, "legal_basis_training"],
  ];

  const passed = checks.filter(([v]) => v).length;
  const missing = checks.filter(([v]) => !v).map(([, k]) => k);
  const completenessPercent = Math.round((passed / checks.length) * 100);

  // Critical gaps: ohne diese kein AI-Act-kompliantes Training
  const criticalMissing = [
    !ctx.hasBiasTestingDone,
    !ctx.hasLegalBasisForTraining,
    !ctx.hasDataProvenance,
  ].filter((v) => v).length;

  const biasTestingCoverage = ctx.biasTestResults?.length ?? 0;

  return {
    completenessPercent,
    biasTestingCoverage,
    missing,
    hasCriticalGaps: criticalMissing > 0,
    readyForHighRisk:
      completenessPercent >= 80 &&
      criticalMissing === 0 &&
      biasTestingCoverage >= 3,
  };
}

// ─── Art. 11 + Annex IV Technical-Documentation (9 Sections) ──

export interface AnnexIvSections {
  /** Annex IV Section 1: general description */
  section1_GeneralDescription: string | null;
  /** Section 2: detailed elements + development process */
  section2_DetailedElements: string | null;
  /** Section 3: monitoring + functioning + control */
  section3_Monitoring: string | null;
  /** Section 4: performance metrics + appropriateness */
  section4_PerformanceMetrics: string | null;
  /** Section 5: risk management system */
  section5_RiskManagement: string | null;
  /** Section 6: changes during lifecycle */
  section6_LifecycleChanges: string | null;
  /** Section 7: harmonised standards applied */
  section7_HarmonisedStandards: string | null;
  /** Section 8: EU declaration of conformity (copy) */
  section8_DeclarationOfConformity: string | null;
  /** Section 9: post-market monitoring plan */
  section9_PostMarketMonitoring: string | null;
}

export interface AnnexIvResult {
  sectionsCompleted: number;
  totalSections: number;
  missingSections: string[];
  coveragePercent: number;
  readyForSubmission: boolean;
  averageSectionLengthChars: number;
}

const MIN_SECTION_CHARS = 200;

export function assessAnnexIvCompleteness(
  sections: AnnexIvSections,
): AnnexIvResult {
  const entries: Array<[string, string | null]> = [
    ["section1_GeneralDescription", sections.section1_GeneralDescription],
    ["section2_DetailedElements", sections.section2_DetailedElements],
    ["section3_Monitoring", sections.section3_Monitoring],
    ["section4_PerformanceMetrics", sections.section4_PerformanceMetrics],
    ["section5_RiskManagement", sections.section5_RiskManagement],
    ["section6_LifecycleChanges", sections.section6_LifecycleChanges],
    ["section7_HarmonisedStandards", sections.section7_HarmonisedStandards],
    [
      "section8_DeclarationOfConformity",
      sections.section8_DeclarationOfConformity,
    ],
    ["section9_PostMarketMonitoring", sections.section9_PostMarketMonitoring],
  ];

  const completed = entries.filter(
    ([, text]) => text && text.trim().length >= MIN_SECTION_CHARS,
  );
  const missing = entries
    .filter(([, text]) => !text || text.trim().length < MIN_SECTION_CHARS)
    .map(([key]) => key);

  const allLengths = entries.map(([, text]) => (text ? text.trim().length : 0));
  const avgLength = allLengths.reduce((a, b) => a + b, 0) / allLengths.length;

  return {
    sectionsCompleted: completed.length,
    totalSections: entries.length,
    missingSections: missing,
    coveragePercent: Math.round((completed.length / entries.length) * 100),
    readyForSubmission: completed.length === entries.length,
    averageSectionLengthChars: Math.round(avgLength),
  };
}

// ─── EU-Declaration-of-Conformity Generator ────────────────────

export interface DeclarationOfConformityInput {
  providerName: string;
  providerAddress: string;
  aiSystemName: string;
  aiSystemVersion: string;
  intendedPurpose: string;
  harmonisedStandards: string[];
  conformityAssessmentProcedure: "annex_vi" | "annex_vii";
  notifiedBodyId: string | null;
  notifiedBodyName: string | null;
  signatoryName: string;
  signatoryTitle: string;
  dateOfDeclaration: string; // ISO
  placeOfIssue: string;
}

export interface DeclarationValidation {
  valid: boolean;
  missing: string[];
}

export function validateDeclarationOfConformity(
  input: Partial<DeclarationOfConformityInput>,
): DeclarationValidation {
  const required: Array<keyof DeclarationOfConformityInput> = [
    "providerName",
    "providerAddress",
    "aiSystemName",
    "aiSystemVersion",
    "intendedPurpose",
    "harmonisedStandards",
    "conformityAssessmentProcedure",
    "signatoryName",
    "signatoryTitle",
    "dateOfDeclaration",
    "placeOfIssue",
  ];

  const missing: string[] = [];
  for (const key of required) {
    const v = input[key];
    if (v === undefined || v === null) {
      missing.push(key);
    } else if (typeof v === "string" && v.trim().length === 0) {
      missing.push(key);
    } else if (Array.isArray(v) && v.length === 0) {
      missing.push(key);
    }
  }

  // Bei annex_vii-Procedure ist notified_body pflicht
  if (
    input.conformityAssessmentProcedure === "annex_vii" &&
    !input.notifiedBodyId
  ) {
    missing.push("notifiedBodyId (Annex VII erfordert notified body)");
  }

  return { valid: missing.length === 0, missing };
}

// ─── Substantial-Change-Detection ─────────────────────────────

export interface ChangeSignal {
  /** Aenderung an Training-Data-Set */
  trainingDataChange: boolean;
  /** Modell-Architektur / Algorithmus geaendert */
  architectureChange: boolean;
  /** Intended-Purpose geaendert */
  purposeChange: boolean;
  /** Performance-Metrics-Drift ueber Schwellwert */
  performanceDrift: boolean;
  /** Neue Datenkategorien verarbeitet */
  newDataCategories: boolean;
  /** Deployment-Context geaendert (z. B. neuer Markt) */
  contextChange: boolean;
}

export interface SubstantialChangeAssessment {
  changeCount: number;
  isSubstantial: boolean;
  triggeredSignals: string[];
  requiresReassessment: boolean;
  reason: string;
}

export function assessSubstantialChange(
  signals: ChangeSignal,
): SubstantialChangeAssessment {
  const entries = Object.entries(signals);
  const triggered = entries.filter(([, v]) => v).map(([k]) => k);

  // 1 critical signal (purposeChange, architectureChange) ODER 2+ minor = substantial
  const criticalSignals = signals.purposeChange || signals.architectureChange;
  const isSubstantial = criticalSignals || triggered.length >= 2;

  let reason: string;
  if (signals.purposeChange) {
    reason = "purposeChange ist immer substantial -- Re-Assessment pflicht.";
  } else if (signals.architectureChange) {
    reason = "architectureChange ist immer substantial.";
  } else if (triggered.length >= 2) {
    reason = `${triggered.length} Aenderungen kombiniert = substantial.`;
  } else if (triggered.length === 1) {
    reason = "Nur 1 Aenderung und nicht critical -- Monitoring reicht.";
  } else {
    reason = "Keine Aenderungen.";
  }

  return {
    changeCount: triggered.length,
    isSubstantial,
    triggeredSignals: triggered,
    requiresReassessment: isSubstantial,
    reason,
  };
}
