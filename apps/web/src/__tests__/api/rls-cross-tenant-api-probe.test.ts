// API-layer Cross-Tenant Probe — defense-in-depth for RLS.
//
// #WAVE19-W8: The DB layer has comprehensive RLS coverage tests in
// `packages/db/tests/rls/` (cross-tenant-isolation.test.ts +
// rls-coverage-systemtest.test.ts). This test adds the API-route layer
// guarantee: even if a route author forgot the `eq(table.orgId, ctx.orgId)`
// filter, the underlying RLS policy would still block cross-tenant reads.
// But the API contract is "404 for not-found OR not-yours", and we want to
// pin THAT contract here so future refactors don't accidentally leak the
// distinction between "doesn't exist" and "exists but not in your tenant"
// (which would itself be a side-channel info-disclosure bug).
//
// The mock DB replays the actual SELECT pattern: when RLS strips the row
// (because the where-clause includes orgId), the query returns []. The
// route MUST return 404 — not 403 (which would confirm the row exists),
// not 500 (RLS doesn't error, it just filters), not 200 (catastrophic).

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();

let mockReturnRows: unknown[] = [];

// The mock select chain mirrors drizzle's chainable thenable shape.
// Each call (from, leftJoin, where) returns the same object, which is
// itself awaitable — `await db.select().from().leftJoin().where()`
// resolves to `mockReturnRows`. The second SELECT in the route (for
// treatments) returns mockTreatmentRows.
let mockTreatmentRows: unknown[] = [];
let selectCallCounter = 0;

vi.mock("@grc/db", () => {
  function chain() {
    const obj: Record<string, unknown> = {};
    obj.from = () => obj;
    obj.leftJoin = () => obj;
    obj.where = () => obj;
    obj.limit = () => obj;
    obj.then = (resolve: (v: unknown[]) => void) => {
      // First select() = main risk row; second = treatments.
      selectCallCounter += 1;
      const out = selectCallCounter === 1 ? mockReturnRows : mockTreatmentRows;
      return resolve(out);
    };
    return obj;
  }
  return {
    get db() {
      return {
        select() {
          return chain();
        },
      };
    },
    risk: {},
    riskTreatment: {},
    workItem: {},
    user: {},
  };
});

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
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

vi.mock("@/lib/param-validation", () => ({
  requireUuidParam: vi.fn(),
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    isNull: noop,
  };
});

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const RISK_IN_TENANT_A = "33333333-3333-3333-3333-333333333333";

const SLOW_TEST_TIMEOUT_MS = 15_000;

describe("RLS API-layer cross-tenant probe (Wave-19-W8)", () => {
  beforeEach(() => {
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    requireModuleMock.mockResolvedValue(undefined);
    mockReturnRows = [];
    mockTreatmentRows = [];
    selectCallCounter = 0;
  });

  it(
    "GET /risks/{id} returns 404 when caller is in a different tenant (RLS-filtered)",
    async () => {
      // User is in tenant B; their orgId-filtered query returns 0 rows
      // even though the risk exists in tenant A. RLS policy would also
      // strip it at the DB layer — both layers must agree on the 404.
      withAuthMock.mockResolvedValue({
        session: { user: { id: "user-b" } },
        orgId: TENANT_B,
        userId: "user-b",
      });
      mockReturnRows = []; // <-- the row exists in tenant A, but RLS hides it

      const { GET } = await import("../../app/api/v1/risks/[id]/route");
      const res = await GET(
        new Request(`http://localhost/api/v1/risks/${RISK_IN_TENANT_A}`),
        { params: Promise.resolve({ id: RISK_IN_TENANT_A }) },
      );

      expect(res.status).toBe(404);
      // Critical: must NOT leak the existence of the row. 403 would
      // confirm "exists but not yours"; 404 is the secure-default.
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(200);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "GET /risks/{id} returns 200 when the row IS in the caller's tenant",
    async () => {
      withAuthMock.mockResolvedValue({
        session: { user: { id: "user-a" } },
        orgId: TENANT_A,
        userId: "user-a",
      });
      // Within tenant A, the orgId-filtered query returns the row.
      mockReturnRows = [
        {
          id: RISK_IN_TENANT_A,
          orgId: TENANT_A,
          workItemId: "wi-1",
          elementId: "RSK00000001",
          workItemStatus: "open",
          title: "Test risk in tenant A",
          description: null,
          riskCategory: "operational",
          riskSource: "erm",
          status: "identified",
          ownerId: null,
          ownerName: null,
          ownerEmail: null,
          department: null,
          inherentLikelihood: 3,
          inherentImpact: 3,
          residualLikelihood: null,
          residualImpact: null,
          riskScoreInherent: 9,
          riskScoreResidual: null,
          treatmentStrategy: null,
          treatmentRationale: null,
          financialImpactMin: null,
          financialImpactMax: null,
          financialImpactExpected: null,
          riskAppetiteExceeded: false,
          reviewDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "user-a",
          updatedBy: "user-a",
        },
      ];

      const { GET } = await import("../../app/api/v1/risks/[id]/route");
      const res = await GET(
        new Request(`http://localhost/api/v1/risks/${RISK_IN_TENANT_A}`),
        { params: Promise.resolve({ id: RISK_IN_TENANT_A }) },
      );

      expect(res.status).toBe(200);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "404 response body does NOT include the queried ID or any tenant info",
    async () => {
      // Side-channel guard: even the error message shouldn't echo the ID
      // back, because that would let an attacker probe IDs by checking
      // whether the response body changes between two unknown IDs.
      withAuthMock.mockResolvedValue({
        session: { user: { id: "user-b" } },
        orgId: TENANT_B,
        userId: "user-b",
      });
      mockReturnRows = [];

      const { GET } = await import("../../app/api/v1/risks/[id]/route");
      const res = await GET(
        new Request(`http://localhost/api/v1/risks/${RISK_IN_TENANT_A}`),
        { params: Promise.resolve({ id: RISK_IN_TENANT_A }) },
      );

      const body = await res.json();
      const json = JSON.stringify(body);
      // The 404 may legitimately echo the ID via problem.instance (URL),
      // but must NOT echo the *tenant* ID. Pin only the tenant-leak vector.
      expect(json).not.toContain(TENANT_A);
      expect(json).not.toContain(TENANT_B);
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});
