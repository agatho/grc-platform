// Prozesslandkarte:
//   GET /api/v1/processes/map — auth gating, query validation, response
//   shape and band grouping (incl. inheritance on drill-in).

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  makeMockDb,
  makeRequest,
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
    parentProcessId: "parentProcessId",
    name: "name",
    status: "status",
    level: "level",
    mapCategory: "mapCategory",
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
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    isNull: noop,
    sql: noop,
  };
});

const AUTH_CTX = {
  session: { user: { id: "user-1" } },
  orgId: "org-1",
  userId: "user-1",
};

const PARENT_ID = "11111111-1111-4111-8111-111111111111";

async function loadRoute() {
  return import("../../app/api/v1/processes/map/route");
}

describe("GET /api/v1/processes/map", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await loadRoute();
    const res = await GET(makeRequest("http://localhost/api/v1/processes/map"));
    expect(res.status).toBe(401);
    // GET is open to all authenticated org members
    expect(withAuthMock).toHaveBeenCalledWith();
  });

  it("returns 422 for a non-UUID parentId", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    const { GET } = await loadRoute();
    const res = await GET(
      makeRequest("http://localhost/api/v1/processes/map?parentId=not-a-uuid"),
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 when the parent is not found in the org", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.execute.mockResolvedValue([]); // empty ancestor chain

    const { GET } = await loadRoute();
    const res = await GET(
      makeRequest(
        `http://localhost/api/v1/processes/map?parentId=${PARENT_ID}`,
      ),
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with grouped bands on root level (uncategorized → unassigned)", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    mockDb.select.mockImplementation(() =>
      chainable([
        {
          id: "p-mgmt",
          name: "Strategie",
          status: "published",
          level: 1,
          mapCategory: "management",
          childCount: 2,
          hasDiagram: false,
        },
        {
          id: "p-core",
          name: "Auftragsabwicklung",
          status: "published",
          level: 1,
          mapCategory: "core",
          childCount: 0,
          hasDiagram: true,
        },
        {
          id: "p-none",
          name: "Sonstiges",
          status: "draft",
          level: 1,
          mapCategory: null,
          childCount: 0,
          hasDiagram: false,
        },
      ]),
    );

    const { GET } = await loadRoute();
    const res = await GET(makeRequest("http://localhost/api/v1/processes/map"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.parent).toBeNull();
    expect(body.data.groups.management.map((i: { id: string }) => i.id)).toEqual(
      ["p-mgmt"],
    );
    expect(body.data.groups.core).toHaveLength(1);
    expect(body.data.groups.core[0]).toMatchObject({
      id: "p-core",
      childCount: 0,
      hasDiagram: true,
    });
    expect(body.data.groups.support).toHaveLength(0);
    // Root level: no parent band to inherit → unassigned strip
    expect(body.data.groups.unassigned.map((i: { id: string }) => i.id)).toEqual(
      ["p-none"],
    );
  });

  it("inherits the parent's effective band on drill-in", async () => {
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(undefined);
    // Ancestor chain: the parent itself is uncategorized, its own parent
    // is a core process → effective band = core.
    mockDb.execute.mockResolvedValue([
      { id: PARENT_ID, name: "Teilprozess", map_category: null, depth: 0 },
      { id: "root-1", name: "Kernprozess", map_category: "core", depth: 1 },
    ]);
    mockDb.select.mockImplementation(() =>
      chainable([
        {
          id: "c-1",
          name: "Kind ohne Kategorie",
          status: "draft",
          level: 3,
          mapCategory: null,
          childCount: 0,
          hasDiagram: false,
        },
        {
          id: "c-2",
          name: "Kind mit eigener Kategorie",
          status: "published",
          level: 3,
          mapCategory: "support",
          childCount: 1,
          hasDiagram: true,
        },
      ]),
    );

    const { GET } = await loadRoute();
    const res = await GET(
      makeRequest(
        `http://localhost/api/v1/processes/map?parentId=${PARENT_ID}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.parent).toMatchObject({
      id: PARENT_ID,
      name: "Teilprozess",
      mapCategory: null,
      effectiveCategory: "core",
    });
    // Uncategorized child inherits the parent's effective band
    expect(body.data.groups.core.map((i: { id: string }) => i.id)).toEqual([
      "c-1",
    ]);
    // Own category wins over inheritance
    expect(body.data.groups.support.map((i: { id: string }) => i.id)).toEqual([
      "c-2",
    ]);
    expect(body.data.groups.unassigned).toHaveLength(0);
  });
});
