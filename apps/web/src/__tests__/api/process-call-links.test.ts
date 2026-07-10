// Call-Activity Drill-Down:
//   GET /api/v1/processes/:id/call-links — auth gating + response shape
//   PUT /api/v1/processes/:id/steps/:stepId — self-link prohibition (422)

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  makeMockDb,
  makeRequest,
  makeParams,
  chainable,
  type MockDb,
} from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  process: {
    id: "id",
    orgId: "orgId",
    name: "name",
    status: "status",
    deletedAt: "deletedAt",
  },
  processStep: {
    id: "id",
    processId: "processId",
    orgId: "orgId",
    bpmnElementId: "bpmnElementId",
    name: "name",
    description: "description",
    stepType: "stepType",
    responsibleRole: "responsibleRole",
    sequenceOrder: "sequenceOrder",
    calledProcessId: "calledProcessId",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
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
  withAuditContext: vi.fn(
    async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn(mockDb),
  ),
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    isNull: noop,
    isNotNull: noop,
    asc: noop,
    desc: noop,
  };
});

vi.mock("drizzle-orm/pg-core", () => ({
  alias: (table: unknown) => table,
}));

const AUTH_CTX = {
  session: { user: { id: "user-1" } },
  orgId: "org-1",
  userId: "user-1",
};

const PROCESS_ID = "11111111-1111-4111-8111-111111111111";
const STEP_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PROCESS_ID = "33333333-3333-4333-8333-333333333333";

/** select() returning per-call values (first call → values[0], …). */
function mockSelectSequence(values: unknown[]) {
  let call = 0;
  mockDb.select.mockImplementation(() => {
    const value = call < values.length ? values[call] : [];
    call += 1;
    return chainable(value);
  });
}

describe("GET /api/v1/processes/:id/call-links", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import(
      "../../app/api/v1/processes/[id]/call-links/route"
    );
    const res = await GET(
      makeRequest(`http://localhost/api/v1/processes/${PROCESS_ID}/call-links`),
      { params: makeParams({ id: PROCESS_ID }) },
    );
    expect(res.status).toBe(401);
    // GET is open to all authenticated org members
    expect(withAuthMock).toHaveBeenCalledWith();
  });

  it("returns 404 for a process outside the org", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockSelectSequence([[]]); // process lookup → not found

    const { GET } = await import(
      "../../app/api/v1/processes/[id]/call-links/route"
    );
    const res = await GET(
      makeRequest(`http://localhost/api/v1/processes/${PROCESS_ID}/call-links`),
      { params: makeParams({ id: PROCESS_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with { calls, calledBy } shape", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockSelectSequence([
      [{ id: PROCESS_ID }], // process exists
      [
        {
          stepId: STEP_ID,
          bpmnElementId: "CallActivity_1",
          stepName: "Invoke child",
          stepType: "call_activity",
          calledProcessId: OTHER_PROCESS_ID,
          calledProcessName: "Child process",
          calledProcessStatus: "published",
        },
      ], // outgoing calls
      [], // calledBy
    ]);

    const { GET } = await import(
      "../../app/api/v1/processes/[id]/call-links/route"
    );
    const res = await GET(
      makeRequest(`http://localhost/api/v1/processes/${PROCESS_ID}/call-links`),
      { params: makeParams({ id: PROCESS_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.calls)).toBe(true);
    expect(Array.isArray(body.data.calledBy)).toBe(true);
    expect(body.data.calls).toHaveLength(1);
    expect(body.data.calls[0]).toMatchObject({
      bpmnElementId: "CallActivity_1",
      calledProcessId: OTHER_PROCESS_ID,
      calledProcessName: "Child process",
      calledProcessStatus: "published",
    });
    expect(body.data.calledBy).toHaveLength(0);
  });
});

describe("PUT /api/v1/processes/:id/steps/:stepId — calledProcessId", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
  });

  it("rejects linking a step to its own process with 422", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockSelectSequence([
      [{ id: PROCESS_ID }], // process exists
      [{ id: STEP_ID }], // step exists
    ]);

    const { PUT } = await import(
      "../../app/api/v1/processes/[id]/steps/[stepId]/route"
    );
    const res = await PUT(
      makeRequest(
        `http://localhost/api/v1/processes/${PROCESS_ID}/steps/${STEP_ID}`,
        { method: "PUT", body: { calledProcessId: PROCESS_ID } },
      ),
      { params: makeParams({ id: PROCESS_ID, stepId: STEP_ID }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/own process/i);
  });

  it("rejects a target process outside the org with 422", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockSelectSequence([
      [{ id: PROCESS_ID }], // process exists
      [{ id: STEP_ID }], // step exists
      [], // target process lookup → not found in org
    ]);

    const { PUT } = await import(
      "../../app/api/v1/processes/[id]/steps/[stepId]/route"
    );
    const res = await PUT(
      makeRequest(
        `http://localhost/api/v1/processes/${PROCESS_ID}/steps/${STEP_ID}`,
        { method: "PUT", body: { calledProcessId: OTHER_PROCESS_ID } },
      ),
      { params: makeParams({ id: PROCESS_ID, stepId: STEP_ID }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("accepts a valid target process and updates the step", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockSelectSequence([
      [{ id: PROCESS_ID }], // process exists
      [{ id: STEP_ID }], // step exists
      [{ id: OTHER_PROCESS_ID }], // target process exists in org
    ]);
    mockDb.update.mockImplementation(() =>
      chainable([
        { id: STEP_ID, calledProcessId: OTHER_PROCESS_ID },
      ]),
    );

    const { PUT } = await import(
      "../../app/api/v1/processes/[id]/steps/[stepId]/route"
    );
    const res = await PUT(
      makeRequest(
        `http://localhost/api/v1/processes/${PROCESS_ID}/steps/${STEP_ID}`,
        { method: "PUT", body: { calledProcessId: OTHER_PROCESS_ID } },
      ),
      { params: makeParams({ id: PROCESS_ID, stepId: STEP_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      id: STEP_ID,
      calledProcessId: OTHER_PROCESS_ID,
    });
  });
});
