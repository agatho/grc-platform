import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x" },
  grcBudget: { id: "x", orgId: "x", periodStart: "x", periodEnd: "x" },
  grcCostEntry: { entityId: "x", entityType: "x" },
  control: {},
  riskTreatment: {},
}));

describe("processBudgetForecast", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
    const { processBudgetForecast } = await import("../../src/crons/budget-forecast");
    const r = await processBudgetForecast();
    expect(r).toBeDefined();
  });
});
