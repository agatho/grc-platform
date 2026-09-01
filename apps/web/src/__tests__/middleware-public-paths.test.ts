// #WP3-S02-04 / S12-09 / S12-18 / S02-19 — die Public-Allowlist der Middleware.
//
// Vorher bestand sie aus fünf `startsWith`-Präfixen. Zwei Fehlerklassen:
//
//   S02-04 / S12-09 (High): `"/api/v1/auth/…"` beginnt NICHT mit
//   `"/api/auth"`. Jeder vorauthentifizierte Endpunkt unter `/api/v1/auth`
//   bekam 401, bevor der Handler die Anfrage sah: SSO-Erkennung auf der
//   Login-Seite, Break-Glass-Zugang, SAML- und OIDC-Callback. Ebenso das
//   HinSchG-Meldeportal, die Einladungsannahme, SCIM (Deprovisioning
//   ausgeschiedener Mitarbeiter!), der iCal-Feed und das Branding-CSS.
//
//   S12-18 (Low): `startsWith("/api/v1/whistleblowing/intake")` traf auch das
//   EIGENSTÄNDIGE Verzeichnis `intake-codes`, das `orgCode`, `shortName` und
//   `name` ALLER Organisationen ausgibt. Kein aktiver Bypass (der Handler prüft
//   selbst), aber das nächste `intake*`-Verzeichnis hätte die Ausnahme geerbt.
//
// REIHENFOLGE: Diese Liste darf erst geöffnet werden, NACHDEM S02-23
// (SAML-Digest) und S02-24 (OIDC-Signatur) behoben sind — sonst wird aus einem
// unerreichbaren Endpunkt ein erreichbarer Authentifizierungs-Bypass. Die
// zugehörigen Negativtests liegen in packages/auth/tests/.

import { describe, it, expect } from "vitest";
import { PUBLIC_PATH_TABLE } from "@grc/auth";

const { isPublicPath, isExactOrUnder, PUBLIC_EXACT_PATHS, PUBLIC_PREFIXES } =
  PUBLIC_PATH_TABLE;

describe("S02-04/S12-09 — anonymous business channels are reachable", () => {
  const mustBePublic = [
    // SSO — the IdP posts without a session cookie.
    "/api/v1/auth/sso/saml/callback",
    "/api/v1/auth/sso/saml/login",
    "/api/v1/auth/sso/oidc/callback",
    "/api/v1/auth/sso/oidc/login",
    "/api/v1/auth/sso/config",
    // Break-glass — needed exactly when nobody can get in.
    "/api/v1/auth/admin-login",
    "/admin-login",
    // HinSchG (§§12, 16) — a legal requirement the product advertises.
    "/api/v1/portal/report/ARC-TX",
    "/api/v1/portal/mailbox/abcdef0123456789abcdef0123456789",
    "/report/ARC-TX",
    "/api/v1/whistleblowing/intake",
    "/api/v1/whistleblowing/intake/submit",
    // Vendor due-diligence portal.
    "/api/v1/portal/dd/abcdef0123456789abcdef0123456789",
    "/api/v1/vendors/dd/submit",
    // SCIM — provisioning AND deprovisioning of leavers.
    "/api/v1/scim/v2/Users",
    "/api/v1/scim/v2/Users/abc",
    // Invitation acceptance — the only way to get users into an org.
    "/api/v1/invitations/tok_abcdef/accept",
    // Calendar + branding: clients that send no session cookie.
    "/api/v1/calendar/ical/0123456789abcdef0123456789abcdef",
    "/api/v1/branding/css/aaaaaaaa-0000-0000-0000-000000000001",
    // Health probes — /api/health was missing (S02-19).
    "/api/v1/health",
    "/api/health",
  ];

  for (const p of mustBePublic) {
    it(`allows ${p}`, () => {
      expect(isPublicPath(p)).toBe(true);
    });
  }
});

describe("S12-18 — prefix boundaries", () => {
  const mustNotBePublic = [
    // The sibling directory that inherited the `intake` exception.
    "/api/v1/whistleblowing/intake-codes",
    "/api/v1/whistleblowing/cases",
    // A hypothetical future sibling must not inherit it either.
    "/api/v1/whistleblowing/intake-status",
    "/api/v1/meta-admin",
    "/login-as",
    // Authenticated auth endpoints under the same tree as the public ones.
    "/api/v1/auth/switch-org",
    // The iCal token routes that manage tokens must stay authenticated.
    "/api/v1/calendar/ical/generate-token",
    "/api/v1/calendar/ical/revoke-token",
    // Invitation administration (list/create) is admin-only.
    "/api/v1/invitations",
    "/api/v1/invitations/tok_abcdef",
    // Ordinary business data.
    "/api/v1/risks",
    "/api/v1/users/me",
    "/api/v1/feature-gates",
  ];

  for (const p of mustNotBePublic) {
    it(`blocks ${p}`, () => {
      expect(isPublicPath(p)).toBe(false);
    });
  }

  it("isExactOrUnder requires a separator", () => {
    expect(isExactOrUnder("/a/b", "/a/b")).toBe(true);
    expect(isExactOrUnder("/a/b/c", "/a/b")).toBe(true);
    expect(isExactOrUnder("/a/bc", "/a/b")).toBe(false);
  });
});

describe("allowlist hygiene", () => {
  it("every entry carries a written reason", () => {
    for (const [path, reason] of PUBLIC_EXACT_PATHS) {
      expect(path.startsWith("/")).toBe(true);
      expect(reason.length).toBeGreaterThan(10);
    }
    for (const [prefix, reason] of PUBLIC_PREFIXES) {
      expect(prefix.startsWith("/")).toBe(true);
      expect(prefix.endsWith("/")).toBe(false);
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it("does not open the whole /api/v1/auth tree", () => {
    expect(PUBLIC_PREFIXES.some(([p]) => p === "/api/v1/auth")).toBe(false);
    expect(PUBLIC_PREFIXES.some(([p]) => p === "/api/v1")).toBe(false);
    expect(PUBLIC_PREFIXES.some(([p]) => p === "/api")).toBe(false);
  });
});
