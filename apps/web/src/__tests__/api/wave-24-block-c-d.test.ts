// Wave-24 Block C + Block D contract tests.
//
// Companion to wave-24-block-b.test.ts. The B block tested the four
// regression reverts; this file pins down the contract for the new /
// widened endpoints in Block C (hash-chain continuity) and Block D
// (workflow gaps). One describe per W24 item so a failure unambiguously
// names which acceptance item regressed.

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
  // Risk / treatment side
  risk: { id: "id", orgId: "orgId", deletedAt: "deletedAt" },
  riskTreatment: {
    id: "id",
    orgId: "orgId",
    riskId: "riskId",
    deletedAt: "deletedAt",
    workItemId: "workItemId",
    responsibleId: "responsibleId",
  },
  // Vendor / TPRM side
  vendor: {
    id: "id",
    name: "name",
    orgId: "orgId",
    deletedAt: "deletedAt",
    tier: "tier",
    category: "category",
    status: "status",
    country: "country",
    inherentRiskScore: "inherentRiskScore",
    residualRiskScore: "residualRiskScore",
    lastAssessmentDate: "lastAssessmentDate",
    nextAssessmentDate: "nextAssessmentDate",
    doraCriticalIct: "doraCriticalIct",
    isLksgRelevant: "isLksgRelevant",
    lksgTier: "lksgTier",
    lksgTier1: "lksgTier1",
  },
  vendorRiskAssessment: {
    id: "id",
    vendorId: "vendorId",
    orgId: "orgId",
    assessmentDate: "assessmentDate",
    inherentRiskScore: "inherentRiskScore",
    residualRiskScore: "residualRiskScore",
    confidentialityScore: "confidentialityScore",
    integrityScore: "integrityScore",
    availabilityScore: "availabilityScore",
    complianceScore: "complianceScore",
    financialScore: "financialScore",
    reputationScore: "reputationScore",
    riskTrend: "riskTrend",
    notes: "notes",
  },
  vendorConcentrationAnalysis: {
    orgId: "orgId",
    analysisType: "analysisType",
    analysisDate: "analysisDate",
  },
  contract: {
    vendorId: "vendorId",
    orgId: "orgId",
    deletedAt: "deletedAt",
    annualValue: "annualValue",
    status: "status",
  },
  // Audit side
  audit: { id: "id", orgId: "orgId", deletedAt: "deletedAt" },
  // workItem (treatment PUT uses it)
  workItem: { id: "id" },
  userOrganizationRole: {
    userId: "userId",
    orgId: "orgId",
    deletedAt: "deletedAt",
  },
  auditLog: {},
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

vi.mock("@/lib/api-errors", () => ({
  getRequestId: () => "test-req-id",
}));

vi.mock("@/lib/param-validation", () => ({
  requireUuidParam: () => undefined,
}));

vi.mock("@grc/shared", () => ({
  computeHHI: () => 0.5,
  classifyHHI: () => "low",
  updateRiskTreatmentSchema: {
    safeParse: (data: unknown) => ({ success: true, data }),
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
    inArray: noop,
    ilike: noop,
    or: noop,
    sql: Object.assign(
      (strings: TemplateStringsArray, ...vals: unknown[]) => ({
        sql: strings.raw,
        vals,
      }),
      {
        join: (parts: unknown[], _sep: unknown) => ({ join: parts }),
      },
    ),
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
// C1 — Hash-chain v3 continuity
// ───────────────────────────────────────────────────────────────

describe("W24-C1: GET /api/v1/audit-log/integrity/continuity", () => {
  it("returns 200 + monolithic_v3 claim when only v3 rows exist", async () => {
    withAuthMock.mockResolvedValue(authedCtx("ciso"));
    // gatherVersionDistribution → v3 only
    mockDb.execute
      .mockResolvedValueOnce([{ hash_version: 3, count: 100 }])
      // gatherMigrationAnchors → none (no entries yet)
      .mockResolvedValueOnce([])
      // FreeTSA anchors query (the inner try)
      .mockResolvedValueOnce([]);

    const { GET } =
      await import("../../app/api/v1/audit-log/integrity/continuity/route");
    const res = await GET(
      new Request("http://localhost/api/v1/audit-log/integrity/continuity"),
      undefined as never,
    );
    expect(res.status).toBe(200);
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "auditor",
      "ciso",
      "compliance_officer",
    );
    const body = (await res.json()) as {
      data: {
        continuityClaim: string;
        totalContinuityValid: boolean;
        versionDistribution: { v3: number };
      };
    };
    expect(body.data.continuityClaim).toBe("monolithic_v3");
    expect(body.data.totalContinuityValid).toBe(true);
    expect(body.data.versionDistribution.v3).toBe(100);
  });

  it("returns 503 with unmigrated claim when legacy rows exist without anchor", async () => {
    withAuthMock.mockResolvedValue(authedCtx("admin"));
    mockDb.execute
      .mockResolvedValueOnce([
        { hash_version: 2, count: 500 },
        { hash_version: 3, count: 1000 },
      ])
      .mockResolvedValueOnce([]) // no migration anchors
      .mockResolvedValueOnce([]); // no freetsa anchors

    const { GET } =
      await import("../../app/api/v1/audit-log/integrity/continuity/route");
    const res = await GET(
      new Request("http://localhost/api/v1/audit-log/integrity/continuity"),
      undefined as never,
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      data: { continuityClaim: string; totalContinuityValid: boolean };
    };
    expect(body.data.continuityClaim).toBe("unmigrated");
    expect(body.data.totalContinuityValid).toBe(false);
  });

  it("rejects non-auditor roles with 403", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { GET } =
      await import("../../app/api/v1/audit-log/integrity/continuity/route");
    const res = await GET(
      new Request("http://localhost/api/v1/audit-log/integrity/continuity"),
      undefined as never,
    );
    expect(res.status).toBe(403);
  });
});

// ───────────────────────────────────────────────────────────────
// D1 — process_owner can PUT treatments
// ───────────────────────────────────────────────────────────────

describe("W24-D1: PUT /api/v1/risks/{id}/treatments/{tid}", () => {
  it("allows process_owner + control_owner + risk_manager + admin", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { PUT } =
      await import("../../app/api/v1/risks/[id]/treatments/[treatmentId]/route");
    await PUT(
      new Request("http://localhost/x", {
        method: "PUT",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "r1", treatmentId: "t1" }) },
    );
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "process_owner",
      "control_owner",
    );
  });

  it("DELETE uses the same widened role list", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { DELETE } =
      await import("../../app/api/v1/risks/[id]/treatments/[treatmentId]/route");
    await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ id: "r1", treatmentId: "t1" }),
    });
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "process_owner",
      "control_owner",
    );
  });
});

// ───────────────────────────────────────────────────────────────
// D2 — vendor risk-assessments POST RBAC + alias
// ───────────────────────────────────────────────────────────────

describe("W24-D2: POST /api/v1/vendors/{id}/risk-assessments", () => {
  it("allows vendor_manager + contract_manager + risk_manager + admin", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } =
      await import("../../app/api/v1/vendors/[id]/risk-assessments/route");
    await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "v1" }) },
    );
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "vendor_manager",
      "contract_manager",
    );
  });

  it("alias /vendors/{id}/assessments re-exports the canonical handler", async () => {
    const canonical =
      await import("../../app/api/v1/vendors/[id]/risk-assessments/route");
    const alias =
      await import("../../app/api/v1/vendors/[id]/assessments/route");
    expect(alias.POST).toBe(canonical.POST);
    expect(alias.GET).toBe(canonical.GET);
  });
});

// ───────────────────────────────────────────────────────────────
// D3 — vendor risk-profile aggregator
// ───────────────────────────────────────────────────────────────

describe("W24-D3: GET /api/v1/vendors/{id}/risk-profile", () => {
  beforeEach(() => {
    withAuthMock.mockResolvedValue(authedCtx());
  });

  it("404 when vendor not in org", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { GET } =
      await import("../../app/api/v1/vendors/[id]/risk-profile/route");
    const res = await GET(
      new Request("http://localhost/api/v1/vendors/v1/risk-profile"),
      { params: Promise.resolve({ id: "v1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns aggregated payload with riskBand + flags", async () => {
    // Three sequential .select calls: vendor row → latestAssessment → contractSummary
    let call = 0;
    mockDb.select.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return chainable([
          {
            id: "v1",
            name: "Acme",
            tier: "critical",
            category: "saas",
            status: "active",
            country: "DE",
            inherentRiskScore: 75,
            residualRiskScore: 50,
            lastAssessmentDate: "2026-01-15",
            nextAssessmentDate: "2027-01-15",
            doraCriticalIct: true,
            isLksgRelevant: true,
            lksgTier: "tier_1",
            lksgTier1: true,
          },
        ]);
      }
      if (call === 2) {
        return chainable([
          {
            id: "a1",
            assessmentDate: "2026-01-15",
            inherentRiskScore: 75,
            residualRiskScore: 50,
            confidentialityScore: 4,
            integrityScore: 3,
            availabilityScore: 5,
            complianceScore: 4,
            financialScore: 3,
            reputationScore: 4,
            riskTrend: "stable",
            notes: null,
          },
        ]);
      }
      // contractSummary
      return chainable([{ count: 3, totalAnnualValue: "150000" }]);
    });

    const { GET } =
      await import("../../app/api/v1/vendors/[id]/risk-profile/route");
    const res = await GET(
      new Request("http://localhost/api/v1/vendors/v1/risk-profile"),
      { params: Promise.resolve({ id: "v1" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        vendor: { name: string };
        riskBand: string;
        latestAssessment: { id: string };
        contracts: { count: number; totalAnnualValue: number };
        flags: { doraCriticalIct: boolean };
      };
    };
    expect(body.data.vendor.name).toBe("Acme");
    expect(body.data.riskBand).toBe("medium"); // 50 → 34..66 = medium
    expect(body.data.latestAssessment.id).toBe("a1");
    expect(body.data.contracts.count).toBe(3);
    expect(body.data.contracts.totalAnnualValue).toBe(150000);
    expect(body.data.flags.doraCriticalIct).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// D4 — tprm/concentration RBAC widening
// ───────────────────────────────────────────────────────────────

describe("W24-D4: GET /api/v1/tprm/concentration", () => {
  it("allows vendor_manager + contract_manager + ciso + risk_manager + admin", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../../app/api/v1/tprm/concentration/route");
    await GET(
      new Request("http://localhost/api/v1/tprm/concentration"),
      undefined as never,
    );
    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "risk_manager",
      "vendor_manager",
      "contract_manager",
      "ciso",
    );
  });
});

// ───────────────────────────────────────────────────────────────
// D5 — audit-activity schema discovery
// ───────────────────────────────────────────────────────────────

describe("W24-D5: GET /api/v1/audit-mgmt/audits/{id}/activities/schema", () => {
  beforeEach(() => {
    withAuthMock.mockResolvedValue(authedCtx());
  });

  it("returns schema fields + example body when audit exists", async () => {
    mockDb.select.mockReturnValue(chainable([{ id: "a1" }]));
    const { GET } =
      await import("../../app/api/v1/audit-mgmt/audits/[id]/activities/schema/route");
    const res = await GET(
      new Request(
        "http://localhost/api/v1/audit-mgmt/audits/a1/activities/schema",
      ),
      { params: Promise.resolve({ id: "a1" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        endpoint: string;
        method: string;
        fields: { activityType: { required: boolean } };
        example: { activityType: string };
      };
    };
    expect(body.data.method).toBe("POST");
    expect(body.data.fields.activityType.required).toBe(true);
    expect(body.data.example.activityType).toBeTruthy();
  });

  it("returns 404 when audit not found", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { GET } =
      await import("../../app/api/v1/audit-mgmt/audits/[id]/activities/schema/route");
    const res = await GET(
      new Request(
        "http://localhost/api/v1/audit-mgmt/audits/a1/activities/schema",
      ),
      { params: Promise.resolve({ id: "a1" }) },
    );
    expect(res.status).toBe(404);
  });
});

// ───────────────────────────────────────────────────────────────
// D6 — ESG measurement schema discovery
// ───────────────────────────────────────────────────────────────

describe("W24-D6: GET /api/v1/esg/measurements/schema", () => {
  it("returns schema with required metricId/periodStart/periodEnd/value", async () => {
    withAuthMock.mockResolvedValue(authedCtx("esg_manager"));
    const { GET } =
      await import("../../app/api/v1/esg/measurements/schema/route");
    const res = await GET(
      new Request("http://localhost/api/v1/esg/measurements/schema"),
      undefined as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        method: string;
        fields: {
          metricId: { required: boolean };
          periodStart: { required: boolean };
          periodEnd: { required: boolean };
          value: { required: boolean };
        };
        example: { metricId: string; value: number };
      };
    };
    expect(body.data.method).toBe("POST");
    expect(body.data.fields.metricId.required).toBe(true);
    expect(body.data.fields.periodStart.required).toBe(true);
    expect(body.data.fields.periodEnd.required).toBe(true);
    expect(body.data.fields.value.required).toBe(true);
    expect(body.data.example.metricId).toBeTruthy();
  });

  it("returns 404 when ESG module disabled", async () => {
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const { GET } =
      await import("../../app/api/v1/esg/measurements/schema/route");
    const res = await GET(
      new Request("http://localhost/api/v1/esg/measurements/schema"),
      undefined as never,
    );
    expect(res.status).toBe(404);
  });
});

// ───────────────────────────────────────────────────────────────
// A1 — CLOSED 2026-05-21
// ───────────────────────────────────────────────────────────────
//
// The five-wave-stale finding-FK persistence bug was finally
// resolved when the Wave-24 deploy carried the post-Wave-22
// finding insert code (route.ts:166–169) to production. Verified
// via direct POST /api/v1/findings round-trip on prod
// (controlId persisted through to GET).
//
// The diagnostic endpoint at /api/v1/_debug/finding-insert-trace
// was never reachable: `_<name>` folders are Next.js App Router
// "private folders" that get silently excluded from routing —
// same trap that bit Wave-23.3 with `_meta`. We discovered this
// while trying to wire up the trace; by the time the fix would
// have been to rename `_debug → debug-trace`, the direct POST
// /findings test had already confirmed A1 was already fixed by
// the deploy itself.
//
// The endpoint + tests are removed in this commit. If a similar
// "FKs go missing" symptom returns, write a new diagnostic route
// at a NON-underscore-prefixed path.
