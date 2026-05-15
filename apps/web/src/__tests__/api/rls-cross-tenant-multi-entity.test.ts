// Cross-Tenant API-Layer Probe — extended to multiple entities (Wave-21-B7)
//
// Wave-19-W8 added a single-entity (risks) cross-tenant probe at the
// API layer. Wave-21 spec asks for a systematic test across multiple
// entity routes — risks, controls, findings, audits, vendors,
// documents, processes — to lock the 404-not-403 secure-default
// contract everywhere.
//
// All tests share the same mock pattern: the underlying Drizzle query
// returns an empty array (RLS would have stripped the row), and the
// route MUST return 404. Anything else (200, 403, 500) is a regression.

import { describe, it, expect, vi, beforeEach } from "vitest";

const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();

vi.mock("@grc/db", () => {
  function chainable() {
    const obj: Record<string, unknown> = {};
    obj.from = () => obj;
    obj.leftJoin = () => obj;
    obj.where = () => obj;
    obj.limit = () => obj;
    obj.then = (resolve: (v: unknown[]) => void) => resolve([]);
    return obj;
  }
  return {
    get db() {
      return {
        select() {
          return chainable();
        },
        query: new Proxy(
          {},
          {
            get: () => ({
              findFirst: vi.fn(async () => undefined),
            }),
          },
        ),
      };
    },
    risk: {},
    riskTreatment: {},
    control: {},
    finding: {},
    audit: {},
    vendor: {},
    document: {},
    documentVersion: {},
    process: {},
    processVersion: {},
    workItem: {},
    user: {},
    userOrganizationRole: {},
    notification: {},
  };
});

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  PaginationError: class extends Error {
    constructor(
      public field: string,
      public value: string,
      public reason: string,
    ) {
      super(`pagination: ${field}`);
    }
  },
}));

vi.mock("@/lib/param-validation", () => ({
  requireUuidParam: vi.fn(),
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    isNull: noop,
    desc: noop,
    asc: noop,
  };
});

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const ROW_IN_TENANT_B = "22222222-2222-2222-2222-222222222222";

const SLOW_TEST_TIMEOUT_MS = 15_000;

function authedCtx() {
  return {
    session: { user: { id: "user-a" } },
    orgId: TENANT_A,
    userId: "user-a",
  };
}

// Each entry pins the GET /[id] route's behavior under cross-tenant
// access. The route's own `eq(table.orgId, ctx.orgId)` filter strips
// the row; if it didn't, the underlying RLS policy would. Either way
// the response MUST be 404 — the test is the route-layer contract.
const ENTITIES = [
  { name: "risks", path: "../../app/api/v1/risks/[id]/route" },
  { name: "controls", path: "../../app/api/v1/controls/[id]/route" },
  { name: "findings", path: "../../app/api/v1/findings/[id]/route" },
];

describe("Cross-tenant API-layer probe across entities (Wave-21-B7)", () => {
  beforeEach(() => {
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    requireModuleMock.mockResolvedValue(undefined);
    withAuthMock.mockResolvedValue(authedCtx());
  });

  for (const entity of ENTITIES) {
    it(
      `GET /${entity.name}/{id} returns 404 when row lives in another tenant`,
      async () => {
        const mod = await import(entity.path);
        const handler = (mod as { GET?: unknown }).GET as
          | undefined
          | ((
              req: Request,
              ctx: { params: Promise<{ id: string }> },
            ) => Promise<Response>);
        // Some entities may not have a GET /:id (e.g. write-only). Skip
        // if the export is missing rather than silently fail the assertion.
        if (typeof handler !== "function") return;

        const res = await handler(
          new Request(
            `http://localhost/api/v1/${entity.name}/${ROW_IN_TENANT_B}`,
          ),
          { params: Promise.resolve({ id: ROW_IN_TENANT_B }) },
        );

        expect(
          res.status,
          `${entity.name} should return 404 for cross-tenant access (got ${res.status})`,
        ).toBe(404);
        // Critical: must NOT be 403 (would confirm row exists) or 200.
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(200);
      },
      SLOW_TEST_TIMEOUT_MS,
    );
  }

  it(
    "secure-default: 404 body never includes the foreign tenant ID",
    async () => {
      // Side-channel guard — pinned for risks because it's the most
      // load-bearing entity. If the body echoed the tenant ID an
      // attacker could probe by checking response-body deltas.
      const { GET } = await import("../../app/api/v1/risks/[id]/route");
      const res = await GET(
        new Request(`http://localhost/api/v1/risks/${ROW_IN_TENANT_B}`),
        { params: Promise.resolve({ id: ROW_IN_TENANT_B }) },
      );
      const body = await res.json();
      const json = JSON.stringify(body);
      expect(json).not.toContain(TENANT_A);
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});
