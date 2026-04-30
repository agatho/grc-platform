import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  certReadinessAssessment: { id: "x", orgId: "x", framework: "x", status: "x" },
}));

describe("processCertReadinessCheck", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processCertReadinessCheck } = await import("../../src/crons/cert-readiness-check");
    const r = await processCertReadinessCheck();
    expect(r).toBeDefined();
  });
});
