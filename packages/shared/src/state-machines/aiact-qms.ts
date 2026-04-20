// AI-Act QMS-Maturity + ISO-42001-Gap-Analysis
//
// Referenz: docs/assessment-plans/04-aiact-assessment-plan.md §3.2 + §3.3
// Art. 17 QMS mit 10 Procedures; ISO 42001 AIMS als Overlay.

export interface QmsProcedureChecklist {
  riskManagementProcedure: boolean;
  dataGovernanceProcedure: boolean;
  technicalDocumentationProcedure: boolean;
  recordKeepingProcedure: boolean;
  transparencyProcedure: boolean;
  humanOversightProcedure: boolean;
  accuracyRobustnessProcedure: boolean;
  cybersecurityProcedure: boolean;
  incidentReportingProcedure: boolean;
  thirdPartyManagementProcedure: boolean;
}

/** Zaehlt die erfuellten Procedures. Art. 17 fordert alle 10. */
export function countCompletedProcedures(
  checklist: QmsProcedureChecklist,
): number {
  return Object.values(checklist).filter((v) => v === true).length;
}

/** Berechnet einen 0-100 Maturity-Score. Vollstaendigkeit = 100 %. */
export function computeQmsMaturity(checklist: QmsProcedureChecklist): number {
  return Math.round((countCompletedProcedures(checklist) / 10) * 100);
}

export interface QmsReadinessResult {
  maturityScore: number;
  completed: number;
  missing: Array<keyof QmsProcedureChecklist>;
  readyForCe: boolean;
  reasoning: string;
}

/**
 * Fuer CE-Marking (Art. 43 Conformity-Assessment) muss QMS >= 80 %
 * Maturity erreichen und alle critical-Procedures erfuellt sein.
 */
const CRITICAL_PROCEDURES: Array<keyof QmsProcedureChecklist> = [
  "riskManagementProcedure",
  "technicalDocumentationProcedure",
  "humanOversightProcedure",
  "cybersecurityProcedure",
];

export function assessQmsReadinessForCe(
  checklist: QmsProcedureChecklist,
): QmsReadinessResult {
  const maturityScore = computeQmsMaturity(checklist);
  const completed = countCompletedProcedures(checklist);
  const missing = (
    Object.keys(checklist) as Array<keyof QmsProcedureChecklist>
  ).filter((k) => !checklist[k]);

  const missingCritical = CRITICAL_PROCEDURES.filter((k) => !checklist[k]);

  let readyForCe = true;
  let reasoning =
    "Bereit fuer CE-Marking: alle 4 kritischen Procedures + >= 80 % Maturity.";

  if (missingCritical.length > 0) {
    readyForCe = false;
    reasoning = `Kritische Procedures fehlen: ${missingCritical.join(", ")}.`;
  } else if (maturityScore < 80) {
    readyForCe = false;
    reasoning = `Maturity ${maturityScore} % < 80 % Anforderung fuer CE.`;
  }

  return { maturityScore, completed, missing, readyForCe, reasoning };
}

// ─── ISO-42001 Gap-Analysis (Subset) ──────────────────────────
//
// ISO 42001 umfasst ~30 Controls (inkl. AI-Management-Objective-
// Setting, Policy, Roles, Risk-Management, Operations, Performance-
// Evaluation, Continual-Improvement). Hier: Mapping zu AI-Act-QMS-
// Procedures + zusaetzliche 42001-spezifische Punkte.

export interface Iso42001Context {
  qms: QmsProcedureChecklist;
  /** Zusaetzlich ISO-42001: */
  hasAiPolicy: boolean;
  hasManagementObjectives: boolean;
  hasAiImpactAssessment: boolean; // analog DPIA aber fuer AI
  hasResourceAllocation: boolean;
  hasCompetenceManagement: boolean; // Training
  hasInternalAudit: boolean;
  hasManagementReview: boolean;
}

export interface Iso42001GapResult {
  totalControls: number;
  implementedControls: number;
  coveragePercent: number;
  gaps: string[];
  strongOverlaps: string[]; // Controls die durch AI-Act-QMS bereits erfuellt sind
}

export function assessIso42001Gap(ctx: Iso42001Context): Iso42001GapResult {
  const controls: Array<[string, boolean, string]> = [
    [
      "4.1 AI-Act-RiskManagement = ISO 6.1",
      ctx.qms.riskManagementProcedure,
      "ISO 42001 6.1",
    ],
    [
      "4.2 AI-Act-DataGov = ISO 8.2",
      ctx.qms.dataGovernanceProcedure,
      "ISO 42001 8.2",
    ],
    [
      "4.3 AI-Act-TechDoc = ISO 7.5",
      ctx.qms.technicalDocumentationProcedure,
      "ISO 42001 7.5",
    ],
    [
      "4.4 AI-Act-RecordKeeping = ISO 7.5",
      ctx.qms.recordKeepingProcedure,
      "ISO 42001 7.5",
    ],
    [
      "4.5 AI-Act-Transparency = ISO 4.3",
      ctx.qms.transparencyProcedure,
      "ISO 42001 4.3",
    ],
    [
      "4.6 AI-Act-Oversight = ISO 8.3",
      ctx.qms.humanOversightProcedure,
      "ISO 42001 8.3",
    ],
    [
      "4.7 AI-Act-Accuracy = ISO 9.1",
      ctx.qms.accuracyRobustnessProcedure,
      "ISO 42001 9.1",
    ],
    [
      "4.8 AI-Act-Cybersec = ISO 8.2",
      ctx.qms.cybersecurityProcedure,
      "ISO 42001 8.2",
    ],
    [
      "4.9 AI-Act-Incident = ISO 10.1",
      ctx.qms.incidentReportingProcedure,
      "ISO 42001 10.1",
    ],
    [
      "4.10 AI-Act-3rdParty = ISO 8.5",
      ctx.qms.thirdPartyManagementProcedure,
      "ISO 8.5",
    ],
    ["5.1 ISO AI-Policy", ctx.hasAiPolicy, "ISO 42001 5.2"],
    ["5.2 ISO AI-Objectives", ctx.hasManagementObjectives, "ISO 42001 6.2"],
    [
      "5.3 ISO AI-Impact-Assessment",
      ctx.hasAiImpactAssessment,
      "ISO 42001 6.1.3",
    ],
    ["5.4 ISO Resource-Allocation", ctx.hasResourceAllocation, "ISO 42001 7.1"],
    ["5.5 ISO Competence", ctx.hasCompetenceManagement, "ISO 42001 7.2"],
    ["5.6 ISO Internal-Audit", ctx.hasInternalAudit, "ISO 42001 9.2"],
    ["5.7 ISO Management-Review", ctx.hasManagementReview, "ISO 42001 9.3"],
  ];

  const total = controls.length;
  const implemented = controls.filter(([, v]) => v).length;
  const gaps = controls.filter(([, v]) => !v).map(([label]) => label);
  const strongOverlaps = controls
    .filter(([, v, iso]) => v && iso.startsWith("ISO 42001"))
    .map(([label]) => label);

  return {
    totalControls: total,
    implementedControls: implemented,
    coveragePercent: Math.round((implemented / total) * 100),
    gaps,
    strongOverlaps,
  };
}

// ─── AI-Risk-Register Helpers ──────────────────────────────────

export type AiRiskDimension =
  | "discrimination"
  | "privacy"
  | "physical_safety"
  | "property_damage"
  | "financial_loss"
  | "reputation"
  | "democratic_process"
  | "environmental";

export interface AiRisk {
  title: string;
  dimension: AiRiskDimension;
  likelihood: number; // 1-5
  impact: number; // 1-5
  residualLikelihood: number | null;
  residualImpact: number | null;
  mitigationMeasures: string[];
}

export interface AiRiskAssessmentQuality {
  totalRisks: number;
  mitigatedCount: number;
  mitigationRate: number; // 0-1
  averageResidual: number;
  hasHighResidual: boolean;
  readyForDeploy: boolean;
}

export function assessAiRiskPortfolio(
  risks: AiRisk[],
): AiRiskAssessmentQuality {
  const total = risks.length;
  const mitigated = risks.filter((r) => r.mitigationMeasures.length > 0).length;
  const residuals = risks
    .filter((r) => r.residualLikelihood !== null && r.residualImpact !== null)
    .map((r) => (r.residualLikelihood ?? 0) * (r.residualImpact ?? 0));
  const avgResidual =
    residuals.length > 0
      ? residuals.reduce((a, b) => a + b, 0) / residuals.length
      : 0;
  const hasHighResidual = residuals.some((v) => v >= 16); // 4x4 threshold

  return {
    totalRisks: total,
    mitigatedCount: mitigated,
    mitigationRate: total > 0 ? mitigated / total : 0,
    averageResidual: avgResidual,
    hasHighResidual,
    readyForDeploy: !hasHighResidual && total > 0 && mitigated / total >= 0.8,
  };
}
