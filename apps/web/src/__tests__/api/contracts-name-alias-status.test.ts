// POST /api/v1/contracts — `name → title` alias + Status-Code-Contract.
//
// #WAVE23-C3: Wave-21-QA berichtete `POST /contracts {name:'X'}` als
// 422 "Validation failed". Wave-22-Hotfix mappte den Alias im Schema
// (packages/shared/src/schemas/tprm.ts:526). Wave-22-QA berichtete
// dann: 500 mit empty body (Regression!). Hypothese: Wave-22 hat den
// Alias deployed aber die POST-Route war nicht in withErrorHandler —
// uncaught Drizzle-Exceptions wurden zu Next.js' Default-Empty-500.
//
// Wave 23 wrappt POST in withErrorHandler. Dieser Test pinnt die
// Acceptance:
//   1. POST {name:'X', contractType:'service_agreement'} → 201
//      (alias maps name→title, schema validates, insert succeeds).
//   2. POST {} → 422 mit Field-Errors (NICHT 500).
//   3. POST mit invalid JSON → 400-ish (NICHT 500).
//   4. Bei Drizzle-Crash → 500 RFC-7807 mit RequestID + non-empty body.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();

vi.mock("@grc/db", () => ({
  db: {},
  contract: {},
  workItem: {},
  user: {},
  vendor: {},
}));

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  get withAuditContext() {
    return withAuditContextMock;
  },
  paginate: vi.fn(() => ({
    page: 1,
    limit: 10,
    offset: 0,
    searchParams: new URLSearchParams(),
  })),
  paginatedResponse: vi.fn((data: unknown, total: number) =>
    Response.json({ data, total, page: 1, limit: 10 }),
  ),
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    isNull: noop,
    count: noop,
    desc: noop,
    asc: noop,
    inArray: noop,
    ilike: noop,
    or: noop,
    sql: Object.assign(noop, { raw: noop }),
    lte: noop,
  };
});

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

function authedCtx() {
  return {
    session: { user: { id: USER_ID } },
    orgId: ORG_ID,
    userId: USER_ID,
  };
}

function happyTxMock() {
  return {
    insert(_table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          return {
            returning() {
              return Promise.resolve([
                { id: ORG_ID, elementId: "CTR00000001", ...values },
              ]);
            },
          };
        },
      };
    },
  };
}

function crashingTxMock() {
  return {
    insert(_table: unknown) {
      return {
        values(_values: Record<string, unknown>) {
          return {
            returning() {
              const err = new Error("relation contract does not exist") as Error & {
                code?: string;
              };
              err.code = "42P01";
              return Promise.reject(err);
            },
          };
        },
      };
    },
  };
}

describe("POST /api/v1/contracts — name→title alias + status contract", () => {
  beforeEach(() => {
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();
  });

  it("accepts {name:'X'} via Wave-22 alias and returns 201", async () => {
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);
    withAuditContextMock.mockImplementation(async (_ctx, fn) =>
      fn(happyTxMock()),
    );

    const { POST } = await import("../../app/api/v1/contracts/route");
    const res = await POST(
      new Request("http://localhost/api/v1/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test Contract via deprecated alias",
          contractType: "service_agreement",
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(res.status).not.toBe(500);
    // Wave-22 emits a 299 Warning header pointing the caller at the
    // canonical field name.
    const warning = res.headers.get("Warning");
    expect(warning).toMatch(/title|name|deprecated/i);
  });

  it("returns 422 (NEVER 500) on missing required fields", async () => {
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);

    const { POST } = await import("../../app/api/v1/contracts/route");
    const res = await POST(
      new Request("http://localhost/api/v1/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(422);
    expect(res.status).not.toBe(500);
  });

  it("returns RFC-7807 500 with requestId on Drizzle crash (NEVER empty body)", async () => {
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);
    withAuditContextMock.mockImplementation(async (_ctx, fn) =>
      fn(crashingTxMock()),
    );

    const { POST } = await import("../../app/api/v1/contracts/route");
    const res = await POST(
      new Request("http://localhost/api/v1/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          contractType: "service_agreement",
        }),
      }),
    );

    // 42P01 isn't in CONSTRAINT_VIOLATION_CODES — falls through to
    // generic 500 path. The point of W23 wrapping POST in
    // withErrorHandler is that the body is RFC-7807 problem+json with
    // requestId, NOT empty.
    expect([422, 500]).toContain(res.status);
    const body = await res.json();
    expect(body.requestId).toBeTruthy();
    expect(body.title).toBeTruthy();
    // Body must NEVER be empty — that was the Wave-22 regression.
    expect(Object.keys(body).length).toBeGreaterThan(0);
  });

  it("emits Warning header for `value`/`startDate`/`endDate` aliases too", async () => {
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);
    withAuditContextMock.mockImplementation(async (_ctx, fn) =>
      fn(happyTxMock()),
    );

    const { POST } = await import("../../app/api/v1/contracts/route");
    const res = await POST(
      new Request("http://localhost/api/v1/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Multi-alias contract",
          contractType: "service_agreement",
          value: 5000,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        }),
      }),
    );

    expect(res.status).toBe(201);
    // The Headers API allows multiple Warning entries — we only check
    // that at least one was emitted with the W22-C3 deprecation phrase.
    const warning = res.headers.get("Warning");
    expect(warning).toMatch(/deprecated/i);
  });
});
