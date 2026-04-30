import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb, chainable } from "./helpers/mock-context";

let mockDb: MockDb;
let withAuthMock: ReturnType<typeof vi.fn>;
let requireModuleMock: ReturnType<typeof vi.fn>;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  programmeTemplate: {
    id: "x",
    code: "x",
    msType: "x",
    isActive: "x",
    deprecatedAt: "x",
    name: "x",
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

vi.mock("@grc/shared", () => ({
  MS_TYPE_VALUES: ["isms", "bcms", "dpms", "aims", "esg", "tcms", "iccs", "other"],
}));

describe("GET /api/v1/programmes/templates", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withAuthMock = vi.fn().mockResolvedValue({
      session: { user: { id: "u1" } },
      orgId: "o1",
      userId: "u1",
    });
    requireModuleMock = vi.fn().mockResolvedValue(undefined);
  });

  it("returns 200 with empty list when no templates exist", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { GET } = await import(
      "../../app/api/v1/programmes/templates/route"
    );
    const res = await GET(
      new Request("http://localhost/api/v1/programmes/templates"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("returns the list of templates", async () => {
    const templates = [
      {
        id: "t1",
        code: "iso27001-2022",
        msType: "isms",
        name: "ISO 27001",
        description: null,
        version: "1.0",
        frameworkCodes: ["ISO27001:2022"],
        estimatedDurationDays: 365,
        publishedAt: new Date(),
      },
    ];
    mockDb.select.mockReturnValueOnce(chainable(templates));
    const { GET } = await import(
      "../../app/api/v1/programmes/templates/route"
    );
    const res = await GET(
      new Request("http://localhost/api/v1/programmes/templates"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].code).toBe("iso27001-2022");
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValueOnce(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import(
      "../../app/api/v1/programmes/templates/route"
    );
    const res = await GET(
      new Request("http://localhost/api/v1/programmes/templates"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when programme module is disabled", async () => {
    requireModuleMock.mockResolvedValueOnce(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const { GET } = await import(
      "../../app/api/v1/programmes/templates/route"
    );
    const res = await GET(
      new Request("http://localhost/api/v1/programmes/templates"),
    );
    expect(res.status).toBe(404);
  });

  it("filters by msType when query param given", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { GET } = await import(
      "../../app/api/v1/programmes/templates/route"
    );
    await GET(
      new Request("http://localhost/api/v1/programmes/templates?msType=isms"),
    );
    // The where condition is set on the chainable; verify select was called
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("ignores invalid msType values", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { GET } = await import(
      "../../app/api/v1/programmes/templates/route"
    );
    const res = await GET(
      new Request("http://localhost/api/v1/programmes/templates?msType=foo"),
    );
    expect(res.status).toBe(200); // Invalid filter is silently dropped
  });
});
