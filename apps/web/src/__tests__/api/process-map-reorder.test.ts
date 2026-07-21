// Prozesslandkarte — PUT /api/v1/processes/map/reorder contract tests.
//
// Follows the risk-acceptances-rbac.test.ts pattern: gateway chain
// (401/403/404-module/422) plus the sequence-rewrite happy path
// (map_sequence 10, 20, 30, … in the submitted order, org-scoped).

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
  process: {},
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
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    isNull: noop,
    inArray: noop,
  };
});

const AUTH_CTX = {
  session: { user: { id: "user-1", email: "t@example.com", name: "T" } },
  orgId: "org-1",
  userId: "user-1",
};

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const ID_C = "33333333-3333-4333-8333-333333333333";

function putReorder(body: unknown) {
  return new Request("http://localhost/api/v1/processes/map/reorder", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { category: "core", orderedIds: [ID_B, ID_A, ID_C] };

describe("PUT /api/v1/processes/map/reorder", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();
  });

  // First import transforms the full @grc/shared barrel — allow headroom.
  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { PUT } =
      await import("../../app/api/v1/processes/map/reorder/route");
    const res = await PUT(putReorder(VALID_BODY));
    expect(res.status).toBe(401);
    // Same edit roles as PUT /processes/:id
    expect(withAuthMock).toHaveBeenCalledWith("admin", "process_owner");
  }, 20000);

  it("returns 403 when the role is rejected", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    const { PUT } =
      await import("../../app/api/v1/processes/map/reorder/route");
    const res = await PUT(putReorder(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the BPM module is disabled", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const { PUT } =
      await import("../../app/api/v1/processes/map/reorder/route");
    const res = await PUT(putReorder(VALID_BODY));
    expect(res.status).toBe(404);
    expect(requireModuleMock).toHaveBeenCalledWith("bpm", "org-1", "PUT");
  });

  it("returns 422 for an invalid category", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    const { PUT } =
      await import("../../app/api/v1/processes/map/reorder/route");
    const res = await PUT(
      putReorder({ category: "value_chain", orderedIds: [ID_A] }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(withAuditContextMock).not.toHaveBeenCalled();
  });

  it("returns 422 for duplicate orderedIds", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    const { PUT } =
      await import("../../app/api/v1/processes/map/reorder/route");
    const res = await PUT(
      putReorder({ category: "core", orderedIds: [ID_A, ID_A] }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when an id is not a live process of this org", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    // Org-scoped existence check finds only two of the three ids.
    mockDb.select.mockReturnValueOnce(chainable([{ id: ID_B }, { id: ID_A }]));
    const { PUT } =
      await import("../../app/api/v1/processes/map/reorder/route");
    const res = await PUT(putReorder(VALID_BODY));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.missingIds).toEqual([ID_C]);
    expect(withAuditContextMock).not.toHaveBeenCalled();
  });

  it("rewrites map_sequence as 10, 20, 30 in the submitted order", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.select.mockReturnValueOnce(
      chainable([{ id: ID_A }, { id: ID_B }, { id: ID_C }]),
    );
    withAuditContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: MockDb) => Promise<unknown>) => fn(mockDb),
    );
    const { PUT } =
      await import("../../app/api/v1/processes/map/reorder/route");
    const res = await PUT(putReorder(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ category: "core", updated: 3 });

    // One UPDATE per id, sequence in steps of 10 following orderedIds.
    expect(mockDb.update).toHaveBeenCalledTimes(3);
    const sequences = mockDb.update.mock.results.map(
      (r) =>
        (r.value as { set: ReturnType<typeof vi.fn> }).set.mock.calls[0][0]
          .mapSequence,
    );
    expect(sequences).toEqual([10, 20, 30]);
    // Audit annotation names the sorted band.
    expect(withAuditContextMock.mock.calls[0][2]).toMatchObject({
      actionDetail: "process map reorder (core)",
    });
  });
});
