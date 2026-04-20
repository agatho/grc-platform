// BCMS BIA State-Machine
//
// Referenz: docs/assessment-plans/02-bcms-assessment-plan.md §3.2 + §8
// Workflow-Gates B1 (Setup) + B2 (Coverage).
//
// DB-Enum `bia_status`: draft | in_progress | review | approved | archived

import type { BiaStatus } from "../types/bcms";
export type { BiaStatus };

export const BIA_ALLOWED_TRANSITIONS: Record<BiaStatus, BiaStatus[]> = {
  draft: ["in_progress"],
  in_progress: ["review", "draft"],
  review: ["approved", "in_progress"],
  approved: ["archived"],
  archived: [],
};

export interface BiaSnapshot {
  status: BiaStatus;
  name: string | null;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  leadAssessorId: string | null;
  totalProcessImpacts: number;
  /** Anzahl process_impacts mit MTPD+RTO+RPO gesetzt */
  scoredImpacts: number;
  /** Anzahl als essential markiert */
  essentialCount: number;
}

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

/** B1: Draft → In_progress -- Setup-Vollstaendigkeit */
export function validateBcmsGate1Setup(snapshot: BiaSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.name || snapshot.name.trim().length === 0) {
    blockers.push({
      code: "missing_name",
      message: "BIA-Assessment braucht einen Namen.",
      gate: "B1",
      severity: "error",
    });
  }

  if (!snapshot.leadAssessorId) {
    blockers.push({
      code: "missing_lead_assessor",
      message:
        "Lead-Assessor muss zugewiesen sein (typ. risk_manager oder Process-Owner).",
      gate: "B1",
      severity: "error",
    });
  }

  if (!snapshot.periodStart || !snapshot.periodEnd) {
    blockers.push({
      code: "missing_period",
      message: "periodStart und periodEnd muessen gesetzt sein.",
      gate: "B1",
      severity: "error",
    });
  } else {
    const diffDays =
      (new Date(snapshot.periodEnd).getTime() -
        new Date(snapshot.periodStart).getTime()) /
      (1000 * 60 * 60 * 24);
    if (diffDays < 7) {
      blockers.push({
        code: "period_too_short",
        message: "BIA-Periode muss mindestens 7 Tage umfassen.",
        gate: "B1",
        severity: "error",
      });
    }
  }

  return blockers;
}

/** B2: In_progress → Review -- Mindestens N Impacts bewertet */
export interface BiaCoverageStats {
  totalProcessImpacts: number;
  scoredImpacts: number;
  essentialCount: number;
  minimumEssentialCount: number;
}

export function validateBcmsGate2Coverage(stats: BiaCoverageStats): Blocker[] {
  const blockers: Blocker[] = [];

  if (stats.totalProcessImpacts === 0) {
    blockers.push({
      code: "no_process_impacts",
      message:
        "Keine bia_process_impact-Eintraege. Erzeuge sie aus der Process-Liste via generate-process-impacts.",
      gate: "B2",
      severity: "error",
    });
    return blockers;
  }

  const scoreCoverage = stats.scoredImpacts / stats.totalProcessImpacts;
  if (scoreCoverage < 0.8) {
    blockers.push({
      code: "score_coverage_below_threshold",
      message: `Nur ${(scoreCoverage * 100).toFixed(1)}% der Impacts haben MTPD+RTO+RPO gesetzt. Mindestens 80% erforderlich.`,
      gate: "B2",
      severity: "error",
    });
  }

  if (stats.essentialCount < stats.minimumEssentialCount) {
    blockers.push({
      code: "not_enough_essentials",
      message: `Nur ${stats.essentialCount} Prozesse als essential markiert. Mindestens ${stats.minimumEssentialCount} empfohlen.`,
      gate: "B2",
      severity: "warning",
    });
  }

  return blockers;
}

export interface BiaTransitionRequest {
  currentStatus: BiaStatus;
  targetStatus: BiaStatus;
  snapshot: BiaSnapshot;
  coverageStats?: BiaCoverageStats;
}

export interface BiaTransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  updates?: Partial<BiaSnapshot>;
}

export function validateBiaTransition(
  req: BiaTransitionRequest,
): BiaTransitionResult {
  const { currentStatus, targetStatus, snapshot, coverageStats } = req;

  const allowed = BIA_ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false,
      blockers: [
        {
          code: "invalid_transition",
          message: `Transition ${currentStatus} → ${targetStatus} nicht erlaubt. Erlaubt: ${allowed.join(", ") || "(keine)"}.`,
          gate: "state_machine",
          severity: "error",
        },
      ],
    };
  }

  let gateBlockers: Blocker[] = [];

  if (currentStatus === "draft" && targetStatus === "in_progress") {
    gateBlockers = validateBcmsGate1Setup(snapshot);
  }

  if (currentStatus === "in_progress" && targetStatus === "review") {
    if (!coverageStats) {
      return {
        allowed: false,
        blockers: [
          {
            code: "missing_coverage_stats",
            message:
              "Coverage-Stats erforderlich fuer Transition nach 'review'.",
            gate: "B2",
            severity: "error",
          },
        ],
      };
    }
    gateBlockers = validateBcmsGate2Coverage(coverageStats);
  }

  if (gateBlockers.some((b) => b.severity === "error")) {
    return { allowed: false, blockers: gateBlockers };
  }

  return {
    allowed: true,
    blockers: gateBlockers,
    updates: { status: targetStatus },
  };
}
