// POST /api/v1/risks — webhook fan-out emission contract (2026-07-10).
//
// Verifies the two guarantees of the fan-out wiring:
//   1. a successful create emits entity.created via @/lib/entity-events
//      (which lazily bootstraps the @grc/events bus + enqueue handler);
//   2. a throwing emission NEVER fails the request — the 201 stands.
//
// Pattern follows risks-create-rbac.test.ts (withAuth / requireModule /
// withAuditContext mocked; @grc/events mocked so no real bus/DB runs).

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  makeMockDb,
  makeRequest,
  chainable,
  DEFAULT_AUTH_CTX,
  type MockDb,
} from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();

const emitEntityCreatedMock = vi.fn();
const registerWebhookEnqueueHandlerMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  risk: {},
  workItem: {},
  user: {},
  userOrganizationRole: {
    userId: "userId",
    orgId: "orgId",
    deletedAt: "deletedAt",
  },
  riskAppetite: {},
  notification: {},
}));

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
  },
}));

// The route's fire-and-forget wrapper (@/lib/entity-events) dynamically
// imports @grc/events — vitest intercepts dynamic imports too.
vi.mock("@grc/events", () => ({
  get emitEntityCreated() {
    return emitEntityCreatedMock;
  },
  emitEntityUpdated: vi.fn(),
  emitEntityDeleted: vi.fn(),
  emitEntityStatusChanged: vi.fn(),
  get registerWebhookEnqueueHandler() {
    return registerWebhookEnqueueHandlerMock;
  },
  eventBus: { emitEvent: vi.fn(), onEvent: vi.fn(), offEvent: vi.fn() },
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
    sql: noop,
    ilike: noop,
    gte: noop,
    lte: noop,
    or: noop,
  };
});

const RISK_ID = "b1b2c3d4-e5f6-4789-9abc-def012345678";

function makeBody() {
  return {
    title: "Fan-out test risk",
    riskCategory: "operational",
    riskSource: "erm",
  };
}

function setupSuccessfulCreate() {
  withAuthMock.mockResolvedValue(DEFAULT_AUTH_CTX);
  requireModuleMock.mockResolvedValue(null);
  // withAuditContext runs the callback against the mock db as tx.
  withAuditContextMock.mockImplementation(
    async (_ctx: unknown, cb: (tx: MockDb) => Promise<unknown>) => cb(mockDb),
  );
  // 1st insert: work item; 2nd insert: risk row.
  mockDb.insert
    .mockReturnValueOnce(chainable([{ id: "wi-1", elementId: "RSK00000001" }]))
    .mockReturnValueOnce(
      chainable([{ id: RISK_ID, title: "Fan-out test risk" }]),
    );
}

describe("POST /api/v1/risks — entity.created emission", () => {
  beforeAll(async () => {
    await import("../../app/api/v1/risks/route");
  }, 90_000);

  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();
    emitEntityCreatedMock.mockReset();
    registerWebhookEnqueueHandlerMock.mockReset();
  });

  it("emits entity.created after a successful create", async () => {
    setupSuccessfulCreate();
    const { POST } = await import("../../app/api/v1/risks/route");

    const res = await POST(
      makeRequest("http://test/api/v1/risks", {
        method: "POST",
        body: makeBody(),
      }),
      undefined,
    );

    expect(res.status).toBe(201);

    // Emission is fire-and-forget behind a dynamic import — wait for it.
    await vi.waitFor(() => {
      expect(emitEntityCreatedMock).toHaveBeenCalledTimes(1);
    });
    expect(emitEntityCreatedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: DEFAULT_AUTH_CTX.orgId,
        userId: DEFAULT_AUTH_CTX.userId,
        entityType: "risk",
        entityId: RISK_ID,
        data: expect.objectContaining({ id: RISK_ID }),
      }),
    );
    // Bus bootstrap ran before the emission.
    expect(registerWebhookEnqueueHandlerMock).toHaveBeenCalled();
  });

  it("still returns 201 when the emission throws", async () => {
    setupSuccessfulCreate();
    emitEntityCreatedMock.mockImplementation(() => {
      throw new Error("event bus exploded");
    });
    const { POST } = await import("../../app/api/v1/risks/route");

    const res = await POST(
      makeRequest("http://test/api/v1/risks", {
        method: "POST",
        body: makeBody(),
      }),
      undefined,
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { id: string } };
    expect(json.data.id).toBe(RISK_ID);

    await vi.waitFor(() => {
      expect(emitEntityCreatedMock).toHaveBeenCalledTimes(1);
    });
  });
});
