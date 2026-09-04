// Auth smoke for EVERY API route — reading (GET/HEAD) and mutating
// (POST/PUT/PATCH/DELETE) alike.
//
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-02, S11-03]
// Until 2026-09-01 this file was `all-mutating-routes-auth-smoke.test.ts` and
// called `ctx.skip()` for every route without a mutating export — 526 silent
// skips that were exactly the read half of the API (527 read-only route.ts
// files). The skip comment claimed "covered by all-routes-smoke"; that sister
// file accepted status 200 for an unauthenticated call, so a dropped
// `withAuth()` on a GET route was green in both files. The sister file is
// deleted; its two structural assertions ("exports a handler", "returns a
// Response") are folded in here, and the read path now carries the same
// strict 401/403 assertion as the write path.
//
// For each route.ts, every exported handler is invoked with a request that
// carries NO authenticated session (the `@/auth` mock resolves to null and the
// `withAuth` mock resolves to a 401 Response). The handler MUST reject with
// 401 or 403.
//
// Deliberately-anonymous endpoints (token-based portals, IdP callbacks,
// SCIM bearer-token provisioning, whistleblower intake) are listed in
// PUBLIC_ALLOWLIST below with an explicit justification and the exact
// statuses they are allowed to return instead. Nothing is silently
// swallowed: a route is either strictly 401/403 or has a commented
// allowlist entry.
//
// A handler that throws instead of returning a Response is reported as a
// descriptive test failure for that route (it ran business logic before /
// without an auth guard) — it does not abort the rest of the run because
// every route gets its own `it`.
//
// Context: docs/STATUS.md P1 "~150 mutating Endpoints ohne RBAC-Test" and
// docs/security/lod-coverage.md ("Anonymous mutating endpoints").

import { describe, it, expect, vi } from "vitest";
import { resetMockDb } from "./helpers/db-proxy";

// Hoisted module-level mocks — identical to all-routes-smoke.test.ts so
// every route module can be imported. All auth entry points report
// "no session".
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {
    GET: vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "Unauthorized" }, { status: 401 }),
      ),
    POST: vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "Unauthorized" }, { status: 401 }),
      ),
  },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  withAuth: vi
    .fn()
    .mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    ),
  withAuditContext: vi.fn(async (_ctx: unknown, fn: () => Promise<unknown>) =>
    fn(),
  ),
  paginate: vi.fn(() => ({
    limit: 10,
    offset: 0,
    searchParams: new URLSearchParams(),
  })),
  paginatedResponse: vi.fn((data: unknown) =>
    Response.json({ data, total: 0, page: 1, limit: 10 }),
  ),
  // api-wrapper imports PaginationError; mock must export it for instanceof check.
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("@grc/auth", () => ({
  requireModule: vi.fn().mockResolvedValue(undefined),
  requireRole: vi.fn().mockResolvedValue(undefined),
  getCurrentOrgId: vi.fn().mockResolvedValue(null),
  getAccessibleOrgIds: vi.fn().mockReturnValue([]),
  hasRole: vi.fn().mockReturnValue(false),
}));

vi.mock("@grc/auth/context", () => ({
  setCurrentOrgId: vi.fn(),
  getCurrentOrgId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("./helpers/db-proxy");
  return dbMockFactory();
});

vi.mock("@grc/email", () => ({
  emailService: {
    send: vi.fn().mockResolvedValue({ ok: true, messageId: "test" }),
  },
}));

vi.mock("@grc/events", () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    onEvent: vi.fn(),
    emitEvent: vi.fn(),
  },
  emitEntityCreated: vi.fn(),
  emitEntityUpdated: vi.fn(),
  emitEntityDeleted: vi.fn(),
}));

// [ARCTOS-FULL-2026-08-31 / WP11 · S11-03] Spread the real module instead of
// listing exports by hand. Several AI routes evaluate `@grc/ai` constants at
// module scope (`z.enum(ALL_PROVIDERS)`, `z.enum(AI_EGRESS_MODES)`); a
// hand-maintained mock drifts and the route then fails to import at all — that
// was the state after WP6 (2 failing routes). Same pattern as the deleted
// all-routes-smoke.test.ts used.
vi.mock("@grc/ai", async () => {
  const actual = await vi.importActual<typeof import("@grc/ai")>("@grc/ai");
  return {
    ...actual,
    generateEmbedding: vi.fn().mockResolvedValue([0, 0, 0]),
    getEmbeddingProvider: vi.fn().mockReturnValue(null),
    callLlm: vi.fn().mockResolvedValue({ content: "" }),
    routeRequest: vi.fn().mockResolvedValue({ content: "" }),
    getAvailableProviders: vi.fn().mockReturnValue([]),
    getDefaultProvider: vi.fn().mockReturnValue("ollama"),
    aiComplete: vi.fn().mockResolvedValue({
      text: "{}",
      provider: "ollama",
      model: "test",
    }),
  };
});

vi.mock("@grc/automation", () => ({
  AutomationEngine: class {
    constructor() {}
    subscribe = vi.fn();
    setActionServices = vi.fn();
    handleEvent = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("@grc/graph", () => ({
  buildKnowledgeGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
}));

const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;
const READING_METHODS = ["GET", "HEAD"] as const;
const ALL_METHODS = [...READING_METHODS, ...MUTATING_METHODS] as const;
type MutatingMethod = (typeof MUTATING_METHODS)[number];
type HttpMethod = (typeof ALL_METHODS)[number];

// Vite glob — lazy imports of every route.ts file
// [ARCTOS-FULL-2026-08-31 · OP-167] Kein Typargument an `import.meta.glob`.
//
// Next 16.3 bringt eine eigene Deklaration von `import.meta.glob` mit, die
// KEIN Typargument nimmt; Vites Deklaration nimmt eines. Wer eines übergibt,
// bekommt unter 16.3 `TS2558: Expected 0 type arguments, but got 1` und
// darunter eine Kaskade von `unknown`. Die Form unten ist unter beiden
// Deklarationen gültig und sagt dasselbe: ein Verzeichnis von Pfaden auf
// Lader, die ein Modulobjekt liefern.
const routeModules = import.meta.glob("../../app/api/**/route.ts") as Record<
  string,
  () => Promise<Record<string, unknown>>
>;

// A request without a session must produce one of these.
const REJECTED_STATUS_CODES = [401, 403];

interface AllowlistEntry {
  /** Methods this entry covers ("*" = all exported). */
  methods: HttpMethod[] | "*";
  /** Statuses the anonymous call may legitimately return. */
  statuses: number[];
  /** Why this endpoint is anonymous by design (keep it honest). */
  reason: string;
  /**
   * The handler may throw on our generic JSON smoke body (e.g. it parses
   * multipart/form-data). Only for routes whose anonymity is otherwise
   * verified — never use this to hide a missing auth guard.
   */
  // [Welle 4b-7 · OP-079] Seit dem SAML-ACS-Fix setzt KEIN Eintrag mehr
  // dieses Feld: kein Handler wirft noch statt zu antworten. Die Mechanik
  // bleibt stehen, damit ein künftiger Fall sich begründen MUSS, statt
  // stillschweigend als Wurf durchzugehen.
  allowThrow?: boolean;
  /**
   * [WP11 · S11-02] The route must not touch the database at all. Used for the
   * static discovery/health stubs: it turns "we allow a 200 here" into a
   * verified property instead of a promise in a comment. If such a route ever
   * starts reading org data, the db mock records the call and this fails.
   */
  statelessOnly?: boolean;
}

// ---------------------------------------------------------------------------
// PUBLIC ALLOWLIST — deliberately-anonymous mutating endpoints.
//
// Source of truth: docs/security/lod-coverage.md "Anonymous mutating
// endpoints" + manual review of each route. Every entry must name the
// alternative security control that replaces a session (token, IdP
// signature, rate limit, …). Do NOT add entries here to silence a failing
// route that simply forgot withAuth — fix the route instead.
// ---------------------------------------------------------------------------
const PUBLIC_ALLOWLIST: Record<string, AllowlistEntry> = {
  // Break-glass admin login — anonymous by definition (it IS the login).
  // Guarded by per-IP rate limit (LIMITS.AUTH) + bcrypt credential check.
  // Empty test body fails Zod → 422; rate-limiter may return 429.
  "/api/v1/auth/admin-login": {
    methods: ["POST"],
    statuses: [400, 422, 429],
    reason: "Break-glass login endpoint; credential+rate-limit guarded",
  },
  // SAML IdP callback (ACS) — the browser POSTs the IdP response here
  // before a session exists. Guarded by SAML signature validation inside
  // the handler.
  "/api/v1/auth/sso/saml/callback": {
    methods: ["POST"],
    statuses: [302, 400, 404, 422],
    reason: "SSO callback; validated via SAML assertion, not session",
    // [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079] `allowThrow: true` ist
    // hier weg. Die Ausnahme deckte einen echten Befund: der Handler rief
    // `await req.formData()` ungeschuetzt auf und warf bei jedem anderen
    // Content-Type. Der Handler antwortet jetzt mit 400 — die Nachsicht wird
    // nicht mehr gebraucht, und ohne sie faellt dieser Test, falls sie es
    // wieder wuerde.
  },
  // Invitation acceptance — recipient has no account/session yet. Guarded
  // by single-use invitation token in the path (unknown token → 404).
  "/api/v1/invitations/[token]/accept": {
    methods: ["POST"],
    statuses: [400, 404, 409, 410, 422],
    reason: "Public invite-accept; single-use path token is the credential",
  },
  // Vendor due-diligence portal — external vendors without accounts.
  // Guarded by per-DD access token in the path (unknown token → 404).
  "/api/v1/portal/dd/[token]/evidence": {
    methods: ["POST"],
    statuses: [400, 404, 409, 410, 422],
    reason: "External vendor DD portal; path token is the credential",
  },
  "/api/v1/portal/dd/[token]/responses": {
    methods: ["PUT"],
    statuses: [400, 404, 409, 410, 422],
    reason: "External vendor DD portal; path token is the credential",
  },
  "/api/v1/portal/dd/[token]/submit": {
    methods: ["POST"],
    statuses: [400, 404, 409, 410, 422],
    reason: "External vendor DD portal; path token is the credential",
  },
  "/api/v1/vendors/dd/submit": {
    methods: ["POST"],
    statuses: [400, 404, 409, 410, 422],
    reason: "External vendor DD submission; ?token= is the credential",
  },
  // Whistleblower intake + anonymous mailbox (EU Whistleblower Directive:
  // reporters MUST be able to stay anonymous — a session requirement would
  // defeat the feature). Guarded by org code / 32+ char mailbox token.
  // GET is the intake page config (org name, categories, languages); POST is
  // the tip submission. Both anonymous — HinSchG requires it. [WP11 · S11-02]
  "/api/v1/portal/report/[orgCode]": {
    methods: ["GET", "POST"],
    statuses: [200, 400, 404, 422, 429],
    reason: "Whistleblower intake; anonymity is a legal requirement",
  },
  "/api/v1/portal/mailbox/[token]": {
    methods: ["POST"],
    statuses: [400, 404, 410, 422],
    reason: "Whistleblower anonymous mailbox; token is the credential",
  },
  "/api/v1/portal/mailbox/[token]/evidence": {
    methods: ["POST"],
    statuses: [400, 404, 410, 413, 422],
    reason: "Whistleblower anonymous mailbox; token is the credential",
  },
  // Anonymous whistleblower intake (HinSchG / EU Whistleblower Directive:
  // tipsters must not need an account — see #WAVE6-WB-01 header comment in
  // the route). Org resolved via public ?orgCode=; empty smoke body → 422.
  "/api/v1/whistleblowing/intake/submit": {
    methods: ["POST"],
    statuses: [400, 404, 422, 429],
    reason: "Anonymized whistleblower intake; anonymity legally required",
  },

  // ---- Method-preserving 308 alias redirects (Wave 7 alias308() +
  // #NIGHT-036). These routes never execute business logic: they answer
  // every method with a 308 pointing at the canonical endpoint, where
  // withAuth() runs. Auth on the alias itself would be dead code.
  "/api/v1/admin/api-keys": {
    methods: "*", // file exports POST/PUT/DELETE, all alias the same 308
    statuses: [308],
    reason: "Legacy alias 308 → /api/v1/admin/scim/tokens (auth at target)",
  },
  "/api/v1/admin/organizations": {
    methods: "*", // file exports POST/PUT/DELETE, all alias the same 308
    statuses: [308],
    reason: "Legacy alias 308 → /api/v1/organizations (auth at target)",
  },
  "/api/v1/admin/sso-providers": {
    methods: "*", // file exports POST/PUT/DELETE, all alias the same 308
    statuses: [308],
    reason: "Legacy alias 308 → /api/v1/admin/sso (auth at target)",
  },
  "/api/v1/admin/users": {
    methods: "*", // file exports POST/PUT/DELETE, all alias the same 308
    statuses: [308],
    reason: "Legacy alias 308 → /api/v1/users (auth at target)",
  },
  "/api/v1/dpms/transfer-impact-assessments": {
    methods: "*", // file exports POST/PUT/DELETE, all alias the same 308
    statuses: [308],
    reason: "Legacy alias 308 → /api/v1/dpms/tia (auth at target)",
  },
  "/api/v1/identity/api-keys": {
    methods: "*", // file exports POST/PUT/DELETE, all alias the same 308
    statuses: [308],
    reason: "Legacy alias 308 → /api/v1/admin/scim/tokens (auth at target)",
  },
  "/api/v1/identity/scim-configs": {
    methods: "*", // file exports POST/PUT/DELETE, all alias the same 308
    statuses: [308],
    reason: "Legacy alias 308 → /api/v1/admin/scim (auth at target)",
  },
  "/api/v1/identity/sso-providers": {
    methods: "*", // file exports POST/PUT/DELETE, all alias the same 308
    statuses: [308],
    reason: "Legacy alias 308 → /api/v1/admin/sso (auth at target)",
  },
  "/api/v1/isms/management-reviews": {
    methods: "*", // file exports POST/PUT/DELETE, all alias the same 308
    statuses: [308],
    reason: "Legacy alias 308 → /api/v1/isms/reviews (auth at target)",
  },

  // ---- Deliberate 405 "method not allowed" stubs (#NIGHT-009/-017/-037,
  // #WAVE23-B6). POST is exported only to return an explicit 405 with an
  // Allow header pointing at the canonical creation endpoint — nothing is
  // mutated and nothing org-scoped is disclosed, so an auth check would
  // only obscure the hint.
  "/api/v1/bpm/templates": {
    methods: "*", // every exported mutating method is the same 405 stub
    statuses: [405],
    reason: "Explicit 405 stub; create via /bpm/templates/:id/adopt",
  },
  "/api/v1/eam/applications": {
    methods: "*", // every exported mutating method is the same 405 stub
    statuses: [405],
    reason: "Explicit 405 stub; applications created via admin import",
  },
  "/api/v1/programmes": {
    methods: "*", // 405 stub for every mutating method, 200 discovery on GET
    statuses: [200, 405],
    reason:
      "Explicit 405 stub on writes; GET is the static discovery payload (#WAVE23-B6). No DB access either way.",
    statelessOnly: true,
  },
  "/api/v1/risk-acceptances": {
    methods: "*", // every exported mutating method is the same 405 stub
    statuses: [405],
    reason: "Explicit 405 stub; create via /risks/{riskId}/acceptance",
  },
  "/api/v1/whistleblowing/cases": {
    methods: "*", // every exported mutating method is the same 405 stub
    statuses: [405],
    reason: "Explicit 405 stub; cases created via anonymized intake",
  },

  // NOTE: the SCIM endpoints (/api/v1/scim/v2/*) from lod-coverage.md are
  // intentionally NOT listed: they validate their own Bearer token via
  // validateScimToken() and return 401 without one, so they pass the strict
  // 401/403 assertion like any other route. Same for /api/v1/auth/switch-org
  // (checks auth() itself → 401).

  // =========================================================================
  // READ PATH — [ARCTOS-FULL-2026-08-31 / WP11 · S11-02]
  //
  // Everything below became visible when the 526 `ctx.skip()` calls for
  // read-only routes were removed. Of 527 read-only route files, exactly 22
  // do not answer 401/403 anonymously. Each is listed with its reason; the
  // other 505 now carry the same strict assertion as the write path.
  // =========================================================================

  // ---- Liveness / readiness probes. Must answer before a session exists
  // (Docker healthcheck, load balancer, uptime monitor). No org data.
  "/api/health": {
    methods: ["GET"],
    statuses: [200, 503],
    reason: "Liveness probe; DB round-trip only, no business data",
  },
  "/api/v1/health": {
    methods: ["GET"],
    statuses: [200, 503],
    reason: "Readiness probe; DB round-trip only, no business data",
  },
  "/api/v1/meta/build": {
    methods: ["GET"],
    statuses: [200],
    reason:
      "Build-SHA diagnosis; deliberately auth-free so it survives an auth outage. Zero DB access — enforced by statelessOnly below.",
    statelessOnly: true,
  },

  // ---- Static discovery payloads (#NIGHT-005/-008/-014/-016, #WAVE6-WB-01,
  // #WAVE23-B6). These return a hard-coded map of sub-routes and touch no
  // database at all. `statelessOnly` asserts that: if any of them ever
  // starts reading org data, the db mock records a call and the test fails,
  // so the allowlist entry cannot silently grow into a leak.
  "/api/v1/compliance": {
    methods: ["GET"],
    statuses: [200],
    reason: "Static route-discovery payload, no DB access",
    statelessOnly: true,
  },
  "/api/v1/identity": {
    methods: ["GET"],
    statuses: [200],
    reason: "Static route-discovery payload, no DB access",
    statelessOnly: true,
  },
  "/api/v1/marketplace": {
    methods: ["GET"],
    statuses: [200],
    reason: "Static route-discovery payload, no DB access",
    statelessOnly: true,
  },
  "/api/v1/rcsa": {
    methods: ["GET"],
    statuses: [200],
    reason: "Static route-discovery payload, no DB access",
    statelessOnly: true,
  },
  "/api/v1/reports": {
    methods: ["GET"],
    statuses: [200],
    reason: "Static route-discovery payload, no DB access",
    statelessOnly: true,
  },
  "/api/v1/isms/nis2": {
    methods: ["GET"],
    statuses: [200],
    reason: "Static route-discovery payload, no DB access",
    statelessOnly: true,
  },
  "/api/v1/whistleblowing/intake": {
    methods: ["GET"],
    statuses: [200],
    reason: "Static intake-channel description, no DB access",
    statelessOnly: true,
  },
  "/api/v1/bcms/crisis/dashboard": {
    methods: ["GET"],
    statuses: [404],
    reason: "Static RFC-7807 404 hint (#NIGHT-031), no DB access",
    statelessOnly: true,
  },

  // ---- Login-page prerequisites. Rendered before any session exists.
  "/api/v1/branding/css/[orgId]": {
    methods: ["GET"],
    statuses: [200],
    reason:
      "Tenant CSS variables for the login screen; org comes from the path and the read is pinned via withOrgReadContext (#WP3-S02-05). Returns colours only. Note to WP2/WP3: this is an org-id oracle (existing vs. unknown org) — S02 territory, out of WP11's scope.",
  },
  "/api/v1/auth/sso/config": {
    methods: ["GET"],
    statuses: [200],
    reason:
      "Login page asks whether SSO is configured for ?orgId=. Returns provider + display name only. Note to WP3: enumerable per orgId — rate limiting is S02's call.",
  },
  "/api/v1/auth/sso/oidc/login": {
    methods: ["GET"],
    statuses: [302, 400, 404],
    reason: "OIDC login initiation; runs before a session by definition",
  },
  "/api/v1/auth/sso/saml/login": {
    methods: ["GET"],
    statuses: [302, 400, 404],
    reason: "SAML login initiation; runs before a session by definition",
  },
  "/api/v1/auth/sso/oidc/callback": {
    methods: ["GET"],
    statuses: [302, 400, 404],
    reason:
      "OIDC callback; authenticated by the ID-token signature (S02-24), not by a session",
  },

  // ---- 405 / discovery stubs that also export a reading handler.
  "/api/v1/esg/erm-sync": {
    methods: ["GET"],
    statuses: [405],
    reason: "Explicit 405 stub; the endpoint is POST-only",
    statelessOnly: true,
  },
};

const SAMPLE_UUID = "a1b2c3d4-e5f6-4789-9abc-def012345678";

function isMutating(m: HttpMethod): m is MutatingMethod {
  return (MUTATING_METHODS as readonly string[]).includes(m);
}

function makeRequest(method: HttpMethod, path: string): Request {
  if (!isMutating(method)) {
    // GET/HEAD must not carry a body (undici rejects it).
    return new Request(`http://localhost${path}`, { method });
  }
  return new Request(`http://localhost${path}`, {
    method,
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
  });
}

// [ARCTOS-FULL-2026-08-31 / WP11 · S11-02] Segment values must be *plausible*
// for the segment, not a UUID for everything. Four annual-report routes
// answered 400 ("year must be numeric") for `[year]` = a UUID and so never
// reached their auth guard — the test would have passed a route that leaks on
// a well-formed year. Anything unlisted keeps the UUID.
const SEGMENT_SAMPLES: Record<string, string> = {
  year: "2026",
  month: "6",
  quarter: "2",
  locale: "de",
  lang: "de",
  token: "e2e-smoke-token-0000000000000000000000",
  orgCode: "smoke-org",
  code: "smoke-code",
  slug: "smoke-slug",
  key: "smoke-key",
  framework: "iso27001",
  standard: "iso27001",
  version: "1",
  format: "json",
  type: "smoke",
  entityType: "risk",
  path: "smoke",
};

function makeParams(path: string): Promise<Record<string, string>> {
  // Extract dynamic segments [name] and [...name] from the path.
  // Next 15: route context params are a Promise.
  const params: Record<string, string> = {};
  const matches = path.matchAll(/\[\.{0,3}([^\]]+)\]/g);
  for (const m of matches) {
    const name = m[1]!;
    params[name] = SEGMENT_SAMPLES[name] ?? SAMPLE_UUID;
  }
  return Promise.resolve(params);
}

describe("API routes reject unauthenticated requests (auto-discovered)", () => {
  it("discovers at least 1000 route modules", () => {
    // Was `> 100`. The repo has 1357 route.ts files; a glob that silently
    // stops matching (moved app dir, changed alias) must fail loudly rather
    // than reduce the suite to a handful of routes.
    expect(Object.keys(routeModules).length).toBeGreaterThan(1000);
  });

  for (const [path, importer] of Object.entries(routeModules)) {
    const cleanPath = path
      .replace("../../app/api/", "/api/")
      .replace("/route.ts", "");

    it(`${cleanPath} [anonymous → 401/403]`, async () => {
      const mod = await importer();
      const methods = ALL_METHODS.filter((m) => typeof mod[m] === "function");

      // Folded in from the deleted all-routes-smoke.test.ts: a route file
      // that exports no handler at all is dead weight in the router.
      expect(
        methods.length,
        `${cleanPath} exports no HTTP method handler (GET/HEAD/POST/PUT/PATCH/DELETE)`,
      ).toBeGreaterThan(0);

      for (const m of methods) {
        const fn = mod[m] as (
          req: Request,
          ctx?: { params: Promise<Record<string, string>> },
        ) => Promise<Response>;
        const req = makeRequest(m, cleanPath);
        const routeCtx = { params: makeParams(path) };
        const allow = PUBLIC_ALLOWLIST[cleanPath];
        const allowlisted =
          allow !== undefined &&
          (allow.methods === "*" || allow.methods.includes(m));

        // Fresh mock db so `statelessOnly` can be checked per call.
        const mockDb = resetMockDb();

        let res: Response;
        try {
          res = await fn(req, routeCtx);
        } catch (err) {
          if (allowlisted && allow.allowThrow) {
            // Documented smoke-body artifact (see entry comment).
            continue;
          }
          // A throw is a real failure: the handler executed logic without
          // first rejecting the missing session. (The deleted
          // all-routes-smoke.test.ts turned exactly this case into
          // `expect(err).toBeDefined()` — an assertion that cannot fail.)
          expect.fail(
            `${m} ${cleanPath} threw instead of returning 401/403 for an ` +
              `unauthenticated request — likely missing withAuth() guard.\n` +
              `Error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
          );
          continue; // unreachable (expect.fail throws) — keeps TS flow happy
        }

        expect(
          res,
          `${m} ${cleanPath} did not return a Response object`,
        ).toBeInstanceOf(Response);

        if (allowlisted) {
          expect(
            [...REJECTED_STATUS_CODES, ...allow!.statuses],
            `${m} ${cleanPath} (allowlisted: ${allow!.reason}) returned ` +
              `unexpected status ${res.status}`,
          ).toContain(res.status);

          if (allow!.statelessOnly) {
            const touched = (
              [
                "select",
                "insert",
                "update",
                "delete",
                "execute",
                "transaction",
              ] as const
            ).filter((k) => mockDb[k].mock.calls.length > 0);
            expect(
              touched,
              `${m} ${cleanPath} is allowlisted as a stateless stub but ` +
                `called db.${touched.join("/db.")} on an unauthenticated ` +
                `request. Either guard it with withAuth() or drop the ` +
                `statelessOnly flag and re-justify the allowlist entry.`,
            ).toEqual([]);
          }
        } else {
          expect(
            REJECTED_STATUS_CODES,
            `${m} ${cleanPath} returned ${res.status} for an unauthenticated ` +
              `request — expected 401/403. If this endpoint is anonymous BY ` +
              `DESIGN, add it to PUBLIC_ALLOWLIST with a justification; ` +
              `otherwise add a withAuth()/module guard (see ` +
              `controls-create-rbac.test.ts for the pattern).`,
          ).toContain(res.status);
        }
      }
    });
  }
});
