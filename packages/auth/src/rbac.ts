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

// ════════════════════════════════════════════════════════════════════
// HinSchG-Isolation (#WAVE13-RBAC-03, verschärft durch WP3/S12-17)
// ════════════════════════════════════════════════════════════════════
//
// Nutzer, deren EINZIGE Rollen `whistleblowing_officer` und/oder
// `ombudsperson` sind, bleiben auf das Whistleblowing-Modul beschränkt
// (§§ 16, 32 HinSchG — Vertraulichkeit der Meldung).
//
// #WP3-S12-17: Das Gatter stand ausschließlich in der Edge-Middleware und
// bewertete die JWT-Kopie der Rollen, die bis zu 8 Stunden alt sein konnte.
// Wurde einem Nutzer die zweite Rolle (z. B. `admin`) entzogen, GERADE DAMIT
// die Isolation greift, lief er bis zum Tokenablauf weiter uneingeschränkt.
// Die Prädikate leben deshalb jetzt hier — edge-sicher, ohne DB-Import — und
// werden ZWEIMAL ausgewertet: in der Middleware (JWT-Kopie, deckt UI-Pfade und
// Modul-Discovery ab) und in `withAuth` (frisch aus der DB gelesene Rollen,
// deckt jede API-Autorisierung ab).

export const HINSCHG_ISOLATED_ROLES: ReadonlySet<string> = new Set([
  "whistleblowing_officer",
  "ombudsperson",
]);

/** True when the user's ONLY roles are HinSchG officer roles. */
export function isHinSchgIsolated(
  roles: ReadonlyArray<{ role: string }>,
): boolean {
  return (
    roles.length > 0 && roles.every((r) => HINSCHG_ISOLATED_ROLES.has(r.role))
  );
}

function isExactOrUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** Paths a HinSchG-isolated user may reach. Anything else → 403. */
export function isHinSchgAllowedPath(pathname: string): boolean {
  return (
    isExactOrUnder(pathname, "/api/v1/whistleblowing") ||
    isExactOrUnder(pathname, "/whistleblowing") ||
    pathname === "/api/v1/users/me" ||
    isExactOrUnder(pathname, "/api/v1/notifications") ||
    isExactOrUnder(pathname, "/api/auth") ||
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname === "/" ||
    isExactOrUnder(pathname, "/api/v1/health")
  );
}

// ════════════════════════════════════════════════════════════════════
// Public-Path-Allowlist der Edge-Middleware (#WP3-S02-04/S12-09/S12-18)
// ════════════════════════════════════════════════════════════════════
//
// Liegt hier statt in `apps/web/src/middleware.ts`, weil die Middleware
// NextAuth initialisiert und deshalb in einem Unit-Test nicht importierbar
// ist — eine Allowlist, die man nicht testen kann, ist genau die Kontrolle,
// die unbemerkt driftet (S12-18). Edge-sicher: keine DB-Importe.

/**
 * #WP3-S12-18 — prefix matching with an explicit boundary.
 *
 * `pathname.startsWith("/api/v1/whistleblowing/intake")` also matched the
 * SEPARATE route `/api/v1/whistleblowing/intake-codes`, which lists `orgCode`,
 * `shortName` and `name` for EVERY organization. That route happened to run its
 * own `withAuth()` and answered 401, so it was not an active bypass — but the
 * next directory created under `intake*` (`intake-status/`, `intake-v2/`)
 * would inherit the public exception without anyone touching the middleware.
 * The same shape affected `/api/v1/meta` and `/login`.
 */
export function isPublicExactOrUnder(
  pathname: string,
  prefix: string,
): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * #WP3-S02-04 / S12-09 — the anonymous business channels.
 *
 * The public allowlist covered five prefixes; `"/api/v1/auth/…"` does NOT start
 * with `"/api/auth"`, so every pre-authentication endpoint under `/api/v1/auth`
 * was answered with 401 by the middleware before the handler ever saw the
 * request. Consequences the audit reproduced:
 *   * the HinSchG reporting portal (a legal requirement the product advertises)
 *     redirected whistleblowers to `/login`;
 *   * the SAML/OIDC ACS endpoints answered 401 to the IdP — enterprise SSO
 *     could not be commissioned at all;
 *   * the break-glass admin login — the one path meant for "SSO is down /
 *     nobody can get in" — required an existing session;
 *   * SCIM provisioning AND deprovisioning of leavers failed with 401.
 *
 * ORDER MATTERS (REMEDIATION_PLAN §1.3): this list may only be opened AFTER
 * S02-23 (SAML digest verification) and S02-24 (OIDC signature verification)
 * are fixed. Before that, allowlisting the SAML ACS turns an unreachable
 * endpoint into a reachable authentication bypass. Both are fixed in
 * `packages/auth/src/saml/response-validator.ts` and
 * `packages/auth/src/oidc/id-token-validator.ts`; the negative tests live in
 * `packages/auth/tests/saml-signature.test.ts` and
 * `packages/auth/tests/oidc-signature.test.ts`.
 *
 * Every entry is an EXACT path or an exact prefix with a trailing separator
 * (S12-18), and every entry carries the reason it is anonymous.
 */
const PUBLIC_EXACT_PATHS: ReadonlyArray<readonly [string, string]> = [
  // Liveness/readiness probes. `/api/health` was NOT allowlisted (S02-19) —
  // an operator wiring the obvious route into a k8s probe or uptime monitor
  // got a permanently "unhealthy" service.
  ["/api/v1/health", "liveness/readiness probe; returns no data"],
  ["/api/health", "second liveness probe route (S02-19)"],
  // The login page must know whether the org enforces SSO before anyone is
  // authenticated (S12-09, effect 1).
  ["/api/v1/auth/sso/config", "login page SSO discovery"],
  // Break-glass admin login (S12-09, effect 2) — the path that exists precisely
  // for "SSO is down / nobody can get in".
  ["/api/v1/auth/admin-login", "break-glass admin login"],
  ["/admin-login", "break-glass admin login UI"],
  ["/api/v1/vendors/dd/submit", "vendor due-diligence submission"],
  ["/api/v1/whistleblowing/intake", "HinSchG §16 tip-channel schema discovery"],
  [
    "/api/v1/whistleblowing/intake/submit",
    "HinSchG §16 anonymous tip submission; requiring a session would be a legal-compliance defect",
  ],
];

const PUBLIC_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["/login", "login page (pre-authentication)"],
  ["/api/auth", "Auth.js own endpoints (CSRF, callback, session)"],
  [
    "/api/v1/meta",
    "build/deploy diagnostics — build-time strings only, no DB access",
  ],
  [
    "/api/v1/portal",
    "external portals: HinSchG reporting + anonymous mailbox, vendor DD. The opaque path token is the credential.",
  ],
  ["/report", "HinSchG reporting portal UI"],
  ["/portal", "external portal UI (vendor DD, whistleblower mailbox)"],
  [
    "/api/v1/auth/sso/saml",
    "SAML AuthnRequest + ACS; the IdP POSTs without a session cookie. The signature AND the reference digest are verified in packages/auth/src/saml/response-validator.ts (S02-23).",
  ],
  [
    "/api/v1/auth/sso/oidc",
    "OIDC authorize redirect + callback; the ID token is verified against the provider JWKS in packages/auth/src/oidc/id-token-validator.ts (S02-24).",
  ],
  [
    "/api/v1/scim/v2",
    "SCIM 2.0 provisioning; validates its own Bearer token (packages/auth/src/scim/token-auth.ts)",
  ],

  // [ARCTOS-FULL-2026-08-31 · OP-082] Die Liste wurde entlang der API-Befunde
  // (S02-04/S12-09) gepflegt; die SEITENBÄUME hat niemand danebengelegt.
  // Deshalb fielen genau die Seiten durch, deren URL jemand von aussen
  // bekommt — per E-Mail, per Aushang, per Gesetz —, während der zugehörige
  // API-Kanal darunter längst offen war. Der Wächter dagegen steht jetzt über
  // der Dateiliste `apps/web/src/app/**/page.tsx` statt über einer Handvoll
  // Literale: eine neue Portalseite ohne Eintrag wird rot, statt still hinter
  // dem Login zu verschwinden.
  [
    "/trust",
    "Trust Center — public per-org compliance status page; reads only publicly classified fields, scoped through withOrgReadContext (S12-05 defect B)",
  ],
  [
    "/dd",
    "vendor due-diligence portal UI. The invitation mail sends exactly this URL (api/v1/vendors/[id]/dd/invite: `${portalBaseUrl}/dd/${accessToken}`); the opaque token is the credential and is checked by /api/v1/portal/dd, which is already public.",
  ],
  [
    "/invite",
    "invitation acceptance UI; it calls the already-public /api/v1/invitations/{token}/accept. The invitee by definition has no account yet to log in with.",
  ],
  [
    "/legal",
    "imprint (§ 5 DDG) and privacy notice (Art. 13 GDPR) must be reachable without a login; the footer link sits on EVERY page including the login page (components/layout/legal-footer.tsx).",
  ],
];

/**
 * Dynamic-segment routes. Deliberately anchored regexes rather than prefixes:
 * `/api/v1/invitations` also serves the ADMIN invitation list/create, and
 * `/api/v1/calendar/ical` also serves `generate-token`/`revoke-token`. A prefix
 * entry would have opened those too.
 */
const PUBLIC_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /^\/api\/v1\/invitations\/[^/]+\/accept$/,
    "invitation acceptance; the single-use path token is the credential",
  ],
  [
    /^\/api\/v1\/calendar\/ical\/(?!generate-token$|revoke-token$)[^/]+$/,
    "iCal feed; calendar clients send no session cookie, the feed token is the credential",
  ],
  [
    /^\/api\/v1\/branding\/css\/[^/]+$/,
    "tenant branding stylesheet, loaded by the login page before authentication",
  ],
];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.some(([p]) => p === pathname)) return true;
  if (
    PUBLIC_PREFIXES.some(([prefix]) => isPublicExactOrUnder(pathname, prefix))
  )
    return true;
  return PUBLIC_PATTERNS.some(([re]) => re.test(pathname));
}

/** Exported for the middleware allowlist test. */
export const PUBLIC_PATH_TABLE = {
  PUBLIC_EXACT_PATHS,
  PUBLIC_PREFIXES,
  PUBLIC_PATTERNS,
  isPublicPath,
  isExactOrUnder: isPublicExactOrUnder,
};
