// Test for POST /api/v1/programmes/journeys — instantiation flow.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb, chainable } from "./helpers/mock-context";

let mockDb: MockDb;
let withAuthMock: ReturnType<typeof vi.fn>;
let withAuditCtxMock: ReturnType<typeof vi.fn>;
let requireModuleMock: ReturnType<typeof vi.fn>;
const instantiateJourneyMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  programmeJourney: { id: "x", orgId: "x", deletedAt: "x", status: "x" },
  programmeTemplate: {
    id: "x",
    code: "x",
    version: "x",
    isActive: "x",
    deprecatedAt: "x",
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
  get withAuditContext() {
    return withAuditCtxMock;
  },
}));

vi.mock("@/lib/programme/instantiate", () => ({
  get instantiateJourney() {
    return instantiateJourneyMock;
  },
}));

vi.mock("@grc/shared", () => ({
  createJourneySchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d?.templateCode || !d?.name || (d.name as string).length < 2) {
        return {
          success: false,
          error: { flatten: () => ({ fieldErrors: { name: ["required"] } }) },
        };
      }
      return { success: true, data: d };
    },
  },
}));

describe("POST /api/v1/programmes/journeys", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock = vi.fn().mockResolvedValue({
      session: { user: { id: "u1" } },
      orgId: "o1",
      userId: "u1",
    });
    withAuditCtxMock = vi.fn(async (_ctx, fn: () => Promise<unknown>) => fn());
    requireModuleMock = vi.fn().mockResolvedValue(undefined);
    instantiateJourneyMock.mockReset();
  });

  it("returns 422 on invalid input", async () => {
    const { POST } = await import(
      "../../app/api/v1/programmes/journeys/route"
    );
    const res = await POST(
      new Request("http://localhost/api/v1/programmes/journeys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 when template not found", async () => {
    mockDb.select.mockReturnValueOnce(chainable([])); // template lookup
    const { POST } = await import(
      "../../app/api/v1/programmes/journeys/route"
    );
    const res = await POST(
      new Request("http://localhost/api/v1/programmes/journeys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateCode: "missing-tpl", name: "Test" }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 422 when template is deactivated", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: "t1",
          code: "iso27001-2022",
          version: "1.0",
          isActive: false,
          deprecatedAt: new Date(),
        },
      ]),
    );
    const { POST } = await import(
      "../../app/api/v1/programmes/journeys/route"
    );
    const res = await POST(
      new Request("http://localhost/api/v1/programmes/journeys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateCode: "iso27001-2022",
          name: "Test Journey",
        }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 201 with instantiated journey on success", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: "t1",
          code: "iso27001-2022",
          version: "1.0",
          isActive: true,
          deprecatedAt: null,
        },
      ]),
    );
    instantiateJourneyMock.mockResolvedValue({
      journey: { id: "j1", name: "Test Journey" },
      phaseCount: 5,
      stepCount: 24,
    });
    const { POST } = await import(
      "../../app/api/v1/programmes/journeys/route"
    );
    const res = await POST(
      new Request("http://localhost/api/v1/programmes/journeys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateCode: "iso27001-2022",
          name: "Test Journey",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.journey.id).toBe("j1");
    expect(body.data.phaseCount).toBe(5);
    expect(body.data.stepCount).toBe(24);
  });

  it("returns 409 on duplicate journey name", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: "t1",
          code: "iso27001-2022",
          version: "1.0",
          isActive: true,
          deprecatedAt: null,
        },
      ]),
    );
    instantiateJourneyMock.mockRejectedValue(
      new Error("duplicate key value violates unique constraint"),
    );
    const { POST } = await import(
      "../../app/api/v1/programmes/journeys/route"
    );
    const res = await POST(
      new Request("http://localhost/api/v1/programmes/journeys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateCode: "iso27001-2022",
          name: "Already exists",
        }),
      }),
    );
    expect(res.status).toBe(409);
  });
});
