import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  controlTestScript: { id: "x", orgId: "x", isActive: "x" },
  controlTestExecution: {},
}));

describe("processControlTestScheduler", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processControlTestScheduler } = await import("../../src/crons/control-test-scheduler");
    const r = await processControlTestScheduler();
    expect(r).toBeDefined();
  });
});
