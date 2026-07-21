// Risk-Acceptance API — RBAC + Validation + Governance contract tests.
//
// Sister of controls-create-rbac.test.ts for the ISO 27005 Clause 10
// acceptance flow. Covers the gateway chain (401/403/404-module/422)
// plus the two load-bearing governance rules the routes enforce
// server-side: four-eyes (risk owner must not accept their own risk)
// and the already-accepted guard (409).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, chainable, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  risk: {},
  riskAcceptance: {},
  riskAcceptanceAuthority: {},
  user: {},
  userOrganizationRole: {
    userId: "userId",
    orgId: "orgId",
    role: "role",
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
  paginate: vi.fn((req: Request) => ({
    page: 1,
    limit: 10,
    offset: 0,
    searchParams: new URL(req.url).searchParams,
  })),
  paginatedResponse: vi.fn((data: unknown, total: number) =>
    Response.json({ data, total, page: 1, limit: 10 }),
  ),
  searchParamsToObject: vi.fn((sp: URLSearchParams) => {
    const out: Record<string, string> = {};
    for (const [k, v] of sp) {
      if (v !== "") out[k] = v;
    }
    return out;
  }),
  // Required by api-wrapper.ts (withErrorHandler does
  // `instanceof PaginationError`) — the import must resolve.
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
    isNotNull: noop,
    count: noop,
    desc: noop,
    asc: noop,
    lte: noop,
    sql: noop,
  };
});

const AUTH_CTX = {
  session: { user: { id: "user-1", email: "t@example.com", name: "T" } },
  orgId: "org-1",
  userId: "user-1",
};

const SCORED_RISK = {
  id: "risk-1",
  orgId: "org-1",
  title: "Legacy VPN appliance",
  status: "assessed",
  ownerId: "user-2",
  riskScoreResidual: 12,
  riskScoreInherent: 20,
};

const VALID_BODY = {
  justification:
    "Residual risk accepted after compensating controls; cost-benefit shows no viable further treatment.",
  validUntil: "2027-01-01",
};

function postAcceptance(body: unknown) {
  return new Request("http://localhost/api/v1/risks/risk-1/acceptance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "risk-1" }) };

describe("POST /api/v1/risks/[id]/acceptance", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();
  });

  // First import of the route transforms the full @grc/shared barrel —
  // give the cold-start test more headroom than the 5s default.
  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } =
      await import("../../app/api/v1/risks/[id]/acceptance/route");
    const res = await POST(postAcceptance(VALID_BODY), params);
    expect(res.status).toBe(401);
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "process_owner",
      "ciso",
      "control_owner",
    );
  }, 20000);

  it("returns 403 when role is rejected", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { POST } =
      await import("../../app/api/v1/risks/[id]/acceptance/route");
    const res = await POST(postAcceptance(VALID_BODY), params);
    expect(res.status).toBe(403);
  });

  it("returns 404 when ERM module is disabled", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const { POST } =
      await import("../../app/api/v1/risks/[id]/acceptance/route");
    const res = await POST(postAcceptance(VALID_BODY), params);
    expect(res.status).toBe(404);
    expect(requireModuleMock).toHaveBeenCalledWith("erm", "org-1", "POST");
  });

  it("returns 422 when justification is missing (ISO 27005 mandatory)", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    const { POST } =
      await import("../../app/api/v1/risks/[id]/acceptance/route");
    const res = await POST(postAcceptance({}), params);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 422 when the risk owner tries to accept their own risk (four-eyes)", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    // First select: the risk — owned by the caller.
    mockDb.select.mockReturnValueOnce(
      chainable([{ ...SCORED_RISK, ownerId: "user-1" }]),
    );
    const { POST } =
      await import("../../app/api/v1/risks/[id]/acceptance/route");
    const res = await POST(postAcceptance(VALID_BODY), params);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(String(body.error)).toMatch(/four-eyes/i);
    expect(withAuditContextMock).not.toHaveBeenCalled();
  });

  it("returns 409 when an active acceptance already exists", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.select
      .mockReturnValueOnce(chainable([SCORED_RISK])) // risk
      .mockReturnValueOnce(chainable([{ id: "acc-existing" }])); // active row
    const { POST } =
      await import("../../app/api/v1/risks/[id]/acceptance/route");
    const res = await POST(postAcceptance(VALID_BODY), params);
    expect(res.status).toBe(409);
  });

  it("returns 403 when the caller lacks the authority-matrix role", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.select
      .mockReturnValueOnce(chainable([SCORED_RISK])) // risk (score 12)
      .mockReturnValueOnce(chainable([])) // no active acceptance
      .mockReturnValueOnce(
        chainable([
          {
            minScore: 9,
            maxScore: 14,
            requiredRole: "risk_manager",
            isActive: true,
          },
        ]),
      ) // authority matrix
      .mockReturnValueOnce(chainable([])); // caller holds neither role
    const { POST } =
      await import("../../app/api/v1/risks/[id]/acceptance/route");
    const res = await POST(postAcceptance(VALID_BODY), params);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.requiredRole).toBe("risk_manager");
  });

  it("creates the acceptance (201) and persists the full ISO record", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.select
      .mockReturnValueOnce(chainable([SCORED_RISK]))
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([
          {
            minScore: 9,
            maxScore: 14,
            requiredRole: "risk_manager",
            isActive: true,
          },
        ]),
      )
      .mockReturnValueOnce(chainable([{ role: "risk_manager" }]));
    const inserted = { id: "acc-new", status: "active" };
    mockDb.insert.mockReturnValue(chainable([inserted]));
    withAuditContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: MockDb) => Promise<unknown>) => fn(mockDb),
    );
    const { POST } =
      await import("../../app/api/v1/risks/[id]/acceptance/route");
    const res = await POST(postAcceptance(VALID_BODY), params);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("acc-new");
    // Full record persisted: acceptedBy + score snapshot + justification.
    const valuesArg = mockDb.insert.mock.results.length
      ? (
          mockDb.insert.mock.results[0].value as {
            values: ReturnType<typeof vi.fn>;
          }
        ).values.mock.calls[0][0]
      : undefined;
    expect(valuesArg).toMatchObject({
      acceptedBy: "user-1",
      riskScoreAtAcceptance: 12,
      riskLevelAtAcceptance: "high",
      justification: VALID_BODY.justification,
      validUntil: "2027-01-01",
      status: "active",
    });
  });
});

describe("GET /api/v1/risk-acceptances", () => {
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
    const { GET } = await import("../../app/api/v1/risk-acceptances/route");
    const res = await GET(
      new Request("http://localhost/api/v1/risk-acceptances"),
      undefined,
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when ERM module is disabled", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const { GET } = await import("../../app/api/v1/risk-acceptances/route");
    const res = await GET(
      new Request("http://localhost/api/v1/risk-acceptances"),
      undefined,
    );
    expect(res.status).toBe(404);
    expect(requireModuleMock).toHaveBeenCalledWith("erm", "org-1", "GET");
  });

  it("returns 422 for an unknown status filter", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    const { GET } = await import("../../app/api/v1/risk-acceptances/route");
    const res = await GET(
      new Request("http://localhost/api/v1/risk-acceptances?status=requested"),
      undefined,
    );
    expect(res.status).toBe(422);
  });

  it("returns a paginated list", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.select
      .mockReturnValueOnce(
        chainable([{ id: "acc-1", status: "active", riskTitle: "R1" }]),
      )
      .mockReturnValueOnce(chainable([{ total: 1 }]));
    const { GET } = await import("../../app/api/v1/risk-acceptances/route");
    const res = await GET(
      new Request("http://localhost/api/v1/risk-acceptances?status=active"),
      undefined,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("acc-1");
  });

  it("answers POST with 405 (create lives on the risk)", async () => {
    const { POST } = await import("../../app/api/v1/risk-acceptances/route");
    const res = await POST();
    expect(res.status).toBe(405);
  });
});
