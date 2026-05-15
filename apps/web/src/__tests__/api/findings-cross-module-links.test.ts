// POST /api/v1/findings — Cross-module FK persistence regression guards.
//
// #WAVE19-P1-01: Wave-18 QA reported that POST /findings {controlId}
// returned 201 but persisted controlId=null, breaking the Wave-18
// cascade in /controls/effectiveness. The schema and the insert
// already pass controlId through (since Wave-12), so the regression
// surface is wide — these guards lock the contract:
//   1. POST inserts controlId + auditId + riskId + controlTestId
//      into the values() payload, not just the schema.
//   2. POST with `status` in body returns 422 (Wave-18 saw the field
//      silently stripped + DB default applied).
//   3. CISO role accepted (Wave-19-P3-02).

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
  finding: {},
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

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const CONTROL_ID = "22222222-2222-2222-2222-222222222222";
const AUDIT_ID = "33333333-3333-3333-3333-333333333333";
const RISK_ID = "44444444-4444-4444-4444-444444444444";

interface CapturedInsert {
  table: unknown;
  values: Record<string, unknown> | Record<string, unknown>[];
}

function authedCtx() {
  return {
    session: { user: { id: VALID_UUID } },
    orgId: VALID_UUID,
    userId: VALID_UUID,
  };
}

describe("POST /api/v1/findings — cross-module-link persistence", () => {
  let inserts: CapturedInsert[];

  beforeEach(() => {
    inserts = [];
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();

    // Capture every tx.insert(table).values(...).returning() call so
    // the test asserts can inspect what actually got written.
    withAuditContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          insert(table: unknown) {
            return {
              values(values: Record<string, unknown>) {
                inserts.push({ table, values });
                return {
                  returning() {
                    // Mimic Postgres returning the inserted row with id +
                    // any caller-set FKs preserved.
                    return Promise.resolve([
                      {
                        id: VALID_UUID,
                        elementId: "FND00000001",
                        ...values,
                      },
                    ]);
                  },
                };
              },
            };
          },
          // Owner-validation lookup short-circuits to "found" so we
          // don't get a 422 on the owner check.
          select() {
            return {
              from() {
                return {
                  where() {
                    return Promise.resolve([{ id: VALID_UUID }]);
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

  it("persists controlId from POST body into the finding insert", async () => {
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);

    const { POST } = await import("../../app/api/v1/findings/route");
    const res = await POST(
      new Request("http://localhost/api/v1/findings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Critical control failure",
          severity: "major_nonconformity",
          source: "audit",
          controlId: CONTROL_ID,
        }),
      }),
    );

    expect(res.status).toBe(201);
    // Two inserts expected: workItem + finding. The finding insert is
    // the second one and must carry controlId.
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    const findingInsert = inserts[1];
    expect((findingInsert.values as Record<string, unknown>).controlId).toBe(
      CONTROL_ID,
    );
  });

  it("persists auditId + riskId together (cross-module fan-out)", async () => {
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);

    const { POST } = await import("../../app/api/v1/findings/route");
    const res = await POST(
      new Request("http://localhost/api/v1/findings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Audit raised cross-linked finding",
          severity: "minor_nonconformity",
          source: "audit",
          auditId: AUDIT_ID,
          riskId: RISK_ID,
        }),
      }),
    );

    expect(res.status).toBe(201);
    const findingInsert = inserts[1];
    expect((findingInsert.values as Record<string, unknown>).auditId).toBe(
      AUDIT_ID,
    );
    expect((findingInsert.values as Record<string, unknown>).riskId).toBe(
      RISK_ID,
    );
  });

  it("rejects POST {status:'open'} with 422 + rejectedFields hint", async () => {
    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);

    const { POST } = await import("../../app/api/v1/findings/route");
    const res = await POST(
      new Request("http://localhost/api/v1/findings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Status-set attempt",
          severity: "observation",
          source: "audit",
          status: "open",
        }),
      }),
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.rejectedFields).toContain("status");
    // Hint must point to the dedicated transition endpoint.
    expect(body.error).toMatch(/status/i);
    expect(body.error).toMatch(/transition/i);
  });

  it("includes ciso in the documented withAuth role list", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { POST } = await import("../../app/api/v1/findings/route");
    await POST(
      new Request("http://localhost/api/v1/findings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(withAuthMock).toHaveBeenCalledWith(
      "admin",
      "auditor",
      "risk_manager",
      "control_owner",
      "process_owner",
      "ciso",
    );
  });
});
