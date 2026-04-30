import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x" },
  capability: { id: "x", orgId: "x" },
  application: { id: "x", orgId: "x" },
  technologyComponent: { id: "x", orgId: "x" },
}));

describe("processArchitectureHealthSnapshot", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
    const { processArchitectureHealthSnapshot } = await import("../../src/crons/architecture-health-snapshot");
    const r = await processArchitectureHealthSnapshot();
    expect(r).toBeDefined();
  });
});
