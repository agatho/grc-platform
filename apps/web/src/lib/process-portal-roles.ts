// Process-Portal (Endanwender-Sicht): pure role-resolution logic.
//
// Determines which role(s) the logged-in user holds on a published
// process. Three sources feed the resolution:
//   1. Ownership       — process.process_owner_id = user
//   2. Step RACI       — process_step.raci_responsible_role_id /
//                        raci_accountable_role_id reference custom_role(id)
//                        (migration 0332); the user is linked to custom
//                        roles via user_custom_role.
//   3. RACI overrides  — process_raci_override rows written by the
//                        properties panel (B3.1) store the custom_role id
//                        in participant_bpmn_id together with a single
//                        RACI letter (R/A/C/I).
//
// Kept as a pure function so it is unit-testable without DB access and
// shared between the list and detail routes of /api/v1/bpm/my-processes.

export type MyProcessRole = "owner" | "A" | "R" | "C" | "I";

export interface StepRaciAssignment {
  raciResponsibleRoleId: string | null;
  raciAccountableRoleId: string | null;
}

export interface RaciOverrideEntry {
  /** custom_role id stored by the properties panel (B3.1). */
  participantBpmnId: string;
  /** Single RACI letter: R | A | C | I (case-insensitive). */
  raciRole: string;
}

export interface ProcessRoleFacts {
  userId: string;
  processOwnerId: string | null;
  /** custom_role ids assigned to the user (user_custom_role). */
  userCustomRoleIds: readonly string[];
  /** RACI columns of the process steps (only rows with any value needed). */
  stepRaci: readonly StepRaciAssignment[];
  /** Overrides of the current released version. */
  raciOverrides: readonly RaciOverrideEntry[];
}

/** Badge display order: ownership first, then accountability chain. */
const ROLE_ORDER: readonly MyProcessRole[] = ["owner", "A", "R", "C", "I"];

const RACI_LETTERS: ReadonlySet<string> = new Set(["R", "A", "C", "I"]);

/**
 * Resolve the deduplicated, display-ordered role badges of a user on a
 * single process. Returns an empty array when the user holds no role.
 */
export function resolveMyProcessRoles(
  facts: ProcessRoleFacts,
): MyProcessRole[] {
  const roles = new Set<MyProcessRole>();

  if (facts.processOwnerId !== null && facts.processOwnerId === facts.userId) {
    roles.add("owner");
  }

  const myRoleIds = new Set(facts.userCustomRoleIds);
  if (myRoleIds.size > 0) {
    for (const step of facts.stepRaci) {
      if (
        step.raciResponsibleRoleId !== null &&
        myRoleIds.has(step.raciResponsibleRoleId)
      ) {
        roles.add("R");
      }
      if (
        step.raciAccountableRoleId !== null &&
        myRoleIds.has(step.raciAccountableRoleId)
      ) {
        roles.add("A");
      }
    }

    for (const override of facts.raciOverrides) {
      const letter = (override.raciRole ?? "").toUpperCase();
      if (
        myRoleIds.has(override.participantBpmnId) &&
        RACI_LETTERS.has(letter)
      ) {
        roles.add(letter as MyProcessRole);
      }
    }
  }

  return ROLE_ORDER.filter((role) => roles.has(role));
}
