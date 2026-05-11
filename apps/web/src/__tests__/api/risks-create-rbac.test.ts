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

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } = await import("../../app/api/v1/risks/route");
    const req = new Request("http://localhost/api/v1/risks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(makeBody()),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    // withAuth was called with the four roles allowed to create risks
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "control_owner",
      "process_owner",
    );
  });

  it("returns 403 when withAuth rejects role (e.g. viewer)", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { POST } = await import("../../app/api/v1/risks/route");
    const req = new Request("http://localhost/api/v1/risks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(makeBody()),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

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
    const res = await POST(req);
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
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
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
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/owner/i);
  });
});
