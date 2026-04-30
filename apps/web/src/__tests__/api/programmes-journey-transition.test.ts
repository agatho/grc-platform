// Test for POST /api/v1/programmes/journeys/[id]/transition — Journey-Status-Übergänge.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  makeMockDb,
  type MockDb,
  chainable,
  makeRequest,
  makeParams,
} from "./helpers/mock-context";

let mockDb: MockDb;
let withAuthMock: ReturnType<typeof vi.fn>;
let withAuditCtxMock: ReturnType<typeof vi.fn>;
let requireModuleMock: ReturnType<typeof vi.fn>;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  programmeJourney: {
    id: "x",
    orgId: "x",
    deletedAt: "x",
    status: "x",
    startedAt: "x",
    actualCompletionDate: "x",
    archivedAt: "x",
  },
  programmeJourneyEvent: {},
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
    return withAuditCtxMock;
  },
}));

vi.mock("@grc/shared", () => ({
  journeyTransitionSchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d?.to) {
        return {
          success: false,
          error: { flatten: () => ({ fieldErrors: {} }) },
        };
      }
      return { success: true, data: d };
    },
  },
  validateJourneyTransition: ({ from, to }: { from: string; to: string }) => {
    const allowed: Record<string, string[]> = {
      planned: ["active", "archived"],
      active: ["on_track", "at_risk", "blocked", "completed", "archived"],
    };
    if (from === to) return { ok: true };
    if (allowed[from]?.includes(to)) return { ok: true };
    return { ok: false, reason: `${from} → ${to} not allowed` };
  },
}));

const ROUTE = "../../app/api/v1/programmes/journeys/[id]/transition/route";

describe("POST /api/v1/programmes/journeys/[id]/transition", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock = vi.fn().mockResolvedValue({
      session: { user: { id: "u1" } },
      orgId: "o1",
      userId: "u1",
    });
    withAuditCtxMock = vi.fn(async (_ctx, fn: () => Promise<unknown>) => fn());
    requireModuleMock = vi.fn().mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValueOnce(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } = await import(ROUTE);
    const res = await POST(
      makeRequest("http://localhost/transition", {
        method: "POST",
        body: { to: "active" },
      }),
      { params: makeParams({ id: "j1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when journey does not exist", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { POST } = await import(ROUTE);
    const res = await POST(
      makeRequest("http://localhost/transition", {
        method: "POST",
        body: { to: "active" },
      }),
      { params: makeParams({ id: "nope" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 422 for forbidden transition (planned → completed)", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([{ id: "j1", status: "planned", startedAt: null }]),
    );
    const { POST } = await import(ROUTE);
    const res = await POST(
      makeRequest("http://localhost/transition", {
        method: "POST",
        body: { to: "completed" },
      }),
      { params: makeParams({ id: "j1" }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Invalid transition");
    expect(body.from).toBe("planned");
    expect(body.to).toBe("completed");
  });

  it("returns 200 for valid transition (planned → active)", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([{ id: "j1", status: "planned", startedAt: null }]),
    );
    mockDb.update.mockReturnValueOnce(
      chainable([{ id: "j1", status: "active", startedAt: "2026-04-30" }]),
    );
    const { POST } = await import(ROUTE);
    const res = await POST(
      makeRequest("http://localhost/transition", {
        method: "POST",
        body: { to: "active" },
      }),
      { params: makeParams({ id: "j1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalled();
  });
});
