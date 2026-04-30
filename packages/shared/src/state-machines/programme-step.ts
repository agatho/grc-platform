// Programme Step State Machine
//
// Bezug: docs/isms-bcms/10-programme-cockpit-implementation-plan.md §3.2
//
// Lifecycle:
//   pending → in_progress → review → completed
//   pending → blocked ⇄ in_progress
//   * → skipped (mit Skip-Reason)
//   * → cancelled (admin only)

export const PROGRAMME_STEP_STATUSES = [
  "pending",
  "blocked",
  "in_progress",
  "review",
  "completed",
  "skipped",
  "cancelled",
] as const;
export type ProgrammeStepStatus = (typeof PROGRAMME_STEP_STATUSES)[number];

export const PROGRAMME_STEP_TRANSITIONS: Record<
  ProgrammeStepStatus,
  ProgrammeStepStatus[]
> = {
  pending: ["in_progress", "blocked", "skipped", "cancelled"],
  blocked: ["in_progress", "pending", "skipped", "cancelled"],
  in_progress: ["review", "blocked", "pending", "skipped", "cancelled"],
  review: ["completed", "in_progress", "blocked", "cancelled"],
  completed: ["in_progress"],
  skipped: ["pending"],
  cancelled: [],
};

export interface StepTransitionInput {
  from: ProgrammeStepStatus;
  to: ProgrammeStepStatus;
  /** Begründung für skip oder block (Pflichtfeld). */
  reason?: string;
}

export interface StepTransitionResult {
  ok: boolean;
  reason?: string;
}

export function isProgrammeStepStatus(
  value: unknown,
): value is ProgrammeStepStatus {
  return (
    typeof value === "string" &&
    (PROGRAMME_STEP_STATUSES as readonly string[]).includes(value)
  );
}

export function validateStepTransition(
  input: StepTransitionInput,
): StepTransitionResult {
  const { from, to, reason } = input;
  if (from === to) return { ok: true };
  const allowed = PROGRAMME_STEP_TRANSITIONS[from];
  if (!allowed) return { ok: false, reason: `Unknown source status: ${from}` };
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Transition ${from} → ${to} not allowed. Allowed: ${allowed.join(", ") || "(none)"}.`,
    };
  }

  if (to === "skipped" && (!reason || reason.trim().length < 5)) {
    return {
      ok: false,
      reason: "Skip transition requires a non-empty reason (≥ 5 characters).",
    };
  }

  if (to === "blocked" && (!reason || reason.trim().length < 5)) {
    return {
      ok: false,
      reason: "Block transition requires a non-empty reason (≥ 5 characters).",
    };
  }

  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Pre-conditions for entering states
// ──────────────────────────────────────────────────────────────

export interface StepStartPreconditionInput {
  prerequisiteStepCodes: string[];
  prerequisiteStepStates: Record<string, ProgrammeStepStatus>;
}

export interface StepStartPreconditionResult {
  ok: boolean;
  unmetPrerequisites: string[];
  reason?: string;
}

/**
 * Vor `pending → in_progress`: alle Prerequisites müssen `completed` oder `skipped` sein.
 */
export function assertCanStartStep(
  input: StepStartPreconditionInput,
): StepStartPreconditionResult {
  const { prerequisiteStepCodes, prerequisiteStepStates } = input;
  const unmet: string[] = [];
  for (const code of prerequisiteStepCodes) {
    const state = prerequisiteStepStates[code];
    if (state !== "completed" && state !== "skipped") {
      unmet.push(code);
    }
  }
  if (unmet.length > 0) {
    return {
      ok: false,
      unmetPrerequisites: unmet,
      reason: `Cannot start step: prerequisites not met (${unmet.join(", ")}).`,
    };
  }
  return { ok: true, unmetPrerequisites: [] };
}

export interface StepReviewPreconditionInput {
  requiredEvidenceCount: number;
  evidenceLinks: Array<{ type: string; id: string; label?: string }>;
}

export interface StepReviewPreconditionResult {
  ok: boolean;
  reason?: string;
  evidenceProvided: number;
  evidenceRequired: number;
}

/**
 * Vor `in_progress → review`: ausreichend Evidence-Links angehängt.
 */
export function assertCanReviewStep(
  input: StepReviewPreconditionInput,
): StepReviewPreconditionResult {
  const provided = input.evidenceLinks?.length ?? 0;
  const required = input.requiredEvidenceCount;
  if (provided < required) {
    return {
      ok: false,
      evidenceProvided: provided,
      evidenceRequired: required,
      reason: `Cannot move to review: ${provided}/${required} evidence links provided.`,
    };
  }
  return { ok: true, evidenceProvided: provided, evidenceRequired: required };
}

// ──────────────────────────────────────────────────────────────
// Next-Best-Actions Algorithm
// ──────────────────────────────────────────────────────────────

export interface StepCandidate {
  id: string;
  code: string;
  name: string;
  phaseSequence: number;
  sequence: number;
  status: ProgrammeStepStatus;
  ownerId: string | null;
  dueDate: string | null;
  isMandatory: boolean;
  prerequisiteStepCodes: string[];
}

export interface NextActionItem {
  stepId: string;
  code: string;
  name: string;
  reason:
    | "overdue"
    | "due_soon"
    | "in_progress"
    | "unassigned"
    | "next_in_sequence"
    | "blocker_resolution";
  priority: number;
  dueInDays: number | null;
}

export interface NextBestActionsInput {
  steps: StepCandidate[];
  /** ISO Datum YYYY-MM-DD; default = today */
  today?: string;
  /** Begrenzt die Liste */
  limit?: number;
}

/**
 * Liefert die nächsten N empfohlenen Aktionen, priorisiert nach:
 *   1. überfällig (priority 100+)
 *   2. blocked → unblocking ist Top-Priorität
 *   3. in_progress + unassigned (priority 80)
 *   4. due in ≤ 7 Tagen (priority 70-90)
 *   5. nächste pending mit erfüllten Prerequisites (priority 50-60)
 */
export function computeNextBestActions(
  input: NextBestActionsInput,
): NextActionItem[] {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(today + "T00:00:00Z");
  const limit = input.limit ?? 5;

  const completedCodes = new Set(
    input.steps
      .filter((s) => s.status === "completed" || s.status === "skipped")
      .map((s) => s.code),
  );

  const items: NextActionItem[] = [];

  for (const step of input.steps) {
    if (step.status === "completed" || step.status === "skipped" || step.status === "cancelled") {
      continue;
    }

    const dueInDays =
      step.dueDate != null
        ? Math.floor((Date.parse(step.dueDate + "T00:00:00Z") - todayMs) / 86_400_000)
        : null;

    if (dueInDays != null && dueInDays < 0 && step.status !== "completed") {
      items.push({
        stepId: step.id,
        code: step.code,
        name: step.name,
        reason: "overdue",
        priority: 100 + Math.min(50, -dueInDays),
        dueInDays,
      });
      continue;
    }

    if (step.status === "blocked") {
      items.push({
        stepId: step.id,
        code: step.code,
        name: step.name,
        reason: "blocker_resolution",
        priority: 95,
        dueInDays,
      });
      continue;
    }

    if (step.status === "in_progress") {
      const reason = step.ownerId == null ? "unassigned" : "in_progress";
      items.push({
        stepId: step.id,
        code: step.code,
        name: step.name,
        reason,
        priority: step.ownerId == null ? 85 : 75,
        dueInDays,
      });
      continue;
    }

    if (dueInDays != null && dueInDays >= 0 && dueInDays <= 7) {
      items.push({
        stepId: step.id,
        code: step.code,
        name: step.name,
        reason: "due_soon",
        priority: 70 + (7 - dueInDays),
        dueInDays,
      });
      continue;
    }

    if (step.status === "pending") {
      const allPrereqsMet = step.prerequisiteStepCodes.every((c) =>
        completedCodes.has(c),
      );
      if (allPrereqsMet) {
        items.push({
          stepId: step.id,
          code: step.code,
          name: step.name,
          reason: "next_in_sequence",
          priority:
            50 -
            step.phaseSequence -
            step.sequence * 0.001 +
            (step.isMandatory ? 5 : 0),
          dueInDays,
        });
      }
    }
  }

  items.sort((a, b) => b.priority - a.priority);
  return items.slice(0, limit);
}
