// Auth smoke for every MUTATING API route (POST/PUT/PATCH/DELETE).
//
// Sister of all-routes-smoke.test.ts (same auto-discovery + mock setup).
// For each route.ts that exports a mutating handler, the handler is invoked
// with a request that carries NO authenticated session (the `@/auth` mock
// resolves to null and the `withAuth` mock resolves to a 401 Response).
// The handler MUST reject with 401 or 403.
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

vi.mock("@grc/ai", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0, 0, 0]),
  callLlm: vi.fn().mockResolvedValue({ content: "" }),
  routeRequest: vi.fn().mockResolvedValue({ content: "" }),
  getAvailableProviders: vi.fn().mockReturnValue([]),
  getDefaultProvider: vi.fn().mockReturnValue("ollama"),
  DEFAULT_MODELS: {},
}));

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
type MutatingMethod = (typeof MUTATING_METHODS)[number];

// Vite glob — lazy imports of every route.ts file (same as all-routes-smoke)
const routeModules = import.meta.glob<Record<string, unknown>>(
  "../../app/api/**/route.ts",
);

// A mutating request without a session must produce one of these.
const REJECTED_STATUS_CODES = [401, 403];

interface AllowlistEntry {
  /** Mutating methods this entry covers ("*" = all exported). */
  methods: MutatingMethod[] | "*";
  /** Statuses the anonymous call may legitimately return. */
  statuses: number[];
  /** Why this endpoint is anonymous by design (keep it honest). */
  reason: string;
  /**
   * The handler may throw on our generic JSON smoke body (e.g. it parses
   * multipart/form-data). Only for routes whose anonymity is otherwise
   * verified — never use this to hide a missing auth guard.
   */
  allowThrow?: boolean;
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
  // the handler. allowThrow: the handler starts with req.formData(); our
  // generic application/json smoke body makes that throw before any logic
  // runs — with a real form body it returns 400 on missing/invalid
  // SAMLResponse.
  "/api/v1/auth/sso/saml/callback": {
    methods: ["POST"],
    statuses: [302, 400, 404, 422],
    reason: "SSO callback; validated via SAML assertion, not session",
    allowThrow: true,
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
  "/api/v1/portal/report/[orgCode]": {
    methods: ["POST"],
    statuses: [400, 404, 422, 429],
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
    methods: "*", // every exported mutating method is the same 405 stub
    statuses: [405],
    reason: "Explicit 405 stub; discovery endpoint, create via /journeys",
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
};

const SAMPLE_UUID = "a1b2c3d4-e5f6-4789-9abc-def012345678";

function makeRequest(method: MutatingMethod, path: string): Request {
  return new Request(`http://localhost${path}`, {
    method,
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
  });
}

function makeParams(path: string): Promise<Record<string, string>> {
  // Extract dynamic segments [name] and [...name] from the path.
  // Next 15: route context params are a Promise.
  const params: Record<string, string> = {};
  const matches = path.matchAll(/\[\.{0,3}([^\]]+)\]/g);
  for (const m of matches) {
    params[m[1]!] = SAMPLE_UUID;
  }
  return Promise.resolve(params);
}

describe("Mutating API routes reject unauthenticated requests (auto-discovered)", () => {
  it("discovers at least 100 route modules", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThan(100);
  });

  for (const [path, importer] of Object.entries(routeModules)) {
    const cleanPath = path
      .replace("../../app/api/", "/api/")
      .replace("/route.ts", "");

    it(`${cleanPath} [mutating → 401/403]`, async (ctx) => {
      const mod = await importer();
      const methods = MUTATING_METHODS.filter(
        (m) => typeof mod[m] === "function",
      );
      if (methods.length === 0) {
        ctx.skip(); // read-only route — covered by all-routes-smoke
        return;
      }

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

        let res: Response;
        try {
          res = await fn(req, routeCtx);
        } catch (err) {
          if (allowlisted && allow.allowThrow) {
            // Documented smoke-body artifact (see entry comment).
            continue;
          }
          // Unlike all-routes-smoke this is a real failure: the handler
          // executed logic without first rejecting the missing session.
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
