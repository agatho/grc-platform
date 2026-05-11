// GET /api/v1/risks — Auth + paginated response shape.
//
// Lighter than the POST RBAC test — GET is open to all authenticated
// org members. We verify auth gating and the paginated wrapper format.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const paginatedResponseMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  risk: {
    orgId: "orgId",
    deletedAt: "deletedAt",
    status: "status",
    riskCategory: "riskCategory",
    ownerId: "ownerId",
    department: "department",
    riskAppetiteExceeded: "riskAppetiteExceeded",
    riskScoreResidual: "riskScoreResidual",
    riskScoreInherent: "riskScoreInherent",
    title: "title",
    description: "description",
    createdAt: "createdAt",
    id: "id",
    workItemId: "workItemId",
    riskSource: "riskSource",
    inherentLikelihood: "inherentLikelihood",
    inherentImpact: "inherentImpact",
    residualLikelihood: "residualLikelihood",
    residualImpact: "residualImpact",
    treatmentStrategy: "treatmentStrategy",
    reviewDate: "reviewDate",
    updatedAt: "updatedAt",
  },
  workItem: { id: "id", elementId: "elementId" },
  user: { id: "id", name: "name", email: "email" },
  userOrganizationRole: {},
  riskAppetite: {},
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
  withAuditContext: vi.fn(),
  paginate: vi.fn(() => ({
    page: 1,
    limit: 10,
    offset: 0,
    searchParams: new URLSearchParams(),
  })),
  get paginatedResponse() {
    return paginatedResponseMock;
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

describe("GET /api/v1/risks", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    paginatedResponseMock.mockReset();
    paginatedResponseMock.mockImplementation(
      (data: unknown, total: number, page: number, limit: number) =>
        Response.json({ data, total, page, limit }),
    );
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../../app/api/v1/risks/route");
    const res = await GET(new Request("http://localhost/api/v1/risks"));
    expect(res.status).toBe(401);
    // GET is open to all authenticated roles → withAuth called with no args
    expect(withAuthMock).toHaveBeenCalledWith();
  });

  it("returns 200 with paginated shape on success (empty list)", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      orgId: "org-1",
      userId: "user-1",
    });
    requireModuleMock.mockResolvedValue(undefined);

    // makeMockDb returns chainables that resolve to []. The handler runs:
    //   Promise.all([items_query, count_query])
    // For count we need {value: 0}. We patch select() to return chains
    // that resolve to the appropriate shape per call.
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount += 1;
      // First select call = items, second = count
      const value: unknown =
        selectCallCount === 1 ? [] : [{ value: 0 }];
      const chain: Record<string, unknown> = {};
      for (const m of [
        "from",
        "where",
        "orderBy",
        "limit",
        "offset",
        "leftJoin",
      ]) {
        chain[m] = vi.fn(() => chain);
      }
      (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
        resolve(value);
      return chain;
    });

    const { GET } = await import("../../app/api/v1/risks/route");
    const res = await GET(new Request("http://localhost/api/v1/risks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    expect(paginatedResponseMock).toHaveBeenCalled();
  });
});
