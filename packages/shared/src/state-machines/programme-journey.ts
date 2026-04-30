// Programme Journey State Machine
//
// Bezug: docs/isms-bcms/10-programme-cockpit-implementation-plan.md §3.1
//
// Lifecycle eines Einführungsprogramms:
//   planned → active → (on_track | at_risk | blocked) → completed → archived
//
// `on_track`/`at_risk`/`blocked` sind abgeleitete Status, berechnet vom
// JourneyHealthEvaluator. Manuelle Übergänge erlauben den Operator, den
// abgeleiteten Status zu überschreiben (z.B. aus blocked zurück nach active).

export const PROGRAMME_JOURNEY_STATUSES = [
  "planned",
  "active",
  "on_track",
  "at_risk",
  "blocked",
  "completed",
  "archived",
] as const;
export type ProgrammeJourneyStatus =
  (typeof PROGRAMME_JOURNEY_STATUSES)[number];

export const PROGRAMME_JOURNEY_TRANSITIONS: Record<
  ProgrammeJourneyStatus,
  ProgrammeJourneyStatus[]
> = {
  planned: ["active", "archived"],
  active: ["on_track", "at_risk", "blocked", "completed", "archived"],
  on_track: ["at_risk", "blocked", "active", "completed", "archived"],
  at_risk: ["on_track", "blocked", "active", "completed", "archived"],
  blocked: ["at_risk", "on_track", "active", "completed", "archived"],
  completed: ["archived"],
  archived: [],
};

export interface JourneyTransitionInput {
  from: ProgrammeJourneyStatus;
  to: ProgrammeJourneyStatus;
}

export interface JourneyTransitionResult {
  ok: boolean;
  reason?: string;
}

export function isProgrammeJourneyStatus(
  value: unknown,
): value is ProgrammeJourneyStatus {
  return (
    typeof value === "string" &&
    (PROGRAMME_JOURNEY_STATUSES as readonly string[]).includes(value)
  );
}

export function validateJourneyTransition(
  input: JourneyTransitionInput,
): JourneyTransitionResult {
  const { from, to } = input;
  if (from === to) return { ok: true };
  const allowed = PROGRAMME_JOURNEY_TRANSITIONS[from];
  if (!allowed) return { ok: false, reason: `Unknown source status: ${from}` };
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Transition ${from} → ${to} not allowed. Allowed: ${allowed.join(", ") || "(none)"}.`,
    };
  }
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Health-Evaluator — leitet on_track/at_risk/blocked aus Step-Stats ab
// ──────────────────────────────────────────────────────────────

export interface JourneyHealthInput {
  totalSteps: number;
  completedSteps: number;
  inProgressSteps: number;
  blockedSteps: number;
  overdueSteps: number;
  unassignedMandatorySteps: number;
}

export interface JourneyHealthResult {
  /** Aktueller Status nach Auswertung. */
  derivedStatus: "on_track" | "at_risk" | "blocked" | "completed";
  /** Erklärung als menschenlesbare Zeile. */
  reason: string;
  /** Score 0-100. */
  healthScore: number;
  /** Strukturierte Signale für UI. */
  signals: HealthSignal[];
}

export interface HealthSignal {
  code:
    | "all_completed"
    | "blocked_steps"
    | "overdue_steps"
    | "unassigned_steps"
    | "no_progress"
    | "on_track";
  severity: "info" | "warning" | "critical";
  message: string;
  count: number;
}

/**
 * Bewertungs-Logik:
 *   - Alle Schritte completed → completed
 *   - ≥ 1 blocked || ≥ 20% overdue → blocked
 *   - ≥ 1 overdue || ≥ 1 unassigned mandatory || progress<10% nach 30 Tagen → at_risk
 *   - sonst → on_track
 */
export function evaluateJourneyHealth(
  input: JourneyHealthInput,
): JourneyHealthResult {
  const {
    totalSteps,
    completedSteps,
    blockedSteps,
    overdueSteps,
    unassignedMandatorySteps,
  } = input;

  const signals: HealthSignal[] = [];

  if (totalSteps === 0) {
    return {
      derivedStatus: "at_risk",
      reason: "Journey has no steps configured.",
      healthScore: 0,
      signals: [
        {
          code: "no_progress",
          severity: "critical",
          message: "No steps configured.",
          count: 0,
        },
      ],
    };
  }

  if (completedSteps === totalSteps) {
    return {
      derivedStatus: "completed",
      reason: "All steps completed.",
      healthScore: 100,
      signals: [
        {
          code: "all_completed",
          severity: "info",
          message: "All steps completed.",
          count: totalSteps,
        },
      ],
    };
  }

  const overdueRatio = overdueSteps / totalSteps;
  const completedRatio = completedSteps / totalSteps;
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        completedRatio * 100 -
          overdueRatio * 30 -
          (blockedSteps / totalSteps) * 20 -
          (unassignedMandatorySteps / totalSteps) * 10,
      ),
    ),
  );

  if (blockedSteps > 0) {
    signals.push({
      code: "blocked_steps",
      severity: "critical",
      message: `${blockedSteps} step(s) blocked.`,
      count: blockedSteps,
    });
  }

  if (overdueRatio >= 0.2) {
    return {
      derivedStatus: "blocked",
      reason: `≥ 20% of steps overdue (${overdueSteps}/${totalSteps}).`,
      healthScore,
      signals: [
        ...signals,
        {
          code: "overdue_steps",
          severity: "critical",
          message: `${overdueSteps} step(s) overdue (≥ 20% of total).`,
          count: overdueSteps,
        },
      ],
    };
  }

  if (blockedSteps > 0) {
    return {
      derivedStatus: "blocked",
      reason: `${blockedSteps} step(s) currently blocked.`,
      healthScore,
      signals,
    };
  }

  if (overdueSteps > 0) {
    signals.push({
      code: "overdue_steps",
      severity: "warning",
      message: `${overdueSteps} step(s) overdue.`,
      count: overdueSteps,
    });
  }

  if (unassignedMandatorySteps > 0) {
    signals.push({
      code: "unassigned_steps",
      severity: "warning",
      message: `${unassignedMandatorySteps} mandatory step(s) without owner.`,
      count: unassignedMandatorySteps,
    });
  }

  if (signals.length > 0) {
    return {
      derivedStatus: "at_risk",
      reason: signals.map((s) => s.message).join(" "),
      healthScore,
      signals,
    };
  }

  return {
    derivedStatus: "on_track",
    reason: "Programme is on track.",
    healthScore,
    signals: [
      {
        code: "on_track",
        severity: "info",
        message: "Programme is on track.",
        count: 0,
      },
    ],
  };
}

/**
 * Progress-Prozent aus Step-Counts.
 * Berücksichtigt completed + skipped + 50%-Anteil von in_progress.
 */
export function computeJourneyProgress(input: {
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  inProgressSteps: number;
  reviewSteps: number;
}): number {
  const { totalSteps, completedSteps, skippedSteps, inProgressSteps, reviewSteps } =
    input;
  if (totalSteps === 0) return 0;
  const weighted =
    completedSteps + skippedSteps + reviewSteps * 0.85 + inProgressSteps * 0.5;
  return Math.round((weighted / totalSteps) * 10000) / 100;
}
