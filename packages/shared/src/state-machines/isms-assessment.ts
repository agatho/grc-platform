// ISMS Assessment State-Machine
//
// Referenz: docs/assessment-plans/01-isms-assessment-plan.md Section 8
// Workflow-Gates G1-G8.
//
// Die DB-Enum (`assessment_status`) hat 5 Werte: planning | in_progress |
// review | completed | cancelled. Die Assessment-Plan-Spec faechert das
// in 8 logische Phasen auf (Setup, Framework-Select, Risk-Assessment,
// Control-Eval, Gap-Analysis, Treatment, Reporting, Follow-up), die
// INNERHALB der 5 Enum-Werte ueber `completionPercentage` +
// Gate-Validators abgebildet werden.
//
// Dieser State-Machine:
//   - Enumeriert erlaubte Transitionen
//   - Prueft Gate-Conditions vor Transitions
//   - Gibt strukturierte Blocker zurueck (fuer UI-Feedback)

import type { AssessmentStatus } from "../types/isms";
export type { AssessmentStatus };

export type AssessmentPhase =
  | "setup"
  | "framework_select"
  | "risk_assessment"
  | "control_evaluation"
  | "gap_analysis"
  | "treatment"
  | "reporting"
  | "follow_up";

// Phase-zu-Status-Mapping: welche Phase aktiv ist bei welchem Enum-Status
export function phaseForStatus(status: AssessmentStatus, completionPercentage: number): AssessmentPhase {
  if (status === "cancelled") return "setup";
  if (status === "completed") return "follow_up";
  if (status === "review") return "reporting";

  // Innerhalb "planning" + "in_progress" nach Completion-% aufteilen:
  if (status === "planning") {
    return completionPercentage < 50 ? "setup" : "framework_select";
  }
  // status === "in_progress"
  if (completionPercentage < 20) return "framework_select";
  if (completionPercentage < 50) return "risk_assessment";
  if (completionPercentage < 80) return "control_evaluation";
  if (completionPercentage < 95) return "gap_analysis";
  return "treatment";
}

// Erlaubte Status-Transitionen. Jede Transition braucht eine Gate-
// Validation (siehe validateTransition). Zusaetzlich kann in denselben
// Status "in_progress" zurueckgekehrt werden (Status-idempotent).
export const ALLOWED_TRANSITIONS: Record<AssessmentStatus, AssessmentStatus[]> = {
  planning: ["in_progress", "cancelled"],
  in_progress: ["review", "cancelled"],
  review: ["in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export interface AssessmentSnapshot {
  status: AssessmentStatus;
  completionPercentage: number;
  name: string | null;
  description: string | null;
  scopeType: string | null;
  scopeFilter: Record<string, unknown> | null;
  framework: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  leadAssessorId: string | null;
  totalEvaluations: number;
  completedEvaluations: number;
}

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

// ─── Gate Validators ───────────────────────────────────────────

/** G1: Setup → Framework-Select (planning → in_progress Teil-1) */
export function validateGate1Setup(run: AssessmentSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!run.name || run.name.trim().length === 0) {
    blockers.push({
      code: "missing_name",
      message: "Assessment-Run braucht einen Namen.",
      gate: "G1",
      severity: "error",
    });
  }

  if (!run.description || run.description.trim().length < 200) {
    blockers.push({
      code: "scope_description_too_short",
      message: "Scope-Statement (description) muss mindestens 200 Zeichen haben.",
      gate: "G1",
      severity: "error",
    });
  }

  if (!run.leadAssessorId) {
    blockers.push({
      code: "missing_lead_assessor",
      message: "Lead-Assessor muss zugewiesen sein.",
      gate: "G1",
      severity: "error",
    });
  }

  if (!run.periodStart || !run.periodEnd) {
    blockers.push({
      code: "missing_period",
      message: "periodStart und periodEnd muessen gesetzt sein.",
      gate: "G1",
      severity: "error",
    });
  } else {
    // Mindestens 14 Tage Fenster
    const start = new Date(run.periodStart);
    const end = new Date(run.periodEnd);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 14) {
      blockers.push({
        code: "period_too_short",
        message: "Assessment-Periode muss mindestens 14 Tage umfassen.",
        gate: "G1",
        severity: "error",
      });
    }
  }

  if (!run.framework) {
    blockers.push({
      code: "missing_framework",
      message: "Mindestens ein Framework muss gewaehlt sein.",
      gate: "G1",
      severity: "error",
    });
  }

  return blockers;
}

/**
 * G2: Framework-Select → Execution
 * Fuer SoA-Coverage wird ein separater Context gebraucht (Zahlen aus der
 * Datenbank, nicht aus AssessmentSnapshot). Daher Validator mit SoA-Stats.
 */
export interface SoaStats {
  /** Gesamt-Anzahl `catalog_entry` in den aktivierten Katalogen */
  totalCatalogEntries: number;
  /** Anzahl dieser mit einem `soa_entry` */
  entriesWithSoa: number;
  /** Anzahl soa_entry mit applicability='not_applicable' ohne Justification (>= 50 chars) */
  notApplicableWithoutJustification: number;
}

export function validateGate2SoaCoverage(stats: SoaStats): Blocker[] {
  const blockers: Blocker[] = [];

  if (stats.totalCatalogEntries === 0) {
    blockers.push({
      code: "no_active_catalogs",
      message:
        "Keine aktiven Kataloge fuer diese Org. Aktiviere zuerst mindestens ein Framework (z. B. ISO 27001 Annex A).",
      gate: "G2",
      severity: "error",
    });
    return blockers;
  }

  const coverage = stats.entriesWithSoa / stats.totalCatalogEntries;
  if (coverage < 0.8) {
    blockers.push({
      code: "soa_coverage_below_threshold",
      message: `SoA-Coverage bei ${(coverage * 100).toFixed(1)}%. Mindestens 80% aller catalog_entries muessen einen soa_entry haben. Fuehre initialize-soa aus.`,
      gate: "G2",
      severity: "error",
    });
  }

  if (stats.notApplicableWithoutJustification > 0) {
    blockers.push({
      code: "not_applicable_without_justification",
      message: `${stats.notApplicableWithoutJustification} soa_entry(s) sind "not_applicable", haben aber keine Justification (>= 50 Zeichen).`,
      gate: "G2",
      severity: "error",
    });
  }

  return blockers;
}

/**
 * G3: Risk-Assessment → Control-Evaluation
 * Alle Risk-Scenarios im Run haben eine Decision (!= 'pending').
 */
export interface RiskEvalStats {
  /** Gesamt-Anzahl assessment_risk_eval im Run */
  totalRiskEvals: number;
  /** Anzahl mit decision != 'pending' */
  decided: number;
  /** Anzahl mit residualLikelihood AND residualImpact gesetzt */
  scored: number;
}

export function validateGate3RiskAssessment(stats: RiskEvalStats): Blocker[] {
  const blockers: Blocker[] = [];

  if (stats.totalRiskEvals === 0) {
    blockers.push({
      code: "no_risk_evals",
      message:
        "Keine Risk-Scenarios fuer diesen Run. Fuehre risk-assessment/generate-scenarios aus.",
      gate: "G3",
      severity: "error",
    });
    return blockers;
  }

  const pending = stats.totalRiskEvals - stats.decided;
  if (pending > 0) {
    blockers.push({
      code: "pending_decisions",
      message: `${pending} von ${stats.totalRiskEvals} Risk-Scenarios haben decision='pending'. Jedes Scenario braucht eine Entscheidung (accept|mitigate|transfer|avoid).`,
      gate: "G3",
      severity: "error",
    });
  }

  const unscored = stats.totalRiskEvals - stats.scored;
  if (unscored > 0) {
    blockers.push({
      code: "unscored_scenarios",
      message: `${unscored} Scenarios ohne residualLikelihood/residualImpact-Score. Bewertung unvollstaendig.`,
      gate: "G3",
      severity: "warning",
    });
  }

  return blockers;
}

/** G4: Control-Eval → Gap-Analysis */
export function validateGate4Coverage(run: AssessmentSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (run.totalEvaluations === 0) {
    blockers.push({
      code: "no_evaluations",
      message: "Keine Evaluations erzeugt. Fuehre initialize-soa + generate-evaluations zuerst aus.",
      gate: "G4",
      severity: "error",
    });
    return blockers;
  }

  const coverage = run.completedEvaluations / run.totalEvaluations;
  if (coverage < 0.8) {
    blockers.push({
      code: "coverage_below_threshold",
      message: `Nur ${(coverage * 100).toFixed(1)}% der Evaluations abgeschlossen. Mindestens 80% fuer Gap-Analysis.`,
      gate: "G4",
      severity: "error",
    });
  }

  return blockers;
}

// ─── Transition-Validator ──────────────────────────────────────

export interface TransitionRequest {
  currentStatus: AssessmentStatus;
  targetStatus: AssessmentStatus;
  snapshot: AssessmentSnapshot;
}

export interface TransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  /** Neue Status-Werte die angewendet werden sollen (falls allowed=true) */
  updates?: Partial<AssessmentSnapshot>;
}

export function validateTransition(req: TransitionRequest): TransitionResult {
  const { currentStatus, targetStatus, snapshot } = req;

  // 1. Ist die Transition im Prinzip erlaubt?
  const allowedFrom = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowedFrom.includes(targetStatus)) {
    return {
      allowed: false,
      blockers: [
        {
          code: "invalid_transition",
          message: `Transition von ${currentStatus} nach ${targetStatus} nicht erlaubt. Zulaessig: ${allowedFrom.join(", ") || "(keine)"}.`,
          gate: "state_machine",
          severity: "error",
        },
      ],
    };
  }

  // 2. Gate-spezifische Pruefungen pro Transition
  let gateBlockers: Blocker[] = [];

  if (currentStatus === "planning" && targetStatus === "in_progress") {
    // Gate G1: Setup muss vollstaendig sein
    gateBlockers = validateGate1Setup(snapshot);
  }

  if (currentStatus === "in_progress" && targetStatus === "review") {
    // Gate G4: Coverage muss >= 80% sein
    gateBlockers = validateGate4Coverage(snapshot);
  }

  if (gateBlockers.some((b) => b.severity === "error")) {
    return { allowed: false, blockers: gateBlockers };
  }

  return {
    allowed: true,
    blockers: gateBlockers, // warnings may still be present
    updates: { status: targetStatus },
  };
}

// ─── Phase-Checklist Helper (fuer UI) ──────────────────────────

export interface PhaseChecklist {
  phase: AssessmentPhase;
  progressPercentage: number;
  requiredSteps: Array<{
    key: string;
    label: string;
    done: boolean;
  }>;
}

export function buildSetupChecklist(snapshot: AssessmentSnapshot): PhaseChecklist {
  const steps = [
    {
      key: "name",
      label: "Assessment-Name gesetzt",
      done: !!(snapshot.name && snapshot.name.trim().length > 0),
    },
    {
      key: "scope_statement",
      label: "Scope-Statement >= 200 Zeichen",
      done: !!(snapshot.description && snapshot.description.length >= 200),
    },
    {
      key: "framework",
      label: "Framework gewaehlt",
      done: !!snapshot.framework,
    },
    {
      key: "period",
      label: "Assessment-Periode (min. 14 Tage) gesetzt",
      done:
        !!snapshot.periodStart && !!snapshot.periodEnd &&
        (new Date(snapshot.periodEnd).getTime() - new Date(snapshot.periodStart).getTime()) / (1000 * 60 * 60 * 24) >= 14,
    },
    {
      key: "lead_assessor",
      label: "Lead-Assessor zugewiesen",
      done: !!snapshot.leadAssessorId,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return {
    phase: "setup",
    progressPercentage: Math.round((doneCount / steps.length) * 100),
    requiredSteps: steps,
  };
}
