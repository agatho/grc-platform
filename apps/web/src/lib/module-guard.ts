// #WP3-S02-11 / S02-10 — Zentrale Modul- und Rollenregistrierung für alle
// API-Routen unter /api/v1.
//
// Befund S02-11 (Medium): von 985 mutierenden Handlern riefen 368 kein
// `requireModule(...)` auf. `requireModule` ist die EINZIGE Stelle, an der
// Modul-Freischaltung (`disabled`/`maintenance` → 404) und der
// Preview-Schreibschutz (`preview` + non-GET → 403) durchgesetzt werden. Eine
// Organisation, für die ein Modul abgeschaltet ist, konnte über die
// ungeschützten Routen weiterhin schreiben.
//
// Befund S02-10 (Medium): 91 mutierende Handler rufen `withAuth()` ganz ohne
// Rollenargument auf — `apps/web/src/lib/api.ts` überspringt den Rollenblock
// dann vollständig (`if (roles.length)`), sodass auch `viewer` schreiben darf.
//
// Warum eine Registry statt 368 Einzeleinfügungen:
//   * Eine Kontrolle, die in jeder neuen Routendatei erneut von Hand gesetzt
//     werden muss, ist genau die Kontrolle, die wieder vergessen wird — der
//     Befund selbst ist der Beleg dafür.
//   * `withAuth()` wertet die Registry zentral aus. Jede Route erbt damit den
//     Modulguard und eine Rollenuntergrenze, ohne dass 368 Dateien angefasst
//     werden. Routen, die `requireModule` bereits selbst aufrufen, behalten
//     ihren Aufruf — der zusätzliche Check ist idempotent und gecacht.
//   * `apps/web/src/__tests__/api/route-role-matrix.test.ts` prüft, dass JEDE
//     mutierende Route einen Registry-Eintrag hat und dass keine mutierende
//     Route allein mit `viewer` erreichbar ist. Eine neue Route ohne Eintrag
//     lässt den Test rot werden.
//
// Die Modulzuordnung ist aus der tatsächlich beobachteten
// `requireModule(...)`-Verwendung der 617 bereits abgesicherten Handler
// abgeleitet (Audit-Artefakt `S02-routes-matrix.csv`), damit zentrale und
// lokale Prüfung nie widersprüchliche Modulschlüssel verwenden.
//
// "platform" bedeutet: die Route gehört zu KEINEM lizenzierbaren Fachmodul
// (Nutzer-, Organisations-, Auth-, Abrechnungs- und Betriebsverwaltung). Für
// diese Routen gibt es bewusst keinen Modulguard; die Rollenprüfung bleibt.

import type { ModuleKey } from "@grc/shared";
import { requireModule } from "@grc/auth";

export type RouteModuleScope = ModuleKey | "platform";

/**
 * Prefix → Modul. Längster Präfix gewinnt (die Liste ist danach sortiert).
 * Pfade ohne `/api/v1`-Präfix; dynamische Segmente stehen als `[id]`.
 */
export const ROUTE_MODULE_REGISTRY: ReadonlyArray<
  readonly [string, RouteModuleScope]
> = [
  ["/findings/[id]/status", "ics"],
  ["/findings/[id]/sync-treatment", "erm"],
  ["/findings/[id]/transitions", "ics"],
  ["/organizations/[id]/bpmn-validation-config", "bpm"],
  ["/organizations/[id]/risk-appetite", "erm"],
  ["/organizations/[id]/risk-methodology", "erm"],
  ["/ai/draft-policy", "dms"],
  ["/ai/explain-gap", "isms"],
  ["/ai/suggest-controls", "erm"],
  ["/compliance/calendar", "reporting"],
  ["/compliance/coverage", "ics"],
  ["/compliance/score", "ics"],
  ["/compliance/simulator", "ics"],
  ["/cross/executive-dashboard", "isms"],
  ["/cross/findings", "isms"],
  ["/cross/risk-sync", "erm"],
  ["/dashboard/audit-kpis", "audit"],
  ["/dashboard/audit-quick-stats", "audit"],
  ["/dashboard/bpm-kpis", "bpm"],
  ["/dashboard/dpms-kpis", "dpms"],
  ["/dashboard/tprm-kpis", "tprm"],
  ["/dora/critical-vendors", "isms"],
  ["/dora/ict-risks", "erm"],
  ["/findings/analytics", "ics"],
  ["/findings/bulk", "ics"],
  ["/findings/export", "ics"],
  ["/processes/[id]", "bpm"],
  ["/processes/ai", "bpm"],
  ["/processes/audit-pack", "bpm"],
  ["/processes/bulk", "bpm"],
  ["/processes/bulk-approve", "bpm"],
  ["/processes/cockpit", "bpm"],
  ["/processes/generate-bpmn", "bpm"],
  ["/processes/governance", "bpm"],
  ["/processes/governance-summary", "bpm"],
  ["/processes/import-bpmn-xml", "bpm"],
  ["/processes/import-excel", "bpm"],
  ["/processes/map", "bpm"],
  ["/processes/metro-layout", "bpm"],
  ["/processes/ropa-export", "dpms"],
  ["/processes/tree", "bpm"],
  ["/tax-cms/icfr-controls", "ics"],
  ["/tax-cms/risks", "erm"],
  ["/whistleblowing/intake", "platform"],
  ["/whistleblowing/intake-codes", "platform"],
  ["/academy", "academy"],
  ["/access-log", "platform"],
  ["/admin", "platform"],
  ["/agents", "platform"],
  ["/ai", "dms"],
  ["/ai-act", "isms"],
  ["/api-keys", "platform"],
  ["/asset-classification-overrides", "isms"],
  ["/assets", "isms"],
  ["/assurance", "platform"],
  ["/audit-log", "platform"],
  ["/audit-mgmt", "audit"],
  ["/auth", "platform"],
  ["/automation", "platform"],
  ["/bcms", "bcms"],
  ["/bi-reports", "reporting"],
  ["/billing", "platform"],
  ["/bpm", "bpm"],
  ["/branding", "platform"],
  ["/budget", "platform"],
  ["/budgets", "platform"],
  ["/calendar", "platform"],
  // Persönliche/übergreifende Oberfläche bzw. Referenzdaten — kein
  // lizenzierbares Fachmodul, deshalb bewusst "platform" statt einer
  // erfundenen Modulzuordnung, die eine Org aussperren würde.
  ["/catalog-references", "platform"],
  // Persönliche/übergreifende Oberfläche bzw. Referenzdaten — kein
  // lizenzierbares Fachmodul, deshalb bewusst "platform" statt einer
  // erfundenen Modulzuordnung, die eine Org aussperren würde.
  ["/catalogs", "platform"],
  ["/cert-wizard", "audit"],
  ["/cloud-connectors", "ics"],
  ["/community", "community"],
  ["/compliance", "ics"],
  ["/connectors", "ics"],
  ["/contracts", "contract"],
  ["/control-test-campaigns", "ics"],
  ["/control-testing", "ics"],
  ["/control-tests", "ics"],
  ["/controls", "ics"],
  ["/copilot", "platform"],
  ["/costs", "platform"],
  ["/cross", "isms"],
  ["/dashboard", "audit"],
  // Persönliche/übergreifende Oberfläche bzw. Referenzdaten — kein
  // lizenzierbares Fachmodul, deshalb bewusst "platform" statt einer
  // erfundenen Modulzuordnung, die eine Org aussperren würde.
  ["/dashboards", "platform"],
  ["/data-sovereignty", "platform"],
  ["/dd-sessions", "tprm"],
  ["/developer-apps", "platform"],
  ["/devops-connectors", "ics"],
  ["/dmn", "bpm"],
  ["/dms", "dms"],
  ["/documents", "dms"],
  ["/dora", "erm"],
  ["/dpms", "dpms"],
  ["/eam", "eam"],
  ["/entity-documents", "dms"],
  ["/erm", "erm"],
  ["/esg", "esg"],
  ["/events", "platform"],
  ["/evidence", "ics"],
  ["/evidence-review", "ics"],
  ["/executive", "platform"],
  ["/export", "platform"],
  ["/feature-gates", "platform"],
  ["/findings", "ics"],
  ["/framework-mappings", "ics"],
  ["/graph", "platform"],
  ["/grc", "platform"],
  ["/health", "platform"],
  ["/horizon-scanner", "platform"],
  ["/ics", "ics"],
  ["/identity", "platform"],
  ["/identity-connectors", "ics"],
  ["/import", "platform"],
  ["/import-jobs", "platform"],
  ["/invitations", "platform"],
  ["/isms", "isms"],
  ["/kris", "erm"],
  ["/lksg", "tprm"],
  ["/marketplace", "marketplace"],
  ["/maturity", "isms"],
  ["/meta", "platform"],
  ["/mobile", "platform"],
  ["/notifications", "platform"],
  ["/onboarding", "platform"],
  ["/organizations", "erm"],
  ["/platform", "platform"],
  ["/playbooks", "isms"],
  ["/playground", "platform"],
  ["/plugins", "platform"],
  ["/policies", "dms"],
  ["/portal", "platform"],
  ["/portals", "portals"],
  ["/predictive-risk", "erm"],
  ["/processes", "bpm"],
  ["/programmes", "programme"],
  ["/questionnaire-templates", "tprm"],
  ["/rcsa", "erm"],
  ["/references", "platform"],
  ["/regulatory", "platform"],
  ["/regulatory-changes", "platform"],
  ["/reports", "reporting"],
  ["/retention-policies", "dms"],
  ["/risk-acceptance", "erm"],
  ["/risk-acceptances", "erm"],
  ["/risk-quantification", "erm"],
  ["/risk-treatment-links", "erm"],
  ["/risks", "erm"],
  ["/roi", "platform"],
  // Persönliche/übergreifende Oberfläche bzw. Referenzdaten — kein
  // lizenzierbares Fachmodul, deshalb bewusst "platform" statt einer
  // erfundenen Modulzuordnung, die eine Org aussperren würde.
  ["/role-dashboards", "platform"],
  ["/roni", "platform"],
  ["/scim", "platform"],
  ["/search", "platform"],
  ["/signature-requests", "dms"],
  ["/simulations", "simulations"],
  ["/subscriptions", "platform"],
  ["/tags", "platform"],
  ["/tasks", "platform"],
  ["/tax-cms", "erm"],
  ["/template-packs", "platform"],
  ["/time-entries", "platform"],
  ["/tprm", "tprm"],
  ["/translations", "platform"],
  ["/usage", "platform"],
  ["/users", "platform"],
  ["/vendors", "tprm"],
  ["/webhooks", "platform"],
  ["/whistleblowing", "whistleblowing"],
  ["/work-items", "platform"],
];

const SORTED = [...ROUTE_MODULE_REGISTRY].sort(
  (a, b) => b[0].split("/").length - a[0].split("/").length,
);

/** Normalise a concrete request path to the registry shape. */
export function normalizeApiPath(pathname: string): string | null {
  const m = pathname.match(/^\/api\/v1(\/.*)?$/);
  if (!m) return null;
  const rest = m[1] ?? "/";
  // Replace UUIDs / opaque tokens with the `[id]` placeholder so the registry
  // stays route-shaped rather than instance-shaped.
  return rest
    .split("/")
    .map((seg) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        seg,
      ) || /^\d+$/.test(seg)
        ? "[id]"
        : seg,
    )
    .join("/");
}

/**
 * Resolve the module scope for a request path.
 * Returns `null` when the path is not registered at all — callers treat that
 * as "unknown route", which is a fail-closed condition for the custom-role
 * fallback and a test failure for mutating routes.
 */
export function moduleScopeForPath(pathname: string): RouteModuleScope | null {
  const path = normalizeApiPath(pathname);
  if (path === null) return null;
  for (const [prefix, scope] of SORTED) {
    if (path === prefix || path.startsWith(prefix + "/")) return scope;
  }
  return null;
}

/** Convenience for route handlers: guard by the registry entry of `req`. */
export async function requireModuleForRequest(
  req: Request,
  orgId: string,
): Promise<Response | null> {
  const scope = moduleScopeForPath(new URL(req.url).pathname);
  if (!scope || scope === "platform") return null;
  return requireModule(scope, orgId, req.method);
}

// ════════════════════════════════════════════════════════════════════
// S02-10 — Rollenuntergrenze für mutierende Routen
// ════════════════════════════════════════════════════════════════════
//
// `withAuth()` ohne Rollenargument übersprang den Rollenblock vollständig, so
// dass ein `viewer` — im Rollenmodell ausdrücklich die Nur-Lese-Rolle —
// ISMS-Assessments löschen, den Risiko-Propagationsgraphen ändern und
// Prüfungsfeststellungen anlegen konnte.
//
// Zwei Ebenen:
//   1. `MUTATING_ROLE_REGISTRY` — fachlich enge Rollenlisten für die im
//      Auditbericht namentlich genannten Pfade.
//   2. `DEFAULT_MUTATING_ROLES` — die Untergrenze für alles andere: jede Rolle
//      AUSSER den reinen Leserollen. Bewusst weit gefasst, weil eine zu enge
//      zentrale Voreinstellung legitime Fachanwender aussperren würde; sie
//      schließt aber genau die Lücke, die der Befund beschreibt.
//
// Explizite Argumente an `withAuth(...)` haben immer Vorrang.

import type { UserRole } from "@grc/shared";
import { USER_ROLES } from "@grc/shared";

/** Rollen, die ausschließlich lesen dürfen. */
export const READ_ONLY_ROLES: readonly UserRole[] = ["viewer"];

export const DEFAULT_MUTATING_ROLES: readonly UserRole[] = USER_ROLES.filter(
  (r) => !READ_ONLY_ROLES.includes(r),
);

export const MUTATING_ROLE_REGISTRY: ReadonlyArray<
  readonly [string, readonly UserRole[]]
> = [
  // S02-06 — hash-ketten-verankerter Audit-Sign-off
  [
    "/audit-mgmt/audits/[id]/sign-off",
    ["admin", "auditor", "external_auditor", "compliance_officer"],
  ],
  [
    "/audit-mgmt",
    [
      "admin",
      "auditor",
      "external_auditor",
      "risk_manager",
      "compliance_officer",
    ],
  ],
  // S02-10 — ISMS-Bewertungen, Vorfälle, SoA
  [
    "/isms",
    [
      "admin",
      "ciso",
      "risk_manager",
      "control_owner",
      "security_analyst",
      "compliance_officer",
    ],
  ],
  // S02-10 — Risiko-Propagationsgraph
  ["/erm/propagation", ["admin", "risk_manager"]],
  ["/erm/predictions", ["admin", "risk_manager"]],
  ["/esg/materiality", ["admin", "esg_manager", "esg_contributor"]],
  // S02-07 — Massenexport (der Endpunkt selbst gehört WP8, siehe WP3.md)
  ["/export/bulk", ["admin", "dpo", "compliance_officer"]],
  ["/compliance/simulator", ["admin", "risk_manager", "compliance_officer"]],
] as const;

const SORTED_ROLES = [...MUTATING_ROLE_REGISTRY].sort(
  (a, b) => b[0].split("/").length - a[0].split("/").length,
);

/** Effective role requirement for a mutating request without explicit roles. */
export function mutatingRolesForPath(pathname: string): readonly UserRole[] {
  const path = normalizeApiPath(pathname);
  if (path !== null) {
    for (const [prefix, roles] of SORTED_ROLES) {
      if (path === prefix || path.startsWith(prefix + "/")) return roles;
    }
  }
  return DEFAULT_MUTATING_ROLES;
}

// ════════════════════════════════════════════════════════════════════
// S02-03 — plattformweite Konfiguration
// ════════════════════════════════════════════════════════════════════
//
// `feature_gate`, `subscription_plan`, `plugin`, `data_region` und
// `framework_mapping` haben kein `org_id`, keine RLS und keine Policy; ihre
// Schreib-Endpunkte waren nur mit `withAuth("admin")` geschützt — und `admin`
// ist eine PRO-ORGANISATION vergebene Rolle. Ein Mandanten-Admin konnte damit
// Feature-, Abrechnungs- und Data-Sovereignty-Konfiguration ALLER Mandanten
// ändern; für `framework_mapping` genügte sogar `risk_manager`.
//
// Schreibzugriff auf diese Pfade verlangt ab sofort einen Plattform-Admin
// (Tabelle `platform_admin`, Migration 0411). Die Rolle ist ausschließlich am
// DB-Prompt vergebbar — es gibt bewusst keinen API-Pfad dafür.
export const PLATFORM_SCOPED_WRITE_PREFIXES: readonly string[] = [
  "/feature-gates",
  "/subscriptions/plans",
  "/plugins",
  "/data-sovereignty/regions",
  "/framework-mappings",
  "/template-packs",
  "/catalogs",
];

export function requiresPlatformAdmin(
  pathname: string,
  method: string,
): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  const path = normalizeApiPath(pathname);
  if (path === null) return false;
  return PLATFORM_SCOPED_WRITE_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
}
