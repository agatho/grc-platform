// Process-Portal API — gateway + shape contract tests.
//
// Sister of risk-acceptances-rbac.test.ts for the end-user process
// portal (GET /api/v1/bpm/my-processes + /[id]). Covers the gateway
// chain (401 / 404-module) and the list shape with a mocked DB:
// role resolution (owner / RACI via custom roles), acknowledgment
// grouping data and the "no relation → filtered out" rule.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, chainable, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withReadContextMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  process: {},
  processStep: {},
  processVersion: {},
  processApprovalStep: {},
  processRaciOverride: {},
  processDocument: {},
  processControl: {},
  processRisk: {},
  document: {},
  customRole: {},
  userCustomRole: {},
  user: {},
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
  get withReadContext() {
    return withReadContextMock;
  },
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    or: noop,
    isNull: noop,
    isNotNull: noop,
    inArray: noop,
    asc: noop,
    desc: noop,
    count: noop,
    ilike: noop,
    sql: noop,
  };
});

vi.mock("drizzle-orm/pg-core", () => ({
  alias: vi.fn(() => new Proxy({}, { get: () => ({}) })),
}));

const AUTH_CTX = {
  session: { user: { id: "user-1", email: "t@example.com", name: "T" } },
  orgId: "org-1",
  userId: "user-1",
};

const OWNED_PROCESS = {
  id: "proc-1",
  name: "Employee Onboarding",
  description: null,
  department: "HR",
  currentVersion: 3,
  publishedAt: new Date("2026-06-01T08:00:00Z"),
  processOwnerId: "user-1",
  ownerName: "T",
};

const FOREIGN_PROCESS = {
  id: "proc-2",
  name: "Procurement",
  description: null,
  department: null,
  currentVersion: 1,
  publishedAt: new Date("2026-05-01T08:00:00Z"),
  processOwnerId: "user-9",
  ownerName: "Someone Else",
};

function listRequest(query = "") {
  return new Request(`http://localhost/api/v1/bpm/my-processes${query}`);
}

describe("GET /api/v1/bpm/my-processes", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withReadContextMock.mockReset();
    withReadContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: MockDb) => Promise<unknown>) => fn(mockDb),
    );
  });

  // First import transforms the route module — cold-start headroom.
  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../../app/api/v1/bpm/my-processes/route");
    const res = await GET(listRequest());
    expect(res.status).toBe(401);
    // Open to every authenticated org member — no role gate.
    expect(withAuthMock).toHaveBeenCalledWith();
  }, 20000);

  it("returns 404 when the BPM module is disabled", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const { GET } = await import("../../app/api/v1/bpm/my-processes/route");
    const res = await GET(listRequest());
    expect(res.status).toBe(404);
    expect(requireModuleMock).toHaveBeenCalledWith("bpm", "org-1", "GET");
  });

  it("returns owned processes with the owner badge", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.select
      .mockReturnValueOnce(chainable([])) // user_custom_role → none
      .mockReturnValueOnce(chainable([OWNED_PROCESS])) // published processes
      .mockReturnValueOnce(chainable([])); // acknowledgment steps
    const { GET } = await import("../../app/api/v1/bpm/my-processes/route");
    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "proc-1",
      name: "Employee Onboarding",
      currentVersion: 3,
      myRoles: ["owner"],
      acknowledgment: null,
    });
  });

  it("keeps processes with a pending acknowledgment even without any role", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.select
      .mockReturnValueOnce(chainable([])) // no custom roles
      .mockReturnValueOnce(chainable([FOREIGN_PROCESS]))
      .mockReturnValueOnce(
        chainable([
          {
            id: "ack-1",
            processId: "proc-2",
            status: "pending",
            dueDate: "2026-08-01",
            decidedAt: null,
            versionNumber: 1,
          },
        ]),
      );
    const { GET } = await import("../../app/api/v1/bpm/my-processes/route");
    const res = await GET(listRequest());
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].myRoles).toEqual([]);
    expect(body.data[0].acknowledgment).toMatchObject({
      stepId: "ack-1",
      status: "pending",
      dueDate: "2026-08-01",
    });
  });

  it("resolves RACI roles via the user's custom roles and filters unrelated processes", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.select
      .mockReturnValueOnce(chainable([{ customRoleId: "role-a" }])) // my roles
      .mockReturnValueOnce(
        chainable([
          FOREIGN_PROCESS,
          { ...OWNED_PROCESS, id: "proc-3", processOwnerId: "user-9" },
        ]),
      )
      .mockReturnValueOnce(
        chainable([
          {
            processId: "proc-2",
            raciResponsibleRoleId: "role-a",
            raciAccountableRoleId: null,
          },
        ]),
      ) // step RACI hits
      .mockReturnValueOnce(chainable([])) // overrides
      .mockReturnValueOnce(chainable([])); // acknowledgment steps
    const { GET } = await import("../../app/api/v1/bpm/my-processes/route");
    const res = await GET(listRequest());
    const body = await res.json();
    // proc-3: no role, no acknowledgment → filtered out
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("proc-2");
    expect(body.data[0].myRoles).toEqual(["R"]);
  });
});

describe("GET /api/v1/bpm/my-processes/[id]", () => {
  const params = { params: Promise.resolve({ id: "proc-1" }) };

  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withReadContextMock.mockReset();
    withReadContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: MockDb) => Promise<unknown>) => fn(mockDb),
    );
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } =
      await import("../../app/api/v1/bpm/my-processes/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/v1/bpm/my-processes/proc-1"),
      params,
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-published (or unknown) process", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    // The published filter is part of the WHERE clause — drafts resolve
    // to an empty result set exactly like unknown ids.
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { GET } =
      await import("../../app/api/v1/bpm/my-processes/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/v1/bpm/my-processes/proc-1"),
      params,
    );
    expect(res.status).toBe(404);
  });
});
