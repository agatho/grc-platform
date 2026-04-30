import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x" },
  cciMonthlyAggregate: {},
  cciMeasurement: {},
}));

describe("processCCIMonthlyAggregation", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
    const { processCCIMonthlyAggregation } = await import("../../src/crons/cci-monthly-aggregation");
    const r = await processCCIMonthlyAggregation();
    expect(r).toBeDefined();
  });
});
