import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  benchmarkSubmission: { id: "x", poolId: "x", value: "x" },
  benchmarkPool: { id: "x", metricKey: "x" },
}));

describe("processBenchmarkAggregator", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processBenchmarkAggregator } = await import("../../src/crons/benchmark-aggregator");
    const r = await processBenchmarkAggregator();
    expect(r).toBeDefined();
  });
});
