// B2 (Release-Cycle): pure chain logic for multi-stage process approval
// steps (process_approval_step). Kept framework-free so the API routes
// and unit tests share the exact same semantics.

export type ApprovalStepType = "review" | "approval" | "acknowledgment";

export type ApprovalStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "rejected"
  | "skipped";

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
 * A user may decide a step when they are the assigned user, hold the
 * assigned role, or are org admin.
 */
export function canDecideApprovalStep(
  step: Pick<ApprovalStepLike, "assigneeUserId" | "assigneeRole">,
  actor: { userId: string; roles: string[] },
): boolean {
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
