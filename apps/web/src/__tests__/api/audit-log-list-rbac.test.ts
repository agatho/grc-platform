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
  // api-wrapper imports PaginationError; mock must export it for instanceof check.
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  // Drizzle's `sql` is a tag *and* carries helper methods (sql.join,
  // sql.raw, sql.empty). The route's includeDescendants branch uses
  // sql.join to build a NOT IN list — without it the mock crashed
  // before the RBAC assertion could run.
  const sqlTag = (strings: TemplateStringsArray) => ({ sql: strings.raw });
  (sqlTag as unknown as Record<string, unknown>).join = (
    parts: unknown[],
    _sep?: unknown,
  ) => ({ sql: ["join"], parts });
  (sqlTag as unknown as Record<string, unknown>).raw = (s: string) => ({
    sql: [s],
  });
  return {
    eq: noop,
    and: noop,
    desc: noop,
    sql: sqlTag,
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
    // The shared beforeEach sets paginate's mock to return an EMPTY
    // URLSearchParams. That makes the route's `searchParams.get(
    // "includeDescendants")` return null, the 403 branch never fires,
    // and the route crashes on the count-row destructuring downstream.
    // Override for this case so the request's actual ?includeDescendants
    // parameter reaches the route.
    paginateMock.mockReturnValueOnce({
      page: 1,
      limit: 20,
      offset: 0,
      searchParams: new URLSearchParams("includeDescendants=true"),
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
