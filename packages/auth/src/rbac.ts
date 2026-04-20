// RBAC middleware + permission helpers (ADR-007 rev.1, S1-11)
// Three Lines of Defense: 1st (operational), 2nd (oversight), 3rd (assurance)

import type { Session } from "next-auth";
import type { UserRole, LineOfDefense } from "@grc/shared";

/**
 * Check if the session user holds any of the allowed roles in the given org.
 * Returns null if authorized, or a Response if not.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (session: Session | null, orgId: string): Response | null => {
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userRolesInOrg = session.user.roles
      .filter((r) => r.orgId === orgId)
      .map((r) => r.role);

    if (!allowedRoles.some((role) => userRolesInOrg.includes(role))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return null; // authorized
  };
}

/**
 * Check if the user has a role in the given line of defense for the org.
 */
export function requireLineOfDefense(...allowedLines: LineOfDefense[]) {
  return (session: Session | null, orgId: string): Response | null => {
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const lines = session.user.roles
      .filter((r) => r.orgId === orgId && r.lineOfDefense)
      .map((r) => r.lineOfDefense!);

    if (!allowedLines.some((line) => lines.includes(line))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return null;
  };
}

/**
 * Get all roles for a user in a specific org from their session.
 */
export function getRolesInOrg(
  session: Session | null,
  orgId: string,
): UserRole[] {
  if (!session?.user?.roles) return [];
  return session.user.roles.filter((r) => r.orgId === orgId).map((r) => r.role);
}

/**
 * Get all org IDs where the user has at least one role.
 */
export function getAccessibleOrgIds(session: Session | null): string[] {
  if (!session?.user?.roles) return [];
  return [...new Set(session.user.roles.map((r) => r.orgId))];
}
