// GET /api/v1/audit-log — RBAC contract tests.
//
// Audit-log is the most regulated read endpoint: only admin/auditor/dpo
// may access. The handler also supports `includeDescendants` for
// hierarchical reads, which DPOs MUST NOT use (privacy boundary at
// data controller, not group level).
//
// We mock withAuth to drive 401/403/200 paths. The descendant case is
// covered conceptually — full hierarchical query semantics would need
// integration tests with a real DB.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const paginateMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  auditLog: {},
  organization: {},
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  get paginate() {
    return paginateMock;
  },
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    desc: noop,
    sql: (strings: TemplateStringsArray) => ({ sql: strings.raw }),
    count: noop,
    inArray: noop,
    or: noop,
  };
});

describe("GET /api/v1/audit-log", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    paginateMock.mockReset();
    paginateMock.mockReturnValue({
      page: 1,
      limit: 20,
      offset: 0,
      searchParams: new URLSearchParams(),
    });
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../../app/api/v1/audit-log/route");
    const res = await GET(new Request("http://localhost/api/v1/audit-log"));
    expect(res.status).toBe(401);
    // Audit-log is locked to admin / auditor / dpo
    expect(withAuthMock).toHaveBeenCalledWith("admin", "auditor", "dpo");
  });

  it("returns 403 when withAuth rejects (e.g. risk_manager, viewer)", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { GET } = await import("../../app/api/v1/audit-log/route");
    const res = await GET(new Request("http://localhost/api/v1/audit-log"));
    expect(res.status).toBe(403);
  });

  it("rejects includeDescendants for non-admin/auditor roles (e.g. dpo)", async () => {
    withAuthMock.mockResolvedValue({
      session: {
        user: {
          id: "user-1",
          // DPO has no admin/auditor in this org → descendant fan-out denied
          roles: [{ orgId: "org-1", role: "dpo" }],
        },
      },
      orgId: "org-1",
      userId: "user-1",
    });
    const { GET } = await import("../../app/api/v1/audit-log/route");
    const res = await GET(
      new Request("http://localhost/api/v1/audit-log?includeDescendants=true"),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/admin or auditor/i);
  });
});
