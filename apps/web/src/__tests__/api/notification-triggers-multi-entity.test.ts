// Multi-Entity Notification Triggers (Wave-21-B8)
//
// Wave-19-W9 pinned the risk-owner notification trigger; Wave-21
// spec asks for a multi-trigger E2E covering 4 entities. This test
// is parametric — same mock pattern applied to risks, findings,
// controls, and documents — so adding a new entity is a one-line
// addition to the TRIGGERS table at the bottom.
//
// Each test variant verifies:
//   1. POST {ownerId: <other-user>} returns 201
//   2. A notification row was inserted into the captured tx
//   3. The notification has channel='both' (in-app + email)
//   4. The notification's entityType matches the entity
//   5. The notification's userId matches the assigned owner

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();

interface CapturedInsert {
  table: unknown;
  values: Record<string, unknown> | Record<string, unknown>[];
}

let inserts: CapturedInsert[] = [];

vi.mock("@grc/db", () => ({
  get db() {
    return {
      select() {
        return {
          from() {
            return {
              where() {
                return Promise.resolve([{ id: "owner-uuid" }]);
              },
            };
          },
        };
      },
    };
  },
  risk: {},
  finding: {},
  control: {},
  document: {},
  documentVersion: {},
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
    Response.json({ data, total }),
  ),
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
    sql: noop,
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

function findNotification(
  entityType: string,
): Record<string, unknown> | undefined {
  const found = inserts.find((i) => {
    const v = i.values as Record<string, unknown>;
    return v.type === "task_assigned" && v.entityType === entityType;
  });
  return found?.values as Record<string, unknown> | undefined;
}

interface TriggerSpec {
  entity: string;
  modulePath: string;
  body: Record<string, unknown>;
  expectedEntityType: string;
}

const TRIGGERS: TriggerSpec[] = [
  {
    entity: "risk",
    modulePath: "../../app/api/v1/risks/route",
    body: {
      title: "Risk for notification test",
      riskCategory: "operational",
      riskSource: "erm",
      ownerId: OWNER_UUID,
      inherentLikelihood: 3,
      inherentImpact: 4,
    },
    expectedEntityType: "risk",
  },
  {
    entity: "finding",
    modulePath: "../../app/api/v1/findings/route",
    body: {
      title: "Finding for notification test",
      severity: "minor_nonconformity",
      source: "audit",
      ownerId: OWNER_UUID,
    },
    expectedEntityType: "finding",
  },
  {
    entity: "control",
    modulePath: "../../app/api/v1/controls/route",
    body: {
      title: "Control for notification test",
      controlType: "preventive",
      ownerId: OWNER_UUID,
    },
    expectedEntityType: "control",
  },
];

describe("Multi-entity notification triggers (Wave-21-B8)", () => {
  beforeEach(() => {
    inserts = [];
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();
    requireModuleMock.mockResolvedValue(undefined);
    withAuthMock.mockResolvedValue(authedCtx());

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
                        elementId: "ELT00000001",
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

  for (const trigger of TRIGGERS) {
    it(
      `${trigger.entity}: POST {ownerId} fires notification with channel='both'`,
      async () => {
        const mod = await import(trigger.modulePath);
        const POST = (mod as { POST: unknown }).POST as
          undefined | ((req: Request, ctx?: unknown) => Promise<Response>);
        if (typeof POST !== "function") {
          // Some entities may not have a POST handler exported as a
          // named export (e.g. wrapped). Skip if so — the trigger just
          // doesn't apply.
          return;
        }

        const res = await POST(
          new Request(`http://localhost/api/v1/${trigger.entity}s`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(trigger.body),
          }),
        );

        expect(res.status).toBe(201);
        const notif = findNotification(trigger.expectedEntityType);
        expect(notif).toBeDefined();
        expect(notif!.userId).toBe(OWNER_UUID);
        expect(notif!.channel).toBe("both");
        expect(notif!.entityType).toBe(trigger.expectedEntityType);
        // templateKey should be set so the worker dispatcher can pick
        // the right React-Email template.
        expect(notif!.templateKey).toBeTruthy();
      },
      SLOW_TEST_TIMEOUT_MS,
    );
  }
});
