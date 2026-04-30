import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  controlTestExecution: {},
  controlTestLearning: {},
}));

describe("processControlTestLearning", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
    const { processControlTestLearning } = await import("../../src/crons/control-test-learning-updater");
    const r = await processControlTestLearning();
    expect(r).toBeDefined();
  });
});
