// Wave-25 Block B + Block C contract tests.
//
// Companion to wave-24-block-b.test.ts and wave-24-block-c-d.test.ts.
// One describe per W25 item so a failure unambiguously names which
// acceptance regressed.

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
  user: { id: "id", name: "name", email: "email" },
  biaAssessment: { id: "id", orgId: "orgId" },
  vendor: { id: "id", orgId: "orgId", deletedAt: "deletedAt" },
  esrsMetric: { id: "id", orgId: "orgId", unit: "unit" },
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

vi.mock("@/lib/api-errors", () => ({ getRequestId: () => "test-req-id" }));
vi.mock("@/lib/param-validation", () => ({
  requireUuidParam: () => undefined,
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
// B1 — /findings UUID filter validation
// ───────────────────────────────────────────────────────────────

describe("W25-B1: GET /api/v1/findings UUID filter validation", () => {
  beforeEach(() => {
    withAuthMock.mockResolvedValue(authedCtx());
    // count() and items selects both return chainables
    let calls = 0;
    mockDb.select.mockImplementation(() => {
      calls += 1;
      return chainable(calls === 1 ? [] : [{ value: 0 }]);
    });
  });

  it.each(["controlId", "auditId", "riskId", "ownerId"])(
    "rejects invalid UUID for ?%s with 422 (was 500)",
    async (param) => {
      const { GET } = await import("../../app/api/v1/findings/route");
      const res = await GET(
        new Request(`http://localhost/api/v1/findings?${param}=not-a-uuid`),
        undefined,
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as {
        error: string;
        invalidParam: string;
      };
      expect(body.error).toBe("Validation failed");
      expect(body.invalidParam).toBe(param);
    },
  );

  it.each(["controlId", "auditId", "riskId", "ownerId"])(
    "accepts valid UUID for ?%s with 200",
    { timeout: 15_000 },
    async (param) => {
      const valid = "d0000000-0000-0000-0000-000000001101";
      const { GET } = await import("../../app/api/v1/findings/route");
      const res = await GET(
        new Request(`http://localhost/api/v1/findings?${param}=${valid}`),
        undefined,
      );
      expect(res.status).toBe(200);
    },
  );

  it("treats empty string as no-filter (200)", async () => {
    const { GET } = await import("../../app/api/v1/findings/route");
    const res = await GET(
      new Request("http://localhost/api/v1/findings?controlId="),
      undefined,
    );
    expect(res.status).toBe(200);
  });
});

// ───────────────────────────────────────────────────────────────
// B2 — bcm_manager can POST /bcms/bia
// ───────────────────────────────────────────────────────────────

describe("W25-B2: POST /api/v1/bcms/bia", () => {
  it("allows admin, risk_manager, bcm_manager", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } = await import("../../app/api/v1/bcms/bia/route");
    await POST(
      new Request("http://localhost/api/v1/bcms/bia", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "bcm_manager",
    );
  });
});

// ───────────────────────────────────────────────────────────────
// C2 — vendor-assessment schema-discovery
// ───────────────────────────────────────────────────────────────

describe("W25-C2: GET /api/v1/vendors/{id}/assessments/schema", () => {
  beforeEach(() => {
    withAuthMock.mockResolvedValue(authedCtx("vendor_manager"));
  });

  it("returns schema fields + example body when vendor exists", async () => {
    mockDb.select.mockReturnValue(chainable([{ id: "v1" }]));
    const { GET } =
      await import("../../app/api/v1/vendors/[id]/assessments/schema/route");
    const res = await GET(
      new Request("http://localhost/api/v1/vendors/v1/assessments/schema"),
      { params: Promise.resolve({ id: "v1" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        endpoint: string;
        aliasOf: string;
        method: string;
        fields: {
          assessmentDate: { required: boolean };
          inherentRiskScore: { required: boolean };
          residualRiskScore: { required: boolean };
        };
        example: {
          assessmentDate: string;
          inherentRiskScore: number;
          residualRiskScore: number;
        };
      };
    };
    expect(body.data.method).toBe("POST");
    expect(body.data.endpoint).toMatch(/\/vendors\/v1\/assessments$/);
    expect(body.data.aliasOf).toMatch(/\/risk-assessments$/);
    expect(body.data.fields.assessmentDate.required).toBe(true);
    expect(body.data.fields.inherentRiskScore.required).toBe(true);
    expect(body.data.fields.residualRiskScore.required).toBe(true);
    expect(body.data.example.inherentRiskScore).toBeGreaterThan(0);
    expect(body.data.example.residualRiskScore).toBeGreaterThan(0);
  });

  it("returns 404 when vendor not found", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { GET } =
      await import("../../app/api/v1/vendors/[id]/assessments/schema/route");
    const res = await GET(
      new Request("http://localhost/api/v1/vendors/v1/assessments/schema"),
      { params: Promise.resolve({ id: "v1" }) },
    );
    expect(res.status).toBe(404);
  });
});

// ───────────────────────────────────────────────────────────────
// C3 — ESG measurement schema example uses real metric
// ───────────────────────────────────────────────────────────────

describe("W25-C3: GET /api/v1/esg/measurements/schema", () => {
  beforeEach(() => {
    withAuthMock.mockResolvedValue(authedCtx("esg_manager"));
  });

  it("uses a real metricId in the example when one exists", async () => {
    mockDb.select.mockReturnValue(
      chainable([{ id: "real-metric-id", unit: "kWh" }]),
    );
    const { GET } =
      await import("../../app/api/v1/esg/measurements/schema/route");
    const res = await GET(
      new Request("http://localhost/api/v1/esg/measurements/schema"),
      undefined as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        example: { metricId: string; unit: string };
        hint?: string;
      };
    };
    expect(body.data.example.metricId).toBe("real-metric-id");
    expect(body.data.example.unit).toBe("kWh");
    expect(body.data.hint).toBeUndefined();
  });

  it("falls back to placeholder + hint when no metrics seeded", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { GET } =
      await import("../../app/api/v1/esg/measurements/schema/route");
    const res = await GET(
      new Request("http://localhost/api/v1/esg/measurements/schema"),
      undefined as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        example: { metricId: string };
        hint?: string;
      };
    };
    expect(body.data.example.metricId).toBe(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(body.data.hint).toMatch(/No ESG metrics seeded/);
  });
});
