// Notification trigger contract — owner-assignment fires an in-app
// notification + queues an email (channel: 'both').
//
// #WAVE19-W9: Wave-19 spec wants live trigger verification — i.e.
// when a risk is created with an `ownerId`, an entry must land in the
// `notification` table with channel='both', so the worker's
// notification-dispatcher will pick it up + send the email. The
// email-template render path is already smoke-tested in
// packages/email/tests/template-render-smoke.test.ts (25 templates ×
// 2 langs). This test pins the API → notification-table contract,
// which is the bridge between the two.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();

interface CapturedInsert {
  table: unknown;
  values: Record<string, unknown> | Record<string, unknown>[];
}

let inserts: CapturedInsert[] = [];
// Owner-validation lookup short-circuits to "found".
let ownerLookupRows: unknown[] = [{ id: "owner-uuid" }];

vi.mock("@grc/db", () => ({
  get db() {
    return {
      select() {
        return {
          from() {
            return {
              where() {
                return Promise.resolve(ownerLookupRows);
              },
            };
          },
        };
      },
    };
  },
  risk: {},
  workItem: {},
  user: {},
  userOrganizationRole: {
    userId: "userId",
    orgId: "orgId",
    deletedAt: "deletedAt",
  },
  notification: { tableName: "notification" },
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

vi.mock("@/lib/logger", () => ({
  log: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
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
    gte: noop,
    lte: noop,
    or: noop,
  };
});

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const OWNER_UUID = "22222222-2222-2222-2222-222222222222";

const SLOW_TEST_TIMEOUT_MS = 15_000;

function authedCtx() {
  return {
    session: { user: { id: VALID_UUID } },
    orgId: VALID_UUID,
    userId: VALID_UUID,
  };
}

describe("Notification trigger — risk-owner-assigned (Wave-19-W9)", () => {
  beforeEach(() => {
    inserts = [];
    ownerLookupRows = [{ id: OWNER_UUID }];
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();

    requireModuleMock.mockResolvedValue(undefined);
    withAuthMock.mockResolvedValue(authedCtx());

    // Capture every tx.insert(table).values(...) call so the test asserts
    // can inspect what actually got written.
    withAuditContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          insert(table: unknown) {
            return {
              values(values: Record<string, unknown>) {
                inserts.push({ table, values });
                return {
                  returning() {
                    return Promise.resolve([
                      {
                        id: VALID_UUID,
                        elementId: "RSK00000001",
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
    "POST /risks {ownerId: <other-user>} inserts a notification row with channel:'both'",
    async () => {
      const { POST } = await import("../../app/api/v1/risks/route");
      // POST is wrapped with withErrorHandler which has a (req, ctx)
      // signature; flat (non-dynamic) routes pass undefined for ctx.
      const res = await (
        POST as (req: Request, ctx?: unknown) => Promise<Response>
      )(
        new Request("http://localhost/api/v1/risks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Cross-tenant data leak risk",
            description: "Discovered during pen-test",
            riskCategory: "operational",
            riskSource: "erm",
            ownerId: OWNER_UUID,
            inherentLikelihood: 3,
            inherentImpact: 4,
          }),
        }),
      );

      expect(res.status).toBe(201);
      // We expect THREE inserts: workItem, risk, notification.
      expect(inserts.length).toBeGreaterThanOrEqual(3);

      const notif = inserts.find((i) => {
        const v = i.values as Record<string, unknown>;
        return v.type === "task_assigned" && v.entityType === "risk";
      });
      expect(notif).toBeDefined();

      const v = notif!.values as Record<string, unknown>;
      expect(v.userId).toBe(OWNER_UUID);
      // 'both' = in-app AND email — the worker dispatcher reads this.
      expect(v.channel).toBe("both");
      expect(v.templateKey).toBe("risk_owner_assigned");
      // Template data must include the IDs the React-Email template needs.
      const td = v.templateData as Record<string, unknown>;
      expect(td.riskTitle).toBe("Cross-tenant data leak risk");
      expect(td.riskId).toBeTruthy();
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "POST /risks {ownerId: <self>} does NOT create a self-notification",
    async () => {
      // ownerId == ctx.userId — the route deliberately skips notifying
      // someone who's assigning a risk to themselves.
      const SELF = VALID_UUID;
      ownerLookupRows = [{ id: SELF }];

      const { POST } = await import("../../app/api/v1/risks/route");
      // POST is wrapped with withErrorHandler which has a (req, ctx)
      // signature; flat (non-dynamic) routes pass undefined for ctx.
      const res = await (
        POST as (req: Request, ctx?: unknown) => Promise<Response>
      )(
        new Request("http://localhost/api/v1/risks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Self-assigned risk",
            riskCategory: "operational",
            riskSource: "erm",
            ownerId: SELF,
          }),
        }),
      );

      expect(res.status).toBe(201);
      const notif = inserts.find((i) => {
        const v = i.values as Record<string, unknown>;
        return v.type === "task_assigned";
      });
      expect(notif).toBeUndefined();
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "POST /risks {ownerId: <not-in-org>} returns 422 — no notification leak",
    async () => {
      // Owner-validation lookup returns empty → 422 "Owner not found in
      // this organization". No notification row should land.
      ownerLookupRows = [];

      const { POST } = await import("../../app/api/v1/risks/route");
      // POST is wrapped with withErrorHandler which has a (req, ctx)
      // signature; flat (non-dynamic) routes pass undefined for ctx.
      const res = await (
        POST as (req: Request, ctx?: unknown) => Promise<Response>
      )(
        new Request("http://localhost/api/v1/risks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Risk with bogus owner",
            riskCategory: "operational",
            riskSource: "erm",
            ownerId: "deadbeef-dead-beef-dead-beefdeadbeef",
          }),
        }),
      );

      expect(res.status).toBe(422);
      // No inserts at all — the validation 422 short-circuits before the
      // audit-wrapped transaction.
      expect(inserts.length).toBe(0);
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});
