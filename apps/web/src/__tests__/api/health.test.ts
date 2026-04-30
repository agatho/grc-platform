import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray) => strings.raw.join(""),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns healthy status when DB is reachable", async () => {
    mockDb.execute.mockResolvedValue([{ "?column?": 1 }]);
    const { GET } = await import("../../app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database.status).toBe("up");
    expect(typeof body.checks.database.latencyMs).toBe("number");
    expect(body.timestamp).toBeTruthy();
  });

  it("returns degraded status with HTTP 503 when DB throws", async () => {
    mockDb.execute.mockRejectedValue(new Error("connection refused"));
    const { GET } = await import("../../app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database.status).toBe("down");
  });

  it("includes uptime as a positive number", async () => {
    mockDb.execute.mockResolvedValue([]);
    const { GET } = await import("../../app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});
