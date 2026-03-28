// Sprint 54: Evaluation Phase Transition Engine
// Validates and enforces 5-step evaluation workflow transitions

export interface PhaseTransitionRule {
  from: string;
  to: string;
  requiredFields: string[];
  requiredRole?: string;
}

export interface PhaseTransitionResult {
  valid: boolean;
  missingFields: string[];
}

const PHASE_TRANSITIONS: PhaseTransitionRule[] = [
  {
    from: "assignment",
    to: "gross_evaluation",
    requiredFields: ["owner_id", "risk_category"],
  },
  {
    from: "gross_evaluation",
    to: "net_evaluation",
    requiredFields: ["inherent_likelihood", "inherent_impact"],
  },
  {
    from: "net_evaluation",
    to: "approval",
    requiredFields: ["residual_likelihood", "residual_impact"],
  },
  {
    from: "approval",
    to: "active",
    requiredFields: [],
    requiredRole: "risk_manager",
  },
  {
    from: "approval",
    to: "net_evaluation",
    requiredFields: [],
  },
];

const PHASE_ORDER: Record<string, number> = {
  assignment: 0,
  gross_evaluation: 1,
  net_evaluation: 2,
  approval: 3,
  active: 4,
};

/**
 * Validate whether a phase transition is allowed.
 */
export function validatePhaseTransition(
  currentPhase: string,
  targetPhase: string,
  riskData: Record<string, unknown>,
  userRole: string,
): PhaseTransitionResult {
  const rule = PHASE_TRANSITIONS.find(
    (r) => r.from === currentPhase && r.to === targetPhase,
  );

  if (!rule) {
    return {
      valid: false,
      missingFields: [`Invalid transition from '${currentPhase}' to '${targetPhase}'`],
    };
  }

  if (rule.requiredRole && userRole !== rule.requiredRole && userRole !== "admin") {
    return {
      valid: false,
      missingFields: [`Requires role: ${rule.requiredRole}`],
    };
  }

  const missing = rule.requiredFields.filter(
    (f) => riskData[f] === null || riskData[f] === undefined || riskData[f] === "",
  );

  return {
    valid: missing.length === 0,
    missingFields: missing,
  };
}

/**
 * Get the ordered index of a phase (0-4).
 */
export function getPhaseIndex(phase: string): number {
  return PHASE_ORDER[phase] ?? -1;
}

/**
 * Check if a phase has been completed (i.e., current phase is past it).
 */
export function isPhaseCompleted(currentPhase: string, checkPhase: string): boolean {
  return getPhaseIndex(currentPhase) > getPhaseIndex(checkPhase);
}

/**
 * Get all valid target phases from the current phase.
 */
export function getValidTransitions(currentPhase: string): string[] {
  return PHASE_TRANSITIONS
    .filter((r) => r.from === currentPhase)
    .map((r) => r.to);
}

/**
 * Get all phases as an ordered list for the progress bar.
 */
export function getAllPhases(): string[] {
  return ["assignment", "gross_evaluation", "net_evaluation", "approval", "active"];
}
