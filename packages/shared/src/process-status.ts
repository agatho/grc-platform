// Sprint 3: Process Status Transition Map
// Defines allowed transitions, role requirements, and comment requirements

import type { ProcessStatus } from "./types";

// ──────────────────────────────────────────────────────────────
// Status Transition Map
// ──────────────────────────────────────────────────────────────

export const PROCESS_STATUS_TRANSITIONS: Record<
  ProcessStatus,
  ProcessStatus[]
> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"], // draft = rejection
  approved: ["published", "in_review"], // in_review = send back
  published: ["archived"],
  archived: [], // terminal state
};

// ──────────────────────────────────────────────────────────────
// Role-based Transition Permissions
// ──────────────────────────────────────────────────────────────

export const PROCESS_TRANSITION_ROLES: Record<string, string[]> = {
  "draft->in_review": ["process_owner", "admin"],
  "in_review->approved": ["auditor", "admin"],
  "in_review->draft": ["auditor", "admin"], // rejection
  "approved->published": ["admin"],
  "approved->in_review": ["auditor", "admin"], // send back
  "published->archived": ["admin"],
};

// ──────────────────────────────────────────────────────────────
// Transitions Requiring Mandatory Comment
// ──────────────────────────────────────────────────────────────

export const TRANSITIONS_REQUIRING_COMMENT = [
  "in_review->approved",
  "in_review->draft",
  "approved->in_review",
];

// ──────────────────────────────────────────────────────────────
// Validation Function
// ──────────────────────────────────────────────────────────────

export function validateStatusTransition(
  currentStatus: ProcessStatus,
  targetStatus: ProcessStatus,
  userRole: string,
  isReviewer: boolean,
): { valid: boolean; error?: string } {
  const allowedTargets = PROCESS_STATUS_TRANSITIONS[currentStatus];
  if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${targetStatus}`,
    };
  }

  const transitionKey = `${currentStatus}->${targetStatus}`;
  const allowedRoles = PROCESS_TRANSITION_ROLES[transitionKey];
  if (!allowedRoles) {
    return {
      valid: false,
      error: `No roles defined for transition ${transitionKey}`,
    };
  }

  // Special case: reviewer can approve/reject even without explicit role
  if (
    isReviewer &&
    (transitionKey === "in_review->approved" ||
      transitionKey === "in_review->draft")
  ) {
    return { valid: true };
  }

  if (!allowedRoles.includes(userRole)) {
    return {
      valid: false,
      error: `Role ${userRole} cannot perform transition ${transitionKey}`,
    };
  }

  return { valid: true };
}
