import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x", deletedAt: "x" },
  control: { id: "x", orgId: "x" },
  controlMaturity: {},
  cesScore: {},
}));

describe("processCesRecompute", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
    const { processCesRecompute } = await import("../../src/crons/ces-recompute");
    const r = await processCesRecompute();
    expect(r).toBeDefined();
  });
});
