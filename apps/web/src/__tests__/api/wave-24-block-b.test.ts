// Wave-24 Block B — regression tests for the four Wave-23 RBAC/method
// tightenings that broke user workflows. Each `describe` block locks
// down the contract that Wave-23 violated:
//
//   B1  GET  /api/v1/audit-log/integrity     — CISO + compliance_officer 200
//   B2  GET  /api/v1/findings?status=…       — invalid value → 422 (was 500)
//   B3  GET  /api/v1/erm/management-summary  — broad-read RBAC, 200 (was 405)
//   B4  POST /api/v1/control-tests           — compliance_officer 201 (was 405)
//
// These tests deliberately exercise the route handler's contract via
// mocked withAuth / requireModule / db. The aim is to assert the
// public-facing behaviour (allowed roles, status codes, response
// shape), not to re-test the underlying Drizzle calls — those are
// covered by integration tests against a real Postgres in CI.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, chainable, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();

// Single set of module mocks shared across all B-block routes. The
// per-test reset() in each `beforeEach` keeps the mocks honest.
vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  controlTest: {
    id: "id",
    orgId: "orgId",
    controlId: "controlId",
    campaignId: "campaignId",
    taskId: "taskId",
    testType: "testType",
    status: "status",
    todResult: "todResult",
    toeResult: "toeResult",
    testerId: "testerId",
    testDate: "testDate",
    sampleSize: "sampleSize",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    deletedAt: "deletedAt",
  },
  control: { id: "id", orgId: "orgId", title: "title", deletedAt: "deletedAt" },
  user: { id: "id", name: "name", email: "email" },
  finding: {
    orgId: "orgId",
    deletedAt: "deletedAt",
    status: "status",
    severity: "severity",
    source: "source",
    controlId: "controlId",
    auditId: "auditId",
    riskId: "riskId",
    ownerId: "ownerId",
    title: "title",
    description: "description",
    workItemId: "workItemId",
    controlTestId: "controlTestId",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    remediationPlan: "remediationPlan",
    remediationDueDate: "remediationDueDate",
    remediatedAt: "remediatedAt",
    verifiedAt: "verifiedAt",
    id: "id",
  },
  workItem: { id: "id", elementId: "elementId" },
  userOrganizationRole: {
    userId: "userId",
    orgId: "orgId",
    deletedAt: "deletedAt",
  },
  notification: {},
  riskTreatment: {},
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
  paginate: (req: Request) => ({
    page: 1,
    limit: 10,
    offset: 0,
    searchParams: new URL(req.url).searchParams,
  }),
  paginatedResponse: (data: unknown, total: number) =>
    Response.json({ data, total, page: 1, limit: 10 }),
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
    sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
      sql: strings.raw,
      vals,
    }),
  };
});

function authedCtx(role = "admin") {
  return {
    session: { user: { id: "user-1", email: `${role}@test`, name: role } },
    orgId: "org-1",
    userId: "user-1",
    role,
  };
}

beforeEach(() => {
  mockDb = makeMockDb();
  withAuthMock.mockReset();
  requireModuleMock.mockReset();
  withAuditContextMock.mockReset();
  requireModuleMock.mockResolvedValue(undefined);
});

// ───────────────────────────────────────────────────────────────
// B1 — CISO + compliance_officer can read /audit-log/integrity
// ───────────────────────────────────────────────────────────────

describe("W24-B1: GET /api/v1/audit-log/integrity", () => {
  it("allows admin, auditor, ciso, compliance_officer", async () => {
    withAuthMock.mockResolvedValue(authedCtx("ciso"));
    mockDb.execute
      .mockResolvedValueOnce([]) // chain rows
      .mockResolvedValueOnce([{ legacy_count: 0 }]);
    const { GET } = await import("../../app/api/v1/audit-log/integrity/route");
    const res = await GET(
      new Request("http://localhost/api/v1/audit-log/integrity"),
    );
    expect(res.status).toBe(200);
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "auditor",
      "ciso",
      "compliance_officer",
    );
    const body = (await res.json()) as { data: { healthy: boolean } };
    expect(body.data.healthy).toBe(true);
  });

  it("propagates 403 when withAuth rejects the role", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { GET } = await import("../../app/api/v1/audit-log/integrity/route");
    const res = await GET(
      new Request("http://localhost/api/v1/audit-log/integrity"),
    );
    expect(res.status).toBe(403);
  });
});

// ───────────────────────────────────────────────────────────────
// B2 — /findings status filter returns 422 (not 500) for invalid
// ───────────────────────────────────────────────────────────────

describe("W24-B2: GET /api/v1/findings status filter validation", () => {
  beforeEach(() => {
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);
    // GET path issues two parallel queries: items + count. Both must
    // resolve via the chainable mock.
    mockDb.select.mockReturnValue(chainable([]));
  });

  it.each([
    ["identified", 200],
    ["closed", 200],
    ["identified,closed", 200],
  ])("accepts %s → %i", async (status, expected) => {
    // For count() second `.select` returns a chainable resolving to
    // a single row. Easiest: configure the chainable to flatten —
    // we override the second call to return chainable with count row.
    let calls = 0;
    mockDb.select.mockImplementation(() => {
      calls += 1;
      return chainable(calls === 1 ? [] : [{ value: 0 }]);
    });
    const { GET } = await import("../../app/api/v1/findings/route");
    const res = await GET(
      new Request(`http://localhost/api/v1/findings?status=${status}`),
      undefined,
    );
    expect(res.status).toBe(expected);
  });

  it.each([
    ["open"], // Wave-23 regression repro
    ["in_review"],
    ["xyz"],
    ["identified,bogus"],
  ])("rejects %s with 422", async (status) => {
    const { GET } = await import("../../app/api/v1/findings/route");
    const res = await GET(
      new Request(`http://localhost/api/v1/findings?status=${status}`),
      undefined,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: string;
      invalidParam: string;
    };
    expect(body.error).toBe("Validation failed");
    expect(body.invalidParam).toBe("status");
  });

  it("rejects invalid severity with 422", async () => {
    const { GET } = await import("../../app/api/v1/findings/route");
    const res = await GET(
      new Request("http://localhost/api/v1/findings?severity=ULTRA"),
      undefined,
    );
    expect(res.status).toBe(422);
  });

  it("rejects invalid source with 422", async () => {
    const { GET } = await import("../../app/api/v1/findings/route");
    const res = await GET(
      new Request("http://localhost/api/v1/findings?source=hearsay"),
      undefined,
    );
    expect(res.status).toBe(422);
  });
});

// ───────────────────────────────────────────────────────────────
// B3 — GET /erm/management-summary is reachable for read roles
// ───────────────────────────────────────────────────────────────

describe("W24-B3: GET /api/v1/erm/management-summary", () => {
  beforeEach(() => {
    withAuthMock.mockResolvedValue(authedCtx("ciso"));
    // buildSummary issues 8 db.execute() calls. Default empty arrays
    // are safe — the shape assertions below only require the wrapper
    // keys to exist.
    mockDb.execute.mockResolvedValue([]);
  });

  it("returns 200 with risksSummary/controlsSummary/findingsSummary", async () => {
    const { GET } =
      await import("../../app/api/v1/erm/management-summary/route");
    const res = await GET(
      new Request("http://localhost/api/v1/erm/management-summary"),
    );
    expect(res.status).toBe(200);
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "auditor",
      "ciso",
      "compliance_officer",
      "process_owner",
      "control_owner",
    );
    const body = (await res.json()) as {
      data: {
        risksSummary: unknown;
        controlsSummary: unknown;
        findingsSummary: unknown;
      };
    };
    expect(body.data.risksSummary).toBeDefined();
    expect(body.data.controlsSummary).toBeDefined();
    expect(body.data.findingsSummary).toBeDefined();
  });

  it("propagates 403 when role rejected", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { GET } =
      await import("../../app/api/v1/erm/management-summary/route");
    const res = await GET(
      new Request("http://localhost/api/v1/erm/management-summary"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when ERM module disabled", async () => {
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const { GET } =
      await import("../../app/api/v1/erm/management-summary/route");
    const res = await GET(
      new Request("http://localhost/api/v1/erm/management-summary"),
    );
    expect(res.status).toBe(404);
  });
});

// ───────────────────────────────────────────────────────────────
// B4 — POST /control-tests works for compliance_officer
// ───────────────────────────────────────────────────────────────

describe("W24-B4: POST /api/v1/control-tests", () => {
  const validBody = {
    controlId: "11111111-1111-1111-1111-111111111111",
    testType: "design_effectiveness" as const,
    testDate: "2026-05-15",
  };

  beforeEach(() => {
    withAuthMock.mockResolvedValue(authedCtx("compliance_officer"));
    requireModuleMock.mockResolvedValue(undefined);
    // parent-control existence check.
    mockDb.select.mockReturnValue(chainable([{ id: validBody.controlId }]));
    // withAuditContext invokes its callback with a tx mock.
    withAuditContextMock.mockImplementation(
      async (_ctx: unknown, cb: (tx: MockDb) => Promise<unknown>) => {
        const tx = makeMockDb();
        tx.insert.mockReturnValue(
          chainable([
            {
              id: "new-test-id",
              orgId: "org-1",
              controlId: validBody.controlId,
              testType: validBody.testType,
              status: "planned",
            },
          ]),
        );
        return cb(tx);
      },
    );
  });

  it("permits compliance_officer to create a test (201)", async () => {
    const { POST } = await import("../../app/api/v1/control-tests/route");
    const res = await POST(
      new Request("http://localhost/api/v1/control-tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      undefined,
    );
    expect(res.status).toBe(201);
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "auditor",
      "control_owner",
      "compliance_officer",
    );
  });

  it("returns 422 on invalid body", async () => {
    const { POST } = await import("../../app/api/v1/control-tests/route");
    const res = await POST(
      new Request("http://localhost/api/v1/control-tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ testType: "bogus" }),
      }),
      undefined,
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when control belongs to another org", async () => {
    mockDb.select.mockReturnValue(chainable([])); // no parent found
    const { POST } = await import("../../app/api/v1/control-tests/route");
    const res = await POST(
      new Request("http://localhost/api/v1/control-tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      undefined,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 401/403 when withAuth rejects", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } = await import("../../app/api/v1/control-tests/route");
    const res = await POST(
      new Request("http://localhost/api/v1/control-tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      undefined,
    );
    expect(res.status).toBe(401);
  });
});
