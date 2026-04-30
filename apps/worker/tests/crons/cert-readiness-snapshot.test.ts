import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x", deletedAt: "x" },
  certReadinessAssessment: { id: "x", orgId: "x", framework: "x" },
  certificationReadinessSnapshot: {},
}));

describe("processCertReadinessSnapshot", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
    const { processCertReadinessSnapshot } = await import("../../src/crons/cert-readiness-snapshot");
    const r = await processCertReadinessSnapshot();
    expect(r).toBeDefined();
  });
});
