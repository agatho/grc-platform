// B2 (Release-Cycle): pure chain logic for multi-stage process approval
// steps (process_approval_step). Kept framework-free so the API routes
// and unit tests share the exact same semantics.

export type ApprovalStepType = "review" | "approval" | "acknowledgment";

export type ApprovalStepStatus =
  "pending" | "in_progress" | "completed" | "rejected" | "skipped";

export type ApprovalDecision = "approve" | "reject";

// ──────────────────────────────────────────────────────────────
// Status transition map
// ──────────────────────────────────────────────────────────────

export const APPROVAL_STEP_STATUS_TRANSITIONS: Record<
  ApprovalStepStatus,
  ApprovalStepStatus[]
> = {
  pending: ["in_progress", "completed", "rejected", "skipped"],
  in_progress: ["completed", "rejected", "skipped"],
  completed: [], // terminal
  rejected: [], // terminal
  skipped: [], // terminal
};

export function isValidApprovalStepTransition(
  from: ApprovalStepStatus,
  to: ApprovalStepStatus,
): boolean {
  return APPROVAL_STEP_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A step can only be decided while it is pending or in_progress. */
export function isDecidableStepStatus(status: ApprovalStepStatus): boolean {
  return status === "pending" || status === "in_progress";
}

/** Rejections always require a written rationale. */
export function approvalDecisionRequiresComment(
  decision: ApprovalDecision,
): boolean {
  return decision === "reject";
}

// ──────────────────────────────────────────────────────────────
// Assignee check
// ──────────────────────────────────────────────────────────────

export interface ApprovalStepLike {
  id: string;
  stepOrder: number;
  stepType: ApprovalStepType;
  status: ApprovalStepStatus;
  assigneeUserId?: string | null;
  assigneeRole?: string | null;
}

/**
 * #WP3-S02-12 — Funktionstrennung im BPMN-Freigabezyklus.
 *
 * Befund: die Prüfung verglich NIE gegen den Autor, den Einreicher oder den
 * `processOwnerId`. Ein `process_owner` durfte über
 * `POST /processes/{id}/approval-steps` (`withAuth("admin","process_owner")`)
 * die Prüfer- und Freigeberzuordnung SEINES EIGENEN Prozesses festlegen, sich
 * dort selbst eintragen und beide Schritte entscheiden — der Prozess erreichte
 * "approved" und die Arbeitsversion wurde befördert, ohne dass ein zweiter
 * Mensch beteiligt war. Ein `admin` konnte jeden Schritt jeder Kette
 * entscheiden, auch die von ihm selbst eingereichten.
 *
 * Zum Vergleich: zwei andere Freigabepfade des Produkts hatten die Kontrolle
 * bereits — `validateAcceptanceFourEyes` (Risikoakzeptanz) und `checkFourEyes`
 * (Dokumentenstatus). Der BPMN-Zyklus und der Audit-Sign-off hatten sie nicht.
 *
 * Neue Regel: Vier-Augen zuerst, Zuständigkeit danach.
 *   1. Wer den Prozess eingereicht, die Kette definiert oder die Version
 *      erstellt hat, darf sie nicht selbst entscheiden — auch nicht als admin.
 *   2. Danach gilt wie bisher: zugewiesener Nutzer, Inhaber der zugewiesenen
 *      Rolle, oder admin.
 *
 * `admin` bleibt als Vertretungsweg erhalten (sonst blockiert ein
 * ausgeschiedener Prüfer jede Kette), verliert aber die Selbstfreigabe.
 */
export interface ApprovalSoDContext {
  /** Who submitted this version for approval. */
  submittedBy?: string | null;
  /** Who defined the approval chain. */
  chainCreatedBy?: string | null;
  /** Owner of the process. */
  processOwnerId?: string | null;
  /** Who authored the version under review. */
  versionCreatedBy?: string | null;
}

/** All actors that must not decide their own submission. */
export function approvalConflictActors(
  sod: ApprovalSoDContext | undefined,
): string[] {
  if (!sod) return [];
  return [sod.submittedBy, sod.chainCreatedBy, sod.versionCreatedBy].filter(
    (v): v is string => !!v,
  );
}

/**
 * True when the actor is barred from deciding this step because they are on
 * the producing side of it (four-eyes principle).
 */
export function violatesApprovalSeparationOfDuties(
  actor: { userId: string },
  sod: ApprovalSoDContext | undefined,
): boolean {
  return approvalConflictActors(sod).includes(actor.userId);
}

/**
 * A user may decide a step when four-eyes is satisfied AND they are the
 * assigned user, hold the assigned role, or are org admin.
 *
 * `sod` is optional so the pure chain tests and any caller that has not loaded
 * the provenance fields keep compiling — but the API route MUST pass it, and
 * `route-role-matrix.test.ts` asserts that it does.
 */
export function canDecideApprovalStep(
  step: Pick<ApprovalStepLike, "assigneeUserId" | "assigneeRole">,
  actor: { userId: string; roles: string[] },
  sod?: ApprovalSoDContext,
): boolean {
  // Four-eyes first: it overrides every role, including admin.
  if (violatesApprovalSeparationOfDuties(actor, sod)) return false;

  if (actor.roles.includes("admin")) return true;
  if (step.assigneeUserId && step.assigneeUserId === actor.userId) return true;
  if (step.assigneeRole && actor.roles.includes(step.assigneeRole)) return true;
  return false;
}

// ──────────────────────────────────────────────────────────────
// Chain evaluation
// ──────────────────────────────────────────────────────────────

export interface ApprovalChainOutcome {
  /** Status updates to persist (decided step + follow-up changes). */
  stepUpdates: Array<{ id: string; status: ApprovalStepStatus }>;
  /**
   * 'approved'  → all review/approval steps of the chain are completed
   * 'rejected'  → the chain was rejected (process falls back to draft)
   * null        → the chain is still running
   */
  processOutcome: "approved" | "rejected" | null;
  /** The step that becomes active next (set to in_progress), if any. */
  nextStepId: string | null;
}

/**
 * Evaluate the effect of a decision on a chain of approval steps
 * (all steps of one process + versionNumber).
 *
 * Rules:
 *  - reject: decided step → rejected, every other open step → skipped,
 *    process falls back to draft (processOutcome 'rejected').
 *  - approve: decided step → completed. Acknowledgment steps never block
 *    the approval outcome — when no review/approval step remains open,
 *    the process is approved.
 */
export function evaluateApprovalDecision(
  steps: ApprovalStepLike[],
  stepId: string,
  decision: ApprovalDecision,
): ApprovalChainOutcome {
  const decided = steps.find((s) => s.id === stepId);
  if (!decided) {
    throw new Error(`Approval step ${stepId} not part of the chain`);
  }
  if (!isDecidableStepStatus(decided.status)) {
    throw new Error(
      `Approval step ${stepId} is ${decided.status} and cannot be decided`,
    );
  }

  if (decision === "reject") {
    const stepUpdates: ApprovalChainOutcome["stepUpdates"] = [
      { id: decided.id, status: "rejected" },
    ];
    for (const s of steps) {
      if (s.id !== decided.id && isDecidableStepStatus(s.status)) {
        stepUpdates.push({ id: s.id, status: "skipped" });
      }
    }
    return { stepUpdates, processOutcome: "rejected", nextStepId: null };
  }

  // approve
  const stepUpdates: ApprovalChainOutcome["stepUpdates"] = [
    { id: decided.id, status: "completed" },
  ];

  const openGateSteps = steps
    .filter(
      (s) =>
        s.id !== decided.id &&
        s.stepType !== "acknowledgment" &&
        isDecidableStepStatus(s.status),
    )
    .sort((a, b) => a.stepOrder - b.stepOrder);

  if (openGateSteps.length === 0) {
    return { stepUpdates, processOutcome: "approved", nextStepId: null };
  }

  const next = openGateSteps[0];
  if (next.status === "pending") {
    stepUpdates.push({ id: next.id, status: "in_progress" });
  }
  return { stepUpdates, processOutcome: null, nextStepId: next.id };
}
