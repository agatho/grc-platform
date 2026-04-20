// BCMS Crisis State-Machine + DORA-Timer-Helpers
//
// Referenz: docs/assessment-plans/02-bcms-assessment-plan.md §3.7 + §8
// Gates B9 (Activate), B10 (Resolve).
//
// DB-Enum `crisis_status`: standby | activated | resolved | post_mortem

import type { CrisisStatus } from "../types/bcms";
export type { CrisisStatus };

export const CRISIS_ALLOWED_TRANSITIONS: Record<CrisisStatus, CrisisStatus[]> =
  {
    standby: ["activated"],
    activated: ["resolved"],
    resolved: ["post_mortem"],
    post_mortem: ["standby"], // Zurueck auf Standby nach Post-Mortem
  };

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

export interface CrisisSnapshot {
  status: CrisisStatus;
  name: string | null;
  severity: string | null;
  bcpId: string | null;
  activatedAt: Date | string | null;
  activatedBy: string | null;
  resolvedAt: Date | string | null;
  postMortemNotes: string | null;
  logEntryCount: number;
  communicationCount: number;
}

/** B9: Standby -> Activated -- Severity-Assessment + Authority-Check */
export function validateCrisisGate9Activate(
  snapshot: CrisisSnapshot,
  activatingUserId: string | null,
): Blocker[] {
  const blockers: Blocker[] = [];

  if (!activatingUserId) {
    blockers.push({
      code: "missing_activator",
      message: "Activating-User muss identifiziert sein.",
      gate: "B9",
      severity: "error",
    });
  }

  if (!snapshot.severity) {
    blockers.push({
      code: "missing_severity",
      message: "Severity muss vor Activation gesetzt sein.",
      gate: "B9",
      severity: "error",
    });
  }

  if (!snapshot.bcpId) {
    blockers.push({
      code: "no_bcp_linked",
      message: "Keinen BCP referenziert -- Recovery-Plan fehlt.",
      gate: "B9",
      severity: "warning",
    });
  }

  return blockers;
}

/** B10: Activated -> Resolved -- Alle Logs erfasst, RCA-Start */
export function validateCrisisGate10Resolve(
  snapshot: CrisisSnapshot,
): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.activatedAt) {
    blockers.push({
      code: "not_activated",
      message: "Crisis muss erst activated werden bevor resolved.",
      gate: "B10",
      severity: "error",
    });
  }

  if (snapshot.logEntryCount === 0) {
    blockers.push({
      code: "no_crisis_log_entries",
      message:
        "Mindestens 1 crisis_log-Eintrag erforderlich (Initial-Assessment, Decisions, Actions).",
      gate: "B10",
      severity: "error",
    });
  }

  if (snapshot.communicationCount === 0) {
    blockers.push({
      code: "no_communication_log",
      message:
        "Keine crisis_communication_log-Eintraege. Mindestens eine Kommunikation (intern oder extern) sollte dokumentiert sein.",
      gate: "B10",
      severity: "warning",
    });
  }

  return blockers;
}

export interface CrisisTransitionRequest {
  currentStatus: CrisisStatus;
  targetStatus: CrisisStatus;
  snapshot: CrisisSnapshot;
  activatingUserId?: string | null;
}

export interface CrisisTransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  updates?: Partial<CrisisSnapshot>;
}

export function validateCrisisTransition(
  req: CrisisTransitionRequest,
): CrisisTransitionResult {
  const { currentStatus, targetStatus, snapshot, activatingUserId } = req;

  const allowed = CRISIS_ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false,
      blockers: [
        {
          code: "invalid_transition",
          message: `Transition ${currentStatus} → ${targetStatus} nicht erlaubt.`,
          gate: "state_machine",
          severity: "error",
        },
      ],
    };
  }

  let gateBlockers: Blocker[] = [];
  if (currentStatus === "standby" && targetStatus === "activated") {
    gateBlockers = validateCrisisGate9Activate(
      snapshot,
      activatingUserId ?? null,
    );
  }
  if (currentStatus === "activated" && targetStatus === "resolved") {
    gateBlockers = validateCrisisGate10Resolve(snapshot);
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

// ─── DORA-Timer-Helpers (Art. 17 + 19) ────────────────────────
//
// DORA-Meldefristen fuer signifikante ICT-related-Incidents:
//   - Early-Warning:     4h nach Classification
//   - Intermediate:     72h nach Classification
//   - Final-Report:      1 Monat nach Classification

export interface DoraDeadlines {
  classifiedAt: Date;
  earlyWarningDueAt: Date; // +4h
  intermediateReportDueAt: Date; // +72h
  finalReportDueAt: Date; // +1m
  earlyWarningOverdue: boolean;
  intermediateOverdue: boolean;
  finalOverdue: boolean;
  /** Sekunden bis zur naechsten Frist (negativ wenn bereits ueberfaellig) */
  secondsToNextDeadline: number | null;
  nextDeadlineLabel: "early_warning" | "intermediate" | "final" | "none";
}

export function computeDoraDeadlines(
  classifiedAt: Date,
  now: Date = new Date(),
): DoraDeadlines {
  const HOUR_MS = 60 * 60 * 1000;
  const earlyWarning = new Date(classifiedAt.getTime() + 4 * HOUR_MS);
  const intermediate = new Date(classifiedAt.getTime() + 72 * HOUR_MS);
  const final = new Date(classifiedAt);
  final.setMonth(final.getMonth() + 1);

  const nowMs = now.getTime();
  const earlyOverdue = nowMs > earlyWarning.getTime();
  const intermediateOverdue = nowMs > intermediate.getTime();
  const finalOverdue = nowMs > final.getTime();

  let next: Date | null = null;
  let label: DoraDeadlines["nextDeadlineLabel"] = "none";

  if (!earlyOverdue) {
    next = earlyWarning;
    label = "early_warning";
  } else if (!intermediateOverdue) {
    next = intermediate;
    label = "intermediate";
  } else if (!finalOverdue) {
    next = final;
    label = "final";
  }

  return {
    classifiedAt,
    earlyWarningDueAt: earlyWarning,
    intermediateReportDueAt: intermediate,
    finalReportDueAt: final,
    earlyWarningOverdue: earlyOverdue,
    intermediateOverdue,
    finalOverdue,
    secondsToNextDeadline: next
      ? Math.floor((next.getTime() - nowMs) / 1000)
      : null,
    nextDeadlineLabel: label,
  };
}
