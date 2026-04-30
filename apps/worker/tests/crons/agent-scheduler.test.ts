import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  agentRegistration: { id: "x", orgId: "x", scheduleCron: "x", lastRunAt: "x", nextRunAt: "x", isEnabled: "x" },
}));

describe("processAgentScheduler", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns shape with no scheduled agents", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processAgentScheduler } = await import("../../src/crons/agent-scheduler");
    const r = await processAgentScheduler();
    expect(r).toBeDefined();
  });
});
