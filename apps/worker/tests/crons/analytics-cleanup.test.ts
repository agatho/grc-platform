import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  auditAnalyticsImport: { id: "x", createdAt: "x" },
}));

describe("processAnalyticsCleanup", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns shape with empty cleanup", async () => {
    mockDb.delete.mockReturnValue(chainable({ rowCount: 0 }));
    const { processAnalyticsCleanup } = await import("../../src/crons/analytics-cleanup");
    const r = await processAnalyticsCleanup();
    expect(r).toBeDefined();
  });
});
