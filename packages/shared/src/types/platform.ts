// Platform core types (Sprint 1)
export type OrgType = "subsidiary" | "holding" | "joint_venture" | "branch";
/**
 * #WP3-S02-14 — DIE Quelle der Wahrheit für das Rollenmodell.
 *
 * Befund: das Rollenmodell war dreifach inkonsistent —
 *   * DB-Enum `user_role`      9 Werte
 *   * TypeScript-Union        20 Werte
 *   * `withAuth(...)`-Guards   17 Werte, davon 8 nicht im Enum
 * 113 Guard-Slots über 79 Routendateien waren damit nicht zuweisbar
 * (`POST /users/{id}/roles` mit `{"role":"ciso"}` → 22P02). Least Privilege war
 * nicht umsetzbar: wer z. B. ISMS-Freigaben brauchte, musste `admin` bekommen —
 * was die Wirkung von S02-02 und S02-03 verstärkte.
 *
 * Ab jetzt gilt: dieses Array ist die einzige Deklaration. Der TS-Typ leitet
 * sich daraus ab, die Migration `0410_user_role_enum_single_source.sql`
 * spiegelt es idempotent in das DB-Enum, und
 * `packages/shared/tests/role-model-consistency.test.ts` vergleicht TS-Liste,
 * DB-Enum und die tatsächliche Guard-Verwendung im Routenbaum. Drift lässt den
 * Test rot werden — genau der Zustand, der hier unbemerkt blieb.
 *
 * Reihenfolge = `enumsortorder` des DB-Enums.
 */
export const USER_ROLES = [
  "admin",
  "risk_manager",
  "control_owner",
  "auditor",
  "dpo",
  "process_owner",
  "viewer",
  "whistleblowing_officer",
  "compliance_officer",
  "ciso",
  "bcm_manager",
  "contract_manager",
  // S06-12: bis 0410 toter Code, weil der Enum-Wert fehlte.
  "quality_manager",
  "security_analyst",
  "department_head",
  "external_auditor",
  "esg_manager",
  "esg_contributor",
  // S07-22: fehlte im Enum, obwohl die HinSchG-Isolation der Middleware
  // ausdrücklich darauf prüft.
  "ombudsperson",
  // #WAVE19-MAR-P0-02: vendor_manager is the procurement-side counterpart to
  // contract_manager.
  "vendor_manager",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Laufzeit-Prüfung (Requests, SCIM, SSO-Gruppenmapping, Invitations). */
export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

export const LINES_OF_DEFENSE = ["first", "second", "third"] as const;
export type LineOfDefense = (typeof LINES_OF_DEFENSE)[number];

export interface Organization {
  id: string;
  name: string;
  shortName?: string;
  type: OrgType;
  country: string;
  isEu: boolean;
  parentOrgId?: string;
  hierarchyLevel?: number;
  hierarchyPath?: string;
}

export interface UserWithRoles {
  id: string;
  email: string;
  name: string;
  roles: { orgId: string; role: UserRole; lineOfDefense?: LineOfDefense }[];
}

export type TaskStatus =
  "open" | "in_progress" | "done" | "overdue" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  dueDate?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  createdAt: string;
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: UserRole;
  lineOfDefense?: LineOfDefense;
  token: string;
  status: InvitationStatus;
  invitedBy?: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}
