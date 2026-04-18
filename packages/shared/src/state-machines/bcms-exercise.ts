// BCMS Exercise State-Machine
//
// Referenz: docs/assessment-plans/02-bcms-assessment-plan.md §3.6 + §8
// Gates B7 (Plan -> Execute) + B8 (Close).
//
// DB-Enum `exercise_status`:
//   planned | preparation | executing | evaluation | completed | cancelled

import type { ExerciseStatus } from "../types/bcms";
export type { ExerciseStatus };

export const EXERCISE_ALLOWED_TRANSITIONS: Record<ExerciseStatus, ExerciseStatus[]> = {
  planned: ["preparation", "cancelled"],
  preparation: ["executing", "planned", "cancelled"],
  executing: ["evaluation", "cancelled"],
  evaluation: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

export interface ExerciseSnapshot {
  status: ExerciseStatus;
  title: string | null;
  exerciseType: string | null;
  plannedDate: string | null;
  exerciseLeadId: string | null;
  participantIds: string[] | null;
  bcpId: string | null;
  crisisScenarioId: string | null;
  objectives: unknown;
  overallResult: string | null;
  findingsCount: number;
  lessonsLearnedCount: number;
}

/** B7: Plan -> Execute -- Team + Scenario + Objectives definiert */
export function validateExerciseGate7Execute(snapshot: ExerciseSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.title || snapshot.title.trim().length === 0) {
    blockers.push({
      code: "missing_title",
      message: "Exercise braucht einen Titel.",
      gate: "B7",
      severity: "error",
    });
  }

  if (!snapshot.exerciseLeadId) {
    blockers.push({
      code: "missing_lead",
      message: "Exercise-Lead muss zugewiesen sein.",
      gate: "B7",
      severity: "error",
    });
  }

  if (!snapshot.participantIds || snapshot.participantIds.length < 2) {
    blockers.push({
      code: "too_few_participants",
      message: "Mindestens 2 Teilnehmer erforderlich (Lead + 1 weiterer).",
      gate: "B7",
      severity: "error",
    });
  }

  if (!snapshot.bcpId && !snapshot.crisisScenarioId) {
    blockers.push({
      code: "no_context",
      message: "Exercise muss auf einen BCP oder ein Crisis-Scenario referenzieren.",
      gate: "B7",
      severity: "error",
    });
  }

  if (!snapshot.objectives || (Array.isArray(snapshot.objectives) && snapshot.objectives.length === 0)) {
    blockers.push({
      code: "missing_objectives",
      message: "Mindestens 1 Objective muss definiert sein.",
      gate: "B7",
      severity: "error",
    });
  }

  if (!snapshot.plannedDate) {
    blockers.push({
      code: "missing_planned_date",
      message: "plannedDate muss gesetzt sein.",
      gate: "B7",
      severity: "error",
    });
  }

  return blockers;
}

/** B8: Evaluation -> Completed -- overallResult + Lessons-Learned */
export function validateExerciseGate8Close(snapshot: ExerciseSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.overallResult) {
    blockers.push({
      code: "missing_overall_result",
      message: "overallResult muss gesetzt sein (successful | partially_successful | failed).",
      gate: "B8",
      severity: "error",
    });
  }

  if (snapshot.lessonsLearnedCount === 0) {
    blockers.push({
      code: "no_lessons_learned",
      message: "Mindestens 1 Lesson-Learned muss erfasst sein (Continual-Improvement ISO 22301 10.2).",
      gate: "B8",
      severity: "error",
    });
  }

  if (snapshot.findingsCount === 0) {
    blockers.push({
      code: "no_findings",
      message:
        "Keine Findings erfasst. Wenn Exercise wirklich ohne Beobachtungen lief, bestaetige mit Force-Flag im API.",
      gate: "B8",
      severity: "warning",
    });
  }

  return blockers;
}

export interface ExerciseTransitionRequest {
  currentStatus: ExerciseStatus;
  targetStatus: ExerciseStatus;
  snapshot: ExerciseSnapshot;
  forceCloseWithoutFindings?: boolean;
}

export interface ExerciseTransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  updates?: Partial<ExerciseSnapshot>;
}

export function validateExerciseTransition(req: ExerciseTransitionRequest): ExerciseTransitionResult {
  const { currentStatus, targetStatus, snapshot, forceCloseWithoutFindings } = req;

  const allowed = EXERCISE_ALLOWED_TRANSITIONS[currentStatus] ?? [];
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

  if (currentStatus === "preparation" && targetStatus === "executing") {
    gateBlockers = validateExerciseGate7Execute(snapshot);
  }

  if (currentStatus === "evaluation" && targetStatus === "completed") {
    gateBlockers = validateExerciseGate8Close(snapshot);
    // Warnings zu Errors upgraden wenn NICHT force
    if (!forceCloseWithoutFindings) {
      // only `no_findings` is warning -- keep as warning
    }
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
