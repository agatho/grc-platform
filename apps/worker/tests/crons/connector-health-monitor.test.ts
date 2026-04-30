import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  evidenceConnector: { id: "x", orgId: "x", isEnabled: "x", lastHealthCheckAt: "x" },
  connectorHealthCheck: {},
}));

describe("connectorHealthMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("runs without throwing", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { connectorHealthMonitor } = await import("../../src/crons/connector-health-monitor");
    await expect(connectorHealthMonitor()).resolves.toBeUndefined();
  });
});
