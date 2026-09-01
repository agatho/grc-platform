import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// #SEC-F01b — request-scoped RLS context. Imported here so the `db` proxy can
// consult the AsyncLocalStorage. request-context.ts imports `requestClient` +
// `schema` back from this module; the cycle is safe because both sides only
// touch the other's bindings inside function bodies (runtime), never at
// module-eval time.
import { requestDbStorage } from "./request-context";
import * as platform from "./schema/platform";
import * as auditChain from "./schema/audit-chain";
import * as risk from "./schema/risk";
import * as processSchema from "./schema/process";
import * as taskSchema from "./schema/task";
import * as moduleSchema from "./schema/module";
import * as assetSchema from "./schema/asset";
import * as workItemSchema from "./schema/work-item";
import * as controlSchema from "./schema/control";
import * as controlEmbeddingSchema from "./schema/control-embedding";
import * as documentSchema from "./schema/document";
import * as documentSignatureSchema from "./schema/document-signature";
import * as catalogSchema from "./schema/catalog";
import * as ismsSchema from "./schema/isms";
import * as bcmsSchema from "./schema/bcms";
import * as dpmsSchema from "./schema/dpms";
import * as auditMgmtSchema from "./schema/audit-mgmt";
import * as tprmSchema from "./schema/tprm";
import * as supplierPortalSchema from "./schema/supplier-portal";
import * as esgSchema from "./schema/esg";
import * as intelligenceSchema from "./schema/intelligence";
import * as whistleblowingSchema from "./schema/whistleblowing";
import * as budgetSchema from "./schema/budget";
import * as brandingSchema from "./schema/branding";
import * as rcsaSchema from "./schema/rcsa";
import * as policyAcknowledgmentSchema from "./schema/policy-acknowledgment";
import * as playbookSchema from "./schema/playbook";
import * as calendarSchema from "./schema/calendar";
import * as dashboardSchema from "./schema/dashboard";
import * as importExportSchema from "./schema/import-export";
import * as identitySchema from "./schema/identity";
import * as translationSchema from "./schema/translation";
import * as eventBusSchema from "./schema/event-bus";
import * as boardKpiSchema from "./schema/board-kpi";
import * as nis2CertificationSchema from "./schema/nis2-certification";
import * as fairSchema from "./schema/fair";
import * as ismsIntelligenceSchema from "./schema/isms-intelligence";
import * as complianceCultureSchema from "./schema/compliance-culture";
import * as automationSchema from "./schema/automation";
import * as reportingSchema from "./schema/reporting";
import * as regulatorySimulatorSchema from "./schema/regulatory-simulator";
import * as riskPropagationSchema from "./schema/risk-propagation";
import * as auditAnalyticsSchema from "./schema/audit-analytics";
import * as abacSchema from "./schema/abac";
import * as agentsSchema from "./schema/agents";
import * as eamSchema from "./schema/eam";
import * as eamAdvancedSchema from "./schema/eam-advanced";
import * as platformAdvancedSchema from "./schema/platform-advanced";
import * as ermAdvancedSchema from "./schema/erm-advanced";
import * as icsAdvancedSchema from "./schema/ics-advanced";
import * as bcmsAdvancedSchema from "./schema/bcms-advanced";
import * as dpmsAdvancedSchema from "./schema/dpms-advanced";
import * as auditAdvancedSchema from "./schema/audit-advanced";
import * as tprmAdvancedSchema from "./schema/tprm-advanced";
import * as esgAdvancedSchema from "./schema/esg-advanced";
import * as whistleblowingAdvancedSchema from "./schema/whistleblowing-advanced";
import * as bpmAdvancedSchema from "./schema/bpm-advanced";
import * as eamDashboardsSchema from "./schema/eam-dashboards";
import * as eamDataArchitectureSchema from "./schema/eam-data-architecture";
import * as eamAiSchema from "./schema/eam-ai";
import * as eamCatalogSchema from "./schema/eam-catalog";
import * as eamGovernanceSchema from "./schema/eam-governance";
import * as riskEvaluationSchema from "./schema/risk-evaluation";
import * as incidentTimelineSchema from "./schema/incident-timeline";
import * as processRaciSchema from "./schema/process-raci";
import * as processGrcSchema from "./schema/process-grc";
import * as processApprovalSchema from "./schema/process-approval";
import * as apiPlatformSchema from "./schema/api-platform";
import * as extensionSchema from "./schema/extension";
import * as onboardingSchema from "./schema/onboarding";
import * as mobileSchema from "./schema/mobile";
import * as saasMeteringSchema from "./schema/saas-metering";
import * as evidenceConnectorSchema from "./schema/evidence-connector";
import * as cloudConnectorSchema from "./schema/cloud-connector";
import * as identitySaasConnectorSchema from "./schema/identity-saas-connector";
import * as devopsConnectorSchema from "./schema/devops-connector";
import * as frameworkMappingSchema from "./schema/framework-mapping";
import * as copilotChatSchema from "./schema/copilot-chat";
import * as evidenceReviewSchema from "./schema/evidence-review";
import * as regulatoryChangeSchema from "./schema/regulatory-change";
import * as controlTestingAgentSchema from "./schema/control-testing-agent";
import * as predictiveRiskSchema from "./schema/predictive-risk";
import * as doraSchema from "./schema/dora";
import * as aiActSchema from "./schema/ai-act";
import * as taxCmsSchema from "./schema/tax-cms";
import * as horizonScannerSchema from "./schema/horizon-scanner";
import * as certWizardSchema from "./schema/cert-wizard";
// Sprint 77: Embedded BI und Report Builder
import * as biReportingSchema from "./schema/bi-reporting";
// Sprint 78: GRC Benchmarking und Maturity Model
import * as benchmarkingSchema from "./schema/benchmarking";
// Sprint 79: Unified Risk Quantification Dashboard
import * as riskQuantificationSchema from "./schema/risk-quantification";
// Sprint 80: Multi-Region Deployment und Data Sovereignty
import * as dataSovereigntySchema from "./schema/data-sovereignty";
// Sprint 81: Role-Based Experience Redesign
import * as roleDashboardsSchema from "./schema/role-dashboards";
// Sprint 82: Integration Marketplace
import * as marketplaceSchema from "./schema/marketplace";
// Sprint 83: External Stakeholder Portals
import * as stakeholderPortalSchema from "./schema/stakeholder-portal";
// Sprint 84: GRC Academy und Awareness
import * as academySchema from "./schema/academy";
// Sprint 85: Simulation und Scenario Engine
import * as simulationSchema from "./schema/simulation";
// Sprint 86: Community Edition und Open-Source Packaging
import * as communitySchema from "./schema/community";
// ADR-014 Phase 3: 55 Tabellen in 11 Domain-Files integriert
import * as aiActExtendedSchema from "./schema/ai-act-extended";
import * as approvalWorkflowSchema from "./schema/approval-workflow";
import * as auditExtrasSchema from "./schema/audit-extras";
import * as checklistSchema from "./schema/checklist";
import * as connectorSchema from "./schema/connector";
import * as contentNarrativeSchema from "./schema/content-narrative";
import * as controlMonitoringSchema from "./schema/control-monitoring";
import * as dataGovernanceSchema from "./schema/data-governance";
import * as esefXbrlSchema from "./schema/esef-xbrl";
import * as ismsCapSchema from "./schema/isms-cap";
import * as riskAcceptanceSchema from "./schema/risk-acceptance";
import * as phase3ExtrasSchema from "./schema/phase3-extras";
import * as stakeholderRegisterSchema from "./schema/stakeholder-register";
import * as programmeSchema from "./schema/programme";
import * as entityCommentSchema from "./schema/entity-comment";

// Connection pool settings tuned for the over-night QA finding (#NIGHT-011/012/020):
// the bare default `postgres(url)` left idle connections to be reaped by the
// server side without the driver knowing, so the first request after ~30 min
// of idleness paid a 5-25 s reconnect penalty (manifesting as catalogs/
// framework-mappings cold-start timeouts). We now own the lifecycle:
//
//   max               — pool ceiling (10 is plenty for a single web pod)
//   idle_timeout      — recycle idle conns after 20 s, before pgbouncer / pg
//                       defaults can drop them out from under us
//   max_lifetime      — recycle every 30 min so long-lived bad sockets get
//                       cleared (e.g. pgbouncer rolling restarts)
//   connect_timeout   — fail fast on truly unreachable DB so api-wrapper can
//                       map to 503 instead of hanging the request
//
// Pre-warm: trigger one trivial query at module load so the first user-facing
// request doesn't pay TCP+TLS+startup. Postgres-js has no `min` option, so
// this is the closest equivalent.
//
// #SEC-F01 (RLS-hardening / ADR-005): the RUNTIME app pool connects via
// APP_DATABASE_URL when set — that URL points at the non-superuser role
// `grc_app` (no BYPASSRLS), so the RLS policies actually take effect for
// every read/write the app performs. When APP_DATABASE_URL is unset we fall
// back to DATABASE_URL so dev/CI (which only set DATABASE_URL = superuser
// `grc`) keep working unchanged. Migrations, seeds and provisioning use a
// SEPARATE client bound to DATABASE_URL (superuser) — see migrate-all.ts and
// the docker entrypoint — so schema changes and GRANTs still run with the
// privileges they need. withReadContext / withAuditContext run their
// set_config('app.current_org_id', …) on THIS runtime pool, which is exactly
// where RLS now becomes effective.
const RUNTIME_DATABASE_URL =
  process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;

// [ARCTOS-FULL-2026-08-31 / WP2 · S01-10, abgestimmt mit WP10 · S13-10]
//
// Der `??`-Fallback oben ist bequem und lautlos: fehlt APP_DATABASE_URL in
// einer Umgebung (neuer Deploy-Pfad, Kubernetes-Manifest statt Compose,
// lokales `.env` — im Repo ist die Zeile in `.env:19` auskommentiert),
// verbindet die gesamte Web-App als SUPERUSER `grc`. Superuser umgehen RLS
// UNABHÄNGIG von FORCE — sämtliche Policies dieses Schemas sind dann
// wirkungslos, und jede Route, die sich auf RLS statt auf ein explizites
// `WHERE org_id` verlässt, wird zum Cross-Tenant-IDOR. Nichts im Code prüfte
// das bisher; die App startete ohne eine einzige Meldung.
//
// Zwei Dinge sind hier zu trennen:
//  * Die WEB-APP darf in Produktion NIEMALS privilegiert verbinden. Für sie
//    ist ein Superuser-/BYPASSRLS-Pool ein Sicherheitsdefekt, kein
//    Betriebsdetail — sie startet dann nicht.
//  * Der WORKER verbindet bewusst privilegiert (S01-09: org-übergreifende
//    Systemjobs; docker-compose.production.yml setzt APP_DATABASE_URL dort
//    absichtlich nicht). Diese Entscheidung bleibt zulässig, muss aber
//    EXPLIZIT erklärt werden — `ARCTOS_ALLOW_PRIVILEGED_DB=true`. Damit ist
//    sie im Deployment sichtbar, greppbar und einzeln widerrufbar, statt
//    still aus einer fehlenden Variablen zu folgen.
//
// Die Prüfung läuft asynchron beim Modul-Load (der Pool ist zu diesem
// Zeitpunkt gerade erst gebaut) und ist exportiert, damit Tests und ein
// Health-Endpunkt sie direkt aufrufen können.
export interface RuntimeRoleCheck {
  role: string;
  isSuperuser: boolean;
  canBypassRls: boolean;
  appDatabaseUrlSet: boolean;
  privilegedAllowed: boolean;
  ok: boolean;
}

export async function checkRuntimeRoleIsolation(): Promise<RuntimeRoleCheck> {
  const rows = await client<
    { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
  >`SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname = current_user`;
  const row = rows[0] ?? {
    rolname: "unknown",
    rolsuper: false,
    rolbypassrls: false,
  };
  const privilegedAllowed = process.env.ARCTOS_ALLOW_PRIVILEGED_DB === "true";
  const privileged = row.rolsuper || row.rolbypassrls;
  return {
    role: row.rolname,
    isSuperuser: row.rolsuper,
    canBypassRls: row.rolbypassrls,
    appDatabaseUrlSet: Boolean(process.env.APP_DATABASE_URL),
    privilegedAllowed,
    ok: !privileged || privilegedAllowed,
  };
}

/**
 * Startup assertion. Returns the check result; in production a violation is
 * fatal (the process exits) so a misconfigured deploy fails loudly instead of
 * serving every tenant's data to every tenant.
 */
export async function assertRuntimeRoleIsolation(): Promise<RuntimeRoleCheck> {
  const check = await checkRuntimeRoleIsolation();
  if (check.ok) return check;
  const detail =
    `[db] FATAL: the runtime pool connects as "${check.role}" ` +
    `(rolsuper=${check.isSuperuser}, rolbypassrls=${check.canBypassRls}). ` +
    `Such a role BYPASSES Row Level Security, which disables tenant ` +
    `isolation for every query this process makes. ` +
    `APP_DATABASE_URL is ${check.appDatabaseUrlSet ? "set" : "NOT set"}. ` +
    `Point APP_DATABASE_URL at the non-superuser role grc_app ` +
    `(deploy/provision-grc-app.sh), or — for the worker, which needs ` +
    `cross-org access on purpose — set ARCTOS_ALLOW_PRIVILEGED_DB=true.`;
  if (process.env.NODE_ENV === "production") {
    console.error(detail);
    // `process.exit` exists only in the Node.js runtime. This module is reached
    // from the Edge middleware via @grc/auth, and Turbopack rejects the bare
    // call at build time ("A Node.js API is used (process.exit) which is not
    // supported in the Edge Runtime") — it fails the production build even
    // though this branch never executes there. Resolve it dynamically and fall
    // back to throwing, which is fatal at startup all the same.
    const exit = (
      globalThis as { process?: { exit?: (code: number) => never } }
    ).process?.exit;
    if (typeof exit === "function") exit(1);
    throw new Error(detail);
  }
  console.warn(detail.replace("FATAL", "WARNING"));
  return check;
}

// Base pool — used by ALL non-request code paths: the worker's 128 cron files,
// the event-bus / webhook-dispatch, seeds, and any web query that runs OUTSIDE
// an authenticated request (public routes, login). These connections are never
// pinned to an org context at session level (withReadContext/withAuditContext
// still use SET LOCAL inside a transaction, which self-reverts), so the base
// pool always stays "clean" (app.current_org_id unset → RLS returns 0 rows,
// never throws).
const client = postgres(RUNTIME_DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connect_timeout: 10,
});

// #SEC-AUTH-BOOTSTRAP — exported so request-context.ts (withUserReadContext) can
// `reserve()` a base-pool connection for the auth-bootstrap self-read. The base
// pool is chosen on purpose: its connections NEVER carry a session-level
// `app.current_org_id` (it stays NULL), so the org-scoped `org_isolation` policy
// evaluates `NULL::uuid` (no match, no error) instead of `''::uuid` (which THROWS
// on the request pool, whose connections are scrubbed to '' at rest).
export { client as baseClient };

// #SEC-F01b — Request pool. A SEPARATE pool used exclusively by
// request-context.ts to `reserve()` one connection per authenticated request
// and pin the org/user GUCs onto it at SESSION level. Kept separate from the
// base pool on purpose: once a custom GUC is set on a connection it can never
// be reset back to NULL (only to ''), and ''::uuid throws in the RLS policies —
// so a request connection must never fall back into the base pool where a
// context-less query could land on it. Every reserve re-sets all GUCs, so a
// poisoned '' value here is harmless (it is never read context-less).
//
// Pool sizing: because each in-flight authenticated request holds one reserved
// connection for its whole duration (including slow/streaming AI-assist calls —
// which are safe here precisely because there is NO open transaction, just a
// session GUC), `max` here is the per-pod ceiling on CONCURRENT authenticated
// requests. 25 balances that against Postgres `max_connections` (base 10 +
// request 25 = 35 per web pod). Raise together with Postgres if a pod needs
// more concurrency.
export const requestClient = postgres(RUNTIME_DATABASE_URL, {
  max: 25,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connect_timeout: 10,
});

if (process.env.NODE_ENV === "production" && RUNTIME_DATABASE_URL) {
  void client`SELECT 1`
    .then(() => assertRuntimeRoleIsolation())
    .catch((err) => {
      // Cold-start prewarm failed — log but don't block module import. The next
      // real request will retry and surface the error through api-wrapper.
      // NOTE: a FAILED role assertion does not land here — it calls
      // process.exit(1) itself (S01-10). Only connection errors do.
      console.error("[db] connection prewarm failed:", err?.message ?? err);
    });
}

// The full Drizzle schema, exported so request-context.ts can build a drizzle
// client over a reserved connection with the identical schema.
export const schema = {
  ...platform,
  ...auditChain,
  ...risk,
  ...processSchema,
  ...taskSchema,
  ...moduleSchema,
  ...assetSchema,
  ...workItemSchema,
  ...controlSchema,
  ...controlEmbeddingSchema,
  ...documentSchema,
  ...documentSignatureSchema,
  ...catalogSchema,
  ...ismsSchema,
  ...bcmsSchema,
  ...dpmsSchema,
  ...auditMgmtSchema,
  ...tprmSchema,
  ...supplierPortalSchema,
  ...esgSchema,
  ...intelligenceSchema,
  ...whistleblowingSchema,
  ...budgetSchema,
  ...brandingSchema,
  ...rcsaSchema,
  ...policyAcknowledgmentSchema,
  ...playbookSchema,
  ...calendarSchema,
  ...dashboardSchema,
  ...importExportSchema,
  ...identitySchema,
  ...translationSchema,
  ...eventBusSchema,
  ...boardKpiSchema,
  ...nis2CertificationSchema,
  ...fairSchema,
  ...ismsIntelligenceSchema,
  ...complianceCultureSchema,
  ...automationSchema,
  ...reportingSchema,
  ...regulatorySimulatorSchema,
  ...riskPropagationSchema,
  ...auditAnalyticsSchema,
  ...abacSchema,
  ...agentsSchema,
  ...eamSchema,
  ...eamAdvancedSchema,
  ...platformAdvancedSchema,
  ...ermAdvancedSchema,
  ...icsAdvancedSchema,
  ...bcmsAdvancedSchema,
  ...dpmsAdvancedSchema,
  ...auditAdvancedSchema,
  ...tprmAdvancedSchema,
  ...esgAdvancedSchema,
  ...whistleblowingAdvancedSchema,
  ...bpmAdvancedSchema,
  ...eamDashboardsSchema,
  ...eamDataArchitectureSchema,
  ...eamAiSchema,
  ...eamCatalogSchema,
  ...eamGovernanceSchema,
  ...riskEvaluationSchema,
  ...incidentTimelineSchema,
  ...processRaciSchema,
  ...processGrcSchema,
  ...processApprovalSchema,
  ...apiPlatformSchema,
  ...extensionSchema,
  ...onboardingSchema,
  ...mobileSchema,
  ...saasMeteringSchema,
  ...evidenceConnectorSchema,
  ...cloudConnectorSchema,
  ...identitySaasConnectorSchema,
  ...devopsConnectorSchema,
  ...frameworkMappingSchema,
  ...copilotChatSchema,
  ...evidenceReviewSchema,
  ...regulatoryChangeSchema,
  ...controlTestingAgentSchema,
  ...predictiveRiskSchema,
  ...doraSchema,
  ...aiActSchema,
  ...taxCmsSchema,
  ...horizonScannerSchema,
  ...certWizardSchema,
  ...biReportingSchema,
  ...benchmarkingSchema,
  ...riskQuantificationSchema,
  ...dataSovereigntySchema,
  ...roleDashboardsSchema,
  ...marketplaceSchema,
  ...stakeholderPortalSchema,
  ...academySchema,
  ...simulationSchema,
  ...communitySchema,
  ...aiActExtendedSchema,
  ...approvalWorkflowSchema,
  ...auditExtrasSchema,
  ...checklistSchema,
  ...connectorSchema,
  ...contentNarrativeSchema,
  ...controlMonitoringSchema,
  ...dataGovernanceSchema,
  ...esefXbrlSchema,
  ...ismsCapSchema,
  ...riskAcceptanceSchema,
  ...phase3ExtrasSchema,
  ...stakeholderRegisterSchema,
  ...programmeSchema,
  ...entityCommentSchema,
};

// Base drizzle client over the base pool. Routes and background code normally
// import the `db` proxy below; `baseDb` is ALSO exported so api-wrapper.ts can
// seed the request-scoped AsyncLocalStorage with a context-less default store
// (see #SEC-F01b-RUN — the run()+mutate fix).
const baseDb = drizzle(client, { schema });
export { baseDb };

// #SEC-F01b — The exported `db` is a Proxy. On every property access it checks
// the request-scoped AsyncLocalStorage: inside an authenticated request it
// delegates to that request's reserved drizzle client (which already has the
// org/user GUCs pinned, so RLS scopes every query); otherwise it delegates to
// `baseDb` (worker crons, event-bus, seeds, migrations, public routes — all
// unchanged). Because `import { db }` stays identical, none of the ~1.800 route
// handlers change.
//
// Methods are bound to whichever client is active so `this` is correct;
// `db.query.*`, `db.transaction`, `db.execute`, `db.select` etc. all resolve
// against the active client. A nested `db.transaction(...)` inside a request
// therefore runs on the reserved connection with context already set — which is
// exactly what withReadContext/withAuditContext rely on.
export const db = new Proxy(baseDb, {
  get(target, prop) {
    const store = requestDbStorage.getStore();
    const active = store ? store.db : target;
    const value = Reflect.get(active, prop, active);
    // `$client` is the raw postgres `Sql` — itself callable but carrying
    // methods like `.end`/`.reserve`. Binding would strip those, so hand it
    // back untouched. Everything else that is a function is a drizzle method
    // (which may use private fields) and must stay bound to its own instance.
    if (prop === "$client") return value;
    return typeof value === "function" ? value.bind(active) : value;
  },
}) as typeof baseDb;

export type Database = typeof baseDb;
// [ARCTOS-FULL-2026-08-31 / Restarbeiten] treiberunabhängige Normalisierung
// von `execute()`-Ergebnissen — siehe ./sql-result.ts
export * from "./sql-result";
// [ARCTOS-FULL-2026-08-31 / Restarbeiten] Grenzwandler numeric/timestamp
export * from "./column-input";
export * from "./schema/platform";
// ADR-011 rev.4 audit-chain integrity tables (WP4 / S03-01, -12, -14, -16)
export * from "./schema/audit-chain";
export * from "./schema/risk";
export * from "./schema/process";
export * from "./schema/task";
export * from "./schema/module";
export * from "./schema/asset";
export * from "./schema/work-item";
export * from "./schema/control";
export * from "./schema/control-embedding";
export * from "./schema/document";
export * from "./schema/document-signature";
export * from "./schema/catalog";
export * from "./schema/isms";
export * from "./schema/bcms";
export * from "./schema/dpms";
export * from "./schema/audit-mgmt";
export * from "./schema/tprm";
export * from "./schema/supplier-portal";
export * from "./schema/esg";
export * from "./schema/intelligence";
export * from "./schema/whistleblowing";
export * from "./schema/budget";
export * from "./schema/branding";
export * from "./schema/rcsa";
export * from "./schema/policy-acknowledgment";
export * from "./schema/playbook";
export * from "./schema/calendar";
export * from "./schema/dashboard";
export * from "./schema/import-export";
export * from "./schema/identity";
export * from "./schema/translation";
export * from "./schema/event-bus";
export * from "./schema/board-kpi";
export * from "./schema/nis2-certification";
export * from "./schema/fair";
export * from "./schema/isms-intelligence";
export * from "./schema/compliance-culture";
export * from "./schema/automation";
export * from "./schema/reporting";
export * from "./schema/regulatory-simulator";
export * from "./schema/risk-propagation";
export * from "./schema/audit-analytics";
export * from "./schema/abac";
export * from "./schema/agents";
export * from "./schema/eam";
export * from "./schema/eam-advanced";
export * from "./schema/platform-advanced";
export * from "./schema/erm-advanced";
export * from "./schema/ics-advanced";
export * from "./schema/bcms-advanced";
export * from "./schema/dpms-advanced";
export * from "./schema/audit-advanced";
export * from "./schema/tprm-advanced";
export * from "./schema/esg-advanced";
export * from "./schema/whistleblowing-advanced";
export * from "./schema/bpm-advanced";
export * from "./schema/eam-dashboards";
export * from "./schema/eam-data-architecture";
export * from "./schema/eam-ai";
export * from "./schema/eam-catalog";
export * from "./schema/eam-governance";
export * from "./schema/risk-evaluation";
export * from "./schema/incident-timeline";
export * from "./schema/process-raci";
export * from "./schema/process-grc";
export * from "./schema/process-approval";
export * from "./schema/api-platform";
export * from "./schema/extension";
export * from "./schema/onboarding";
export * from "./schema/mobile";
export * from "./schema/saas-metering";
export * from "./schema/evidence-connector";
export * from "./schema/cloud-connector";
export * from "./schema/identity-saas-connector";
export * from "./schema/devops-connector";
export * from "./schema/framework-mapping";
export * from "./schema/copilot-chat";
export * from "./schema/evidence-review";
export * from "./schema/regulatory-change";
export * from "./schema/control-testing-agent";
export * from "./schema/predictive-risk";
export * from "./schema/dora";
export * from "./schema/ai-act";
export * from "./schema/tax-cms";
export * from "./schema/horizon-scanner";
export * from "./schema/cert-wizard";
// Sprint 77: Embedded BI und Report Builder
export * from "./schema/bi-reporting";
// Sprint 78: GRC Benchmarking und Maturity Model
export * from "./schema/benchmarking";
// Sprint 79: Unified Risk Quantification Dashboard
export * from "./schema/risk-quantification";
// Sprint 80: Multi-Region Deployment und Data Sovereignty
export * from "./schema/data-sovereignty";
// Sprint 81: Role-Based Experience Redesign
export * from "./schema/role-dashboards";
// Sprint 82: Integration Marketplace
export * from "./schema/marketplace";
// Sprint 83: External Stakeholder Portals
export * from "./schema/stakeholder-portal";
// Sprint 84: GRC Academy und Awareness
export * from "./schema/academy";
// Sprint 85: Simulation und Scenario Engine
export * from "./schema/simulation";
// Sprint 86: Community Edition und Open-Source Packaging
export * from "./schema/community";
// Navigation preferences (sidebar favorites + collapsed groups)
export * from "./schema/nav-preference";
// ADR-014 Phase 3: Schema-Integrations (55 neue Tabellen)
export * from "./schema/ai-act-extended";
export * from "./schema/approval-workflow";
export * from "./schema/audit-extras";
export * from "./schema/checklist";
export * from "./schema/connector";
export * from "./schema/content-narrative";
export * from "./schema/control-monitoring";
export * from "./schema/data-governance";
export * from "./schema/esef-xbrl";
export * from "./schema/isms-cap";
export * from "./schema/risk-acceptance";
export * from "./schema/phase3-extras";
export * from "./schema/stakeholder-register";
export * from "./schema/programme";
export * from "./schema/entity-comment";

// #SEC-F01b — request-scoped RLS context public API. api.ts uses
// reserveRequestContext + enterWith + Next `after()`; tests/scripts use
// runWithRequestContext.
export {
  requestDbStorage,
  reserveRequestContext,
  releaseRequestContext,
  runWithRequestContext,
  getRequestStore,
  withUserReadContext,
  withOrgReadContext,
  type RequestContextInput,
  type RequestDbStore,
} from "./request-context";

// ADR-001 RLS audit helper — re-exported so API routes + CLI can import it
export * from "./rls-audit";

// Programme template seeder — exported so the new-programme wizard
// can lazy-seed the 4 norm templates on first run, without requiring
// a separate manual seed step on each install.
export {
  seedProgrammeTemplates,
  type ProgrammeSeedResult,
} from "./seeds/programme-templates";

// SoA → Programme Cockpit sync engine — projects ISO 27001 Annex A
// applicability decisions into the active journey as implementation
// subtasks and audit-trace step-links.
export {
  syncSoaEntryToProgramme,
  syncAllSoaEntriesToProgramme,
  reverseSyncSubtaskCompletion,
  type SoaSyncResult,
} from "./programme-soa-sync";
