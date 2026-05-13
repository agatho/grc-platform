// RBAC middleware + permission helpers (ADR-007 rev.1, S1-11)
// Three Lines of Defense: 1st (operational), 2nd (oversight), 3rd (assurance)

import type { Session } from "next-auth";
import type { UserRole, LineOfDefense } from "@grc/shared";

// #WAVE13-RBAC-Forbidden-Format: replaces the legacy `{error: "Forbidden"}`
// shape with RFC 7807 problem+json. Kept in this package (no apps/web import)
// so the same shape is reused by route handlers, the worker, and any future
// caller. requestId is threaded in as a third arg by withAuth — when called
// directly from a test or non-HTTP context it defaults to empty string.
const PROBLEM_BASE = "https://arctos.charliehund.de/errors";

function problemResponse(opts: {
  status: number;
  type: string;
  title: string;
  detail: string;
  requestId: string;
}): Response {
  return new Response(
    JSON.stringify({
      type: opts.type,
      title: opts.title,
      status: opts.status,
      detail: opts.detail,
      requestId: opts.requestId,
    }),
    {
      status: opts.status,
      headers: {
        "Content-Type": "application/problem+json; charset=utf-8",
      },
    },
  );
}

function unauthorized(requestId = ""): Response {
  return problemResponse({
    status: 401,
    type: `${PROBLEM_BASE}/unauthorized`,
    title: "Unauthorized",
    detail: "Authentication required",
    requestId,
  });
}

function forbidden(detail: string, requestId = ""): Response {
  return problemResponse({
    status: 403,
    type: `${PROBLEM_BASE}/forbidden`,
    title: "Forbidden",
    detail,
    requestId,
  });
}

/**
 * Check if the session user holds any of the allowed roles in the given org.
 * Returns null if authorized, or a problem+json Response if not.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (
    session: Session | null,
    orgId: string,
    requestId = "",
  ): Response | null => {
    if (!session?.user?.id) return unauthorized(requestId);

    const userRolesInOrg = session.user.roles
      .filter((r) => r.orgId === orgId)
      .map((r) => r.role);

    if (!allowedRoles.some((role) => userRolesInOrg.includes(role))) {
      return forbidden(
        `Required role(s): ${allowedRoles.join(", ")}`,
        requestId,
      );
    }

    return null; // authorized
  };
}

/**
 * Check if the user has a role in the given line of defense for the org.
 */
export function requireLineOfDefense(...allowedLines: LineOfDefense[]) {
  return (
    session: Session | null,
    orgId: string,
    requestId = "",
  ): Response | null => {
    if (!session?.user?.id) return unauthorized(requestId);

    const lines = session.user.roles
      .filter((r) => r.orgId === orgId && r.lineOfDefense)
      .map((r) => r.lineOfDefense!);

    if (!allowedLines.some((line) => lines.includes(line))) {
      return forbidden(
        `Required line(s) of defense: ${allowedLines.join(", ")}`,
        requestId,
      );
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
