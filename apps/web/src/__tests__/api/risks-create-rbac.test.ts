// POST /api/v1/risks — RBAC + Validation contract tests.
//
// Verifies the gateway behavior of the most-touched mutating endpoint in
// the ERM module. The handler delegates auth to withAuth(...) and validates
// body via createRiskSchema (Zod). We mock withAuth to drive the four
// branches we care about: 401, 403, 422 (invalid body), 422 (owner outside
// org).
//
// Pattern follows audit-log-integrity.test.ts and auth-switch-org.test.ts.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  // Schema re-exports — handler imports table objects from the barrel.
  // We don't care about their shape in these tests, just that imports resolve.
  risk: {},
  workItem: {},
  user: {},
  userOrganizationRole: {
    userId: "userId",
    orgId: "orgId",
    deletedAt: "deletedAt",
  },
  riskAppetite: {},
  notification: {},
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
  // PaginationError is imported by api-wrapper.ts (the wrapper uses
  // `instanceof PaginationError` to map paginate() failures to 422).
  // Without it on the mock, vitest fails the import with "No
  // 'PaginationError' export is defined on the '@/lib/api' mock".
  PaginationError: class PaginationError extends Error {
    constructor(
      public readonly field: string,
      public readonly value: string,
      public readonly reason: string,
    ) {
      super(`Invalid pagination: ${field}=${value} (${reason})`);
      this.name = "PaginationError";
    }
  },
}));

// Drizzle helpers — no-op stubs to keep imports resolvable.
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
    sql: noop,
    ilike: noop,
    gte: noop,
    lte: noop,
    or: noop,
  };
});

const VALID_OWNER = "a1b2c3d4-e5f6-4789-9abc-def012345678";

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test Risk",
    riskCategory: "operational",
    riskSource: "erm",
    ...overrides,
  };
}

describe("POST /api/v1/risks", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();
  });

  // 8s timeout: cold-loading risks/route.ts on CI consumes ~3-4s, plus
  // the chained `await import` on each it() block (vitest's ESM cache
  // is per-suite, not shared across files). The default 5s timeout
  // produced flaky timeouts on the 401/403 paths even though the route
  // returns immediately once withAuth resolves.
  it("returns 401 when not authenticated", { timeout: 15000 }, async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } = await import("../../app/api/v1/risks/route");
    const req = new Request("http://localhost/api/v1/risks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(makeBody()),
    });
    const res = await POST(req, undefined);
    expect(res.status).toBe(401);
    // withAuth was called with the four roles allowed to create risks
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "control_owner",
      "process_owner",
    );
  });

  it(
    "returns 403 when withAuth rejects role (e.g. viewer)",
    { timeout: 15000 },
    async () => {
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );
      const { POST } = await import("../../app/api/v1/risks/route");
      const req = new Request("http://localhost/api/v1/risks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(makeBody()),
      });
      const res = await POST(req, undefined);
      expect(res.status).toBe(403);
    },
  );

  it("returns 404 when ERM module is disabled for the org", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      orgId: "org-1",
      userId: "user-1",
    });
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const { POST } = await import("../../app/api/v1/risks/route");
    const req = new Request("http://localhost/api/v1/risks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(makeBody()),
    });
    const res = await POST(req, undefined);
    expect(res.status).toBe(404);
    expect(requireModuleMock).toHaveBeenCalledWith("erm", "org-1", "POST");
  });

  it("returns 422 when body fails Zod validation", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      orgId: "org-1",
      userId: "user-1",
    });
    requireModuleMock.mockResolvedValue(undefined);
    const { POST } = await import("../../app/api/v1/risks/route");
    const req = new Request("http://localhost/api/v1/risks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Missing required `title` and invalid riskCategory
      body: JSON.stringify({ riskCategory: "not-a-real-category" }),
    });
    const res = await POST(req, undefined);
    expect(res.status).toBe(422);
    const body = await res.json();
    // RFC 7807 problem+json shape (#WAVE6-VAL-01): the wrapper now
    // returns { type, title, status, detail, errors, fieldErrors, ... }
    // instead of { error, details }. Tests assert the new shape; the
    // legacy `fieldErrors` extension field is also present so older
    // clients can keep parsing.
    expect(body.title).toBe("Validation failed");
    expect(body.errors).toBeDefined();
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("returns 422 when ownerId is not a member of the org", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      orgId: "org-1",
      userId: "user-1",
    });
    requireModuleMock.mockResolvedValue(undefined);

    // The handler queries userOrganizationRole — return empty (owner not in org).
    // The chainable's then() resolves to []; .where() etc. all return chain.
    // makeMockDb default already returns [] for select — perfect.
    const { POST } = await import("../../app/api/v1/risks/route");
    const req = new Request("http://localhost/api/v1/risks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(makeBody({ ownerId: VALID_OWNER })),
    });
    const res = await POST(req, undefined);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/owner/i);
  });
});
