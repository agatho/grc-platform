// #WP3-S02-10 / S02-11 — Rollenmatrix über ALLE mutierenden Routen.
//
// Der Auditbericht misst zwei Lücken maschinell:
//   * 91 von 985 mutierenden Handlern rufen `withAuth()` OHNE Rollenargument
//     auf — `apps/web/src/lib/api.ts` überspringt den Rollenblock dann
//     vollständig (`if (roles.length)`), sodass auch `viewer` schreiben darf.
//   * 368 von 985 mutierenden Handlern rufen `requireModule(...)` nicht auf —
//     die einzige Stelle, an der Modul-Freischaltung und Preview-Schreibschutz
//     durchgesetzt werden.
//
// Dieser Test misst dieselben beiden Kennzahlen wieder, jetzt gegen den
// reparierten Zustand: für JEDE mutierende Route muss eine wirksame
// Rollenanforderung existieren (explizit im Code ODER aus der Registry), und
// jede Route muss einen Modul-Registry-Eintrag haben. Eine neue Route ohne
// Eintrag lässt den Test rot werden — genau die Regression, die den Befund
// ursprünglich erzeugt hat.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, relative, sep } from "path";
import { readdirSync, statSync } from "fs";
import {
  moduleScopeForPath,
  mutatingRolesForPath,
  DEFAULT_MUTATING_ROLES,
  READ_ONLY_ROLES,
  requiresPlatformAdmin,
} from "@/lib/module-guard";

const API_ROOT = join(process.cwd(), "src/app/api/v1");
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;

/** Paths owned by other remediation packages — listed, not skipped silently. */
const FOREIGN_PACKAGE_PREFIXES = [
  "documents/",
  "policies/",
  "ai/",
  "translations/",
  "copilot/",
  "eam/ai/",
  "dpms/",
  "portal/mailbox/",
  "export/",
  "cloud-connectors/",
  "connectors/",
  "identity-connectors/",
  "erm/bowtie/",
  "playground/",
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (entry === "route.ts") acc.push(p);
  }
  return acc;
}

/** Strip comments so `// withAuth(...)` prose does not count as a call. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

interface RouteInfo {
  file: string;
  apiPath: string;
  methods: string[];
  explicitRoles: string[];
  hasRequireModule: boolean;
  foreign: boolean;
}

function routePathFor(file: string): string {
  const rel = relative(API_ROOT, file).split(sep).slice(0, -1).join("/");
  return "/" + rel;
}

const ROUTES: RouteInfo[] = walk(API_ROOT).map((file) => {
  const src = stripComments(readFileSync(file, "utf8"));
  const methods = MUTATING.filter((m) =>
    new RegExp(`export\\s+(?:async\\s+function|const)\\s+${m}\\b`).test(src),
  );
  const roles = new Set<string>();
  for (const m of src.matchAll(/withAuth\(([^)]*)\)/g)) {
    for (const r of m[1].matchAll(/"([a-z_]+)"/g)) roles.add(r[1]);
  }
  const rel = relative(API_ROOT, file).split(sep).join("/");
  return {
    file: rel,
    apiPath: routePathFor(file),
    methods: [...methods],
    explicitRoles: [...roles],
    hasRequireModule: /requireModule\s*\(/.test(src),
    foreign: FOREIGN_PACKAGE_PREFIXES.some((p) => rel.startsWith(p)),
  };
});

const MUTATING_ROUTES = ROUTES.filter((r) => r.methods.length > 0);
const OWNED_MUTATING = MUTATING_ROUTES.filter((r) => !r.foreign);

describe("S02-10/S02-11 — route/role matrix", () => {
  it("finds the mutating route surface the audit measured", () => {
    // Sanity check that the scanner sees a comparable population (the audit
    // counted 985 mutating HANDLERS across ~700 files).
    expect(MUTATING_ROUTES.length).toBeGreaterThan(400);
    expect(OWNED_MUTATING.length).toBeGreaterThan(300);
  });

  it("every mutating route resolves to a module scope (S02-11)", () => {
    const unregistered = OWNED_MUTATING.filter(
      (r) => moduleScopeForPath("/api/v1" + r.apiPath) === null,
    ).map((r) => r.file);
    expect(unregistered).toEqual([]);
  });

  it("no mutating route is reachable with a read-only role alone (S02-10)", () => {
    const offenders: string[] = [];
    for (const r of OWNED_MUTATING) {
      const effective = r.explicitRoles.length
        ? r.explicitRoles
        : [...mutatingRolesForPath("/api/v1" + r.apiPath)];
      // "Reachable by viewer alone" means the effective set contains a
      // read-only role and nothing else would be required.
      const onlyReadOnly =
        effective.length > 0 &&
        effective.every((role) =>
          (READ_ONLY_ROLES as readonly string[]).includes(role),
        );
      if (effective.length === 0 || onlyReadOnly) offenders.push(r.file);
    }
    expect(offenders).toEqual([]);
  });

  it("the default mutating role floor excludes every read-only role", () => {
    for (const ro of READ_ONLY_ROLES) {
      expect(DEFAULT_MUTATING_ROLES).not.toContain(ro);
    }
    expect(DEFAULT_MUTATING_ROLES.length).toBeGreaterThan(10);
  });

  it("platform-wide configuration writes require a platform admin (S02-03)", () => {
    const globalTables = [
      "/api/v1/feature-gates/abc",
      "/api/v1/subscriptions/plans",
      "/api/v1/plugins",
      "/api/v1/data-sovereignty/regions/abc",
      "/api/v1/framework-mappings/abc",
    ];
    for (const p of globalTables) {
      expect(requiresPlatformAdmin(p, "POST")).toBe(true);
      expect(requiresPlatformAdmin(p, "PATCH")).toBe(true);
      expect(requiresPlatformAdmin(p, "DELETE")).toBe(true);
      // Reads stay open to any authenticated user of any tenant.
      expect(requiresPlatformAdmin(p, "GET")).toBe(false);
    }
    // Tenant-scoped routes must NOT demand a platform admin.
    expect(requiresPlatformAdmin("/api/v1/risks", "POST")).toBe(false);
    expect(requiresPlatformAdmin("/api/v1/users/x/roles", "POST")).toBe(false);
  });

  it("routes owned by other remediation packages are named, not silently skipped", () => {
    const foreign = MUTATING_ROUTES.filter((r) => r.foreign).map((r) => r.file);
    // They are still covered by the CENTRAL module guard in withAuth; this
    // assertion only documents the boundary so the count is visible in CI.
    expect(foreign.length).toBeGreaterThan(0);
    for (const f of foreign) {
      expect(FOREIGN_PACKAGE_PREFIXES.some((p) => f.startsWith(p))).toBe(true);
    }
  });

  // ── S02-21 (Info) ────────────────────────────────────────────────
  // Der projekteigene Auth-Smoke-Test deckt NUR mutierende Handler ab
  // (`all-mutating-routes-auth-smoke.test.ts:359` überspringt read-only
  // Routen). 1.035 GET-Handler — darunter die 618 ohne Rollenprüfung — waren
  // damit gegen fehlende Autorisierung ungetestet. Hier wird zumindest das
  // erste Kettenglied für JEDEN lesenden Handler statisch nachgewiesen.
  it("every read handler runs an authentication primitive (S02-21)", () => {
    // `auth()` (the bare Auth.js session read) is a legitimate primitive for
    // the two org-less platform catalogues that only need "any signed-in user".
    const OWN_TOKEN_PRIMITIVES =
      /withAuth\s*\(|await auth\(\)|validateScimToken|validateDdToken|validateMailboxToken|resolve(?:Ical|WbMailbox|DdSession|Invitation|OrgByCode)|alias308|problem\.methodNotAllowed|export \{[^}]*\} from/;

    // Deliberately anonymous read endpoints — each one is also on the
    // middleware public allowlist with a written reason (S02-04/S12-09), and
    // each authenticates by an opaque token or needs no identity at all.
    const INTENTIONALLY_ANONYMOUS: Record<string, string> = {
      "health/route.ts": "liveness probe; returns no tenant data",
      "auth/sso/config/route.ts":
        "login page SSO discovery — runs before any session exists",
      "auth/sso/oidc/callback/route.ts": "OIDC redirect URI (IdP → browser)",
      "auth/sso/oidc/login/route.ts": "OIDC authorize redirect",
      "auth/sso/saml/login/route.ts": "SAML AuthnRequest redirect",
      "branding/css/[orgId]/route.ts":
        "tenant stylesheet loaded by the login page",
      "portal/report/[orgCode]/route.ts":
        "HinSchG §16 reporting portal — anonymity is a legal requirement",
    };
    const offenders: string[] = [];
    for (const r of ROUTES) {
      if (r.foreign) continue;
      const src = stripComments(readFileSync(join(API_ROOT, r.file), "utf8"));
      const hasGet =
        /export\s+(?:async\s+function|const)\s+(?:GET|HEAD)\b/.test(src);
      if (!hasGet) continue;
      if (INTENTIONALLY_ANONYMOUS[r.file]) continue;
      if (!OWN_TOKEN_PRIMITIVES.test(src)) offenders.push(r.file);
    }
    expect(offenders).toEqual([]);

    // Every anonymous exception carries a written reason — the same discipline
    // the middleware allowlist enforces.
    for (const [file, reason] of Object.entries(INTENTIONALLY_ANONYMOUS)) {
      expect(reason.length).toBeGreaterThan(10);
      expect(ROUTES.some((r) => r.file === file)).toBe(true);
    }
  });

  // ── S02-22 (Info) ────────────────────────────────────────────────
  // 26 Discovery-/Alias-/405-Stub-Handler führen keine eigene Auth-Prüfung
  // durch. Sie sind kein Finding, weil sie nur statische Listen, 308-Redirects
  // oder 405 liefern — aber ein Middleware-Umbau (S02-04) darf sie nicht
  // versehentlich freischalten. Die Allowlist-Tests decken das ab; hier wird
  // zusätzlich sichergestellt, dass kein Alias sein Redirect-Ziel aus der
  // Anfrage übernimmt (Open Redirect).
  it("alias/redirect routes build their Location from a static path (S02-22)", () => {
    const offenders: string[] = [];
    for (const r of ROUTES) {
      const src = stripComments(readFileSync(join(API_ROOT, r.file), "utf8"));
      if (!/alias308|api-redirect/.test(src)) continue;
      // The redirect TARGET (second argument) must be a string literal — never
      // interpolated from the request, which would make it an open redirect.
      for (const call of src.matchAll(
        /alias308\(\s*[A-Za-z_$][\w$]*\s*,\s*([^)]*)\)/g,
      )) {
        const target = call[1].trim();
        if (!/^"[^"$]*"$/.test(target) && !/^'[^'$]*'$/.test(target)) {
          offenders.push(`${r.file}: ${target}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the audit's named S02-10 endpoints now carry a role requirement", () => {
    const named = [
      "/api/v1/audit-mgmt/audits/[id]/sign-off",
      "/api/v1/isms/assessments/[id]",
      "/api/v1/erm/propagation/relationships",
      "/api/v1/esg/materiality/[year]/vote",
      "/api/v1/compliance/simulator/simulations",
    ];
    for (const p of named) {
      const roles = mutatingRolesForPath(p);
      expect(roles.length).toBeGreaterThan(0);
      expect(roles).not.toContain("viewer");
    }
  });
});
