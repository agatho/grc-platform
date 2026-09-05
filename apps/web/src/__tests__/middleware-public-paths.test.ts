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

// ────────────────────────────────────────────────────────────────────
// [ARCTOS-FULL-2026-08-31 · OP-082] Wächter über die Klasse, nicht über
// den Einzelfall.
//
// OP-082 meldete eine Zeile: `/trust` fehlt. Die Ursache war aber nicht
// eine vergessene Zeile, sondern ein blinder Fleck der Pflege — die
// Allowlist wurde entlang der API-Befunde (S02-04/S12-09) geführt, und die
// Seitenbäume hat niemand danebengelegt. Sieben der elf Seiten ausserhalb
// von `(dashboard)` waren betroffen, darunter das Impressum (§ 5 DDG) und
// die Lieferantenseite, deren URL per E-Mail verschickt wird.
//
// Deshalb steht dieser Block über der DATEILISTE und nicht über Literalen:
// Wer eine neue Seite ausserhalb von `(dashboard)` anlegt, muss sie hier
// eintragen und dabei entscheiden, ob sie anonym erreichbar ist. Vergisst
// er es, wird der Test rot — statt dass die Seite still hinter dem Login
// verschwindet, wo niemand sie sucht.
//
// `(dashboard)` ist ausgenommen und bleibt es: dort ist "angemeldet" die
// Voreinstellung, und eine Aufzählung von 200 Seiten wäre ein Wächter, den
// man beim ersten roten Lauf abschaltet.
// ────────────────────────────────────────────────────────────────────

import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..", "app");

/** Alle `page.tsx` unterhalb von `src/app`, ohne den `(dashboard)`-Baum. */
function discoverPageFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "(dashboard)" || entry.name === "api") continue;
      discoverPageFiles(full, acc);
    } else if (entry.name === "page.tsx") {
      acc.push(relative(APP_DIR, full));
    }
  }
  return acc;
}

/**
 * Dateipfad → Routenmuster. Routengruppen `(x)` erscheinen nicht in der URL;
 * dynamische Segmente werden zu `:name`, damit die Tabelle unabhängig vom
 * Beispielwert lesbar bleibt.
 */
function routeOf(pageFile: string): string {
  const segments = pageFile
    .split(sep)
    .slice(0, -1)
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")))
    .map((s) => (s.startsWith("[") ? ":" + s.replace(/[[\].]/g, "") : s));
  return "/" + segments.join("/");
}

/**
 * Die Entscheidung je Seite. `anonymous: true` heisst: ein Besucher ohne
 * Sitzung muss die Seite bekommen. `false` heisst: die Weiterleitung auf
 * `/login` ist gewollt. Jede Zeile trägt ihren Grund — dieselbe Regel, die
 * die Allowlist selbst befolgt.
 */
const PAGE_VERDICTS: ReadonlyArray<
  readonly [route: string, anonymous: boolean, reason: string]
> = [
  ["/login", true, "Anmeldeseite — per Definition vorauthentifiziert"],
  ["/admin-login", true, "Break-Glass-Anmeldung (S12-09)"],
  ["/report/:orgCode", true, "HinSchG § 16 Meldeportal"],
  ["/report/mailbox/:token", true, "HinSchG anonymer Briefkasten"],
  [
    "/trust/:orgCode",
    true,
    "OP-082 — öffentliches Trust Center, Voraussetzung S12-05 B ist erfüllt",
  ],
  [
    "/dd/:token",
    true,
    "OP-082 — Lieferantenportal; die Einladungsmail verschickt genau diese URL",
  ],
  ["/dd/:token/complete", true, "OP-082 — Abschluss desselben Vorgangs"],
  [
    "/dd/expired",
    true,
    "OP-082 — Ziel der Weiterleitung bei abgelaufenem Token",
  ],
  [
    "/invite/:token",
    true,
    "OP-082 — der Eingeladene hat noch kein Konto zum Anmelden",
  ],
  ["/legal/imprint", true, "OP-082 — § 5 DDG, muss ohne Anmeldung erreichbar"],
  ["/legal/privacy", true, "OP-082 — Art. 13 DSGVO, dito"],
];

describe("OP-082 — jede Seite ausserhalb von (dashboard) hat eine Entscheidung", () => {
  const discovered = discoverPageFiles(APP_DIR).map(routeOf).sort();
  const declared = PAGE_VERDICTS.map(([r]) => r).sort();

  it("die Tabelle deckt genau die vorhandenen Seiten ab", () => {
    // Beide Richtungen: eine neue Seite ohne Eintrag ist der Fall, den
    // OP-082 gezeigt hat; ein Eintrag ohne Seite ist eine Allowlist, die
    // auf einen gelöschten Pfad zeigt (`/portal` war so einer).
    expect(discovered).toEqual(declared);
  });

  for (const [route, anonymous, reason] of PAGE_VERDICTS) {
    const sample = route.replace(/:[^/]+/g, "SAMPLE-TOKEN");
    it(`${route} ist ${anonymous ? "anonym erreichbar" : "angemeldet"} — ${reason}`, () => {
      expect(isPublicPath(sample)).toBe(anonymous);
    });
  }
});
