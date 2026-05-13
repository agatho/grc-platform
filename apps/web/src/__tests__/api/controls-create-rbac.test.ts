// POST /api/v1/controls — RBAC + Validation contract tests.
//
// Sister of risks-create-rbac.test.ts for the ICS module. Ensures the
// gateway correctly enforces the role list (admin, risk_manager,
// control_owner, auditor) and rejects invalid bodies with 422.

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
  control: {},
  workItem: {},
  user: {},
  userOrganizationRole: {
    userId: "userId",
    orgId: "orgId",
    deletedAt: "deletedAt",
  },
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
  // Required by api-wrapper.ts (withErrorHandler does
  // `instanceof PaginationError`). Replaces nothing — controls/POST
  // path doesn't actually paginate — but the import must resolve.
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
    sql: noop,
  };
});

describe("POST /api/v1/controls", () => {
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
    const { POST } = await import("../../app/api/v1/controls/route");
    const res = await POST(
      new Request("http://localhost/api/v1/controls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      undefined,
    );
    expect(res.status).toBe(401);
    // Allowed roles for control creation
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "control_owner",
      "auditor",
    );
  });

  it("returns 403 when role is rejected", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { POST } = await import("../../app/api/v1/controls/route");
    const res = await POST(
      new Request("http://localhost/api/v1/controls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      undefined,
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when ICS module is disabled", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      orgId: "org-1",
      userId: "user-1",
    });
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const { POST } = await import("../../app/api/v1/controls/route");
    const res = await POST(
      new Request("http://localhost/api/v1/controls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test Control" }),
      }),
      undefined,
    );
    expect(res.status).toBe(404);
    expect(requireModuleMock).toHaveBeenCalledWith("ics", "org-1", "POST");
  });

  it("returns 422 when body fails Zod validation", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      orgId: "org-1",
      userId: "user-1",
    });
    requireModuleMock.mockResolvedValue(undefined);
    const { POST } = await import("../../app/api/v1/controls/route");
    const res = await POST(
      new Request("http://localhost/api/v1/controls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}), // missing required fields
      }),
      undefined,
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });
});
