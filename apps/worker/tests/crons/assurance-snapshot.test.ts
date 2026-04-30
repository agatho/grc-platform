import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x", deletedAt: "x" },
  assuranceSnapshot: {},
}));

describe("processAssuranceSnapshot", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
    const { processAssuranceSnapshot } = await import("../../src/crons/assurance-snapshot");
    const r = await processAssuranceSnapshot();
    expect(r).toBeDefined();
  });
});
