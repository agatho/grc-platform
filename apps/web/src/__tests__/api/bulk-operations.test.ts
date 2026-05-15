// Bulk Operations — Critical Implementation Rule #11 (Wave-21-B4)
//
// Wave-21 QA found that bulk-create endpoints didn't exist for the
// core entities. This test pins:
//   1. POST /risks/bulk with 50 items → 201 + created[].length === 50
//   2. POST /risks/bulk with 200 items → 422 + maxBulkSize:100, providedSize:200
//   3. POST /risks/bulk with mixed-validity items → 207 Multi-Status
//      + per-item errors[] with index pointers
//   4. The bulk helper (apps/web/src/lib/bulk.ts) walks items and
//      calls the executor per-item — so each successful row gets its
//      own audit-log hash-chain entry (the per-item withAuditContext
//      transaction provides this; the test confirms the call count).

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();
let auditCallCount = 0;

vi.mock("@grc/db", () => ({
  get db() {
    return {
      select() {
        return {
          from() {
            return {
              where() {
                // Owner-validation lookup short-circuits to "found".
                return Promise.resolve([{ id: "owner-uuid" }]);
              },
            };
          },
        };
      },
    };
  },
  risk: {},
  workItem: {},
  userOrganizationRole: {
    userId: "userId",
    orgId: "orgId",
    deletedAt: "deletedAt",
  },
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
  PaginationError: class extends Error {
    constructor(
      public field: string,
      public value: string,
      public reason: string,
    ) {
      super(`pagination: ${field}`);
    }
  },
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return { eq: noop, and: noop, isNull: noop };
});

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

const SLOW_TEST_TIMEOUT_MS = 15_000;

function authedCtx() {
  return {
    session: { user: { id: VALID_UUID } },
    orgId: VALID_UUID,
    userId: VALID_UUID,
  };
}

function makeRiskItem(overrides: Record<string, unknown> = {}) {
  return {
    title: "Bulk-created risk " + Math.random().toString(36).slice(2, 8),
    riskCategory: "operational",
    riskSource: "erm",
    inherentLikelihood: 3,
    inherentImpact: 4,
    ...overrides,
  };
}

describe("POST /api/v1/risks/bulk (Wave-21-B4)", () => {
  beforeEach(() => {
    auditCallCount = 0;
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);

    // Each item runs in its own withAuditContext call → each audit
    // call increments the counter. Test asserts the count matches
    // the number of valid items (= per-item hash-chain entries).
    withAuditContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        auditCallCount += 1;
        const tx = {
          insert(_table: unknown) {
            return {
              values(values: Record<string, unknown>) {
                return {
                  returning() {
                    return Promise.resolve([
                      {
                        id: "risk-" + auditCallCount,
                        elementId: `RSK00000${auditCallCount}`,
                        ...values,
                      },
                    ]);
                  },
                };
              },
            };
          },
        };
        return fn(tx);
      },
    );
  });

  it(
    "50 items within cap → 201 + created[].length === 50",
    async () => {
      const { POST } = await import("../../app/api/v1/risks/bulk/route");
      const items = Array.from({ length: 50 }, () => makeRiskItem());
      const res = await POST(
        new Request("http://localhost/api/v1/risks/bulk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items }),
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.created).toHaveLength(50);
      expect(body.errors).toEqual([]);
      // Each item should have triggered its own audit-wrapped transaction.
      expect(auditCallCount).toBe(50);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "200 items over cap → 422 + maxBulkSize:100, providedSize:200",
    async () => {
      const { POST } = await import("../../app/api/v1/risks/bulk/route");
      const items = Array.from({ length: 200 }, () => makeRiskItem());
      const res = await POST(
        new Request("http://localhost/api/v1/risks/bulk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items }),
        }),
      );
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.maxBulkSize).toBe(100);
      expect(body.providedSize).toBe(200);
      // Critical: not a SINGLE row got persisted — no audit entries.
      expect(auditCallCount).toBe(0);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "exactly 100 items at the cap → 201 (boundary)",
    async () => {
      const { POST } = await import("../../app/api/v1/risks/bulk/route");
      const items = Array.from({ length: 100 }, () => makeRiskItem());
      const res = await POST(
        new Request("http://localhost/api/v1/risks/bulk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items }),
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.created).toHaveLength(100);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "mixed validity (3 valid + 2 invalid) → 207 Multi-Status with per-item errors",
    async () => {
      const { POST } = await import("../../app/api/v1/risks/bulk/route");
      const items = [
        makeRiskItem(),
        makeRiskItem({ riskCategory: "not_a_real_category" }), // invalid enum
        makeRiskItem(),
        makeRiskItem({ title: "" }), // empty title
        makeRiskItem(),
      ];
      const res = await POST(
        new Request("http://localhost/api/v1/risks/bulk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items }),
        }),
      );
      expect(res.status).toBe(207);
      const body = await res.json();
      expect(body.created.length).toBe(3);
      expect(body.errors.length).toBe(2);
      // Each error includes the original index for client-side correlation.
      expect(body.errors[0].index).toBe(1);
      expect(body.errors[1].index).toBe(3);
      // 3 valid items → 3 audit calls; 2 invalid never touch the DB.
      expect(auditCallCount).toBe(3);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "empty items array → 422",
    async () => {
      const { POST } = await import("../../app/api/v1/risks/bulk/route");
      const res = await POST(
        new Request("http://localhost/api/v1/risks/bulk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: [] }),
        }),
      );
      expect(res.status).toBe(422);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "missing items field → 422",
    async () => {
      const { POST } = await import("../../app/api/v1/risks/bulk/route");
      const res = await POST(
        new Request("http://localhost/api/v1/risks/bulk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }),
      );
      expect(res.status).toBe(422);
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});
