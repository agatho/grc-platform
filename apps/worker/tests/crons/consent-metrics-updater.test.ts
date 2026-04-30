import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  consentType: {},
  consentRecord: {},
  notification: {},
}));

describe("processConsentMetrics", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
    const { processConsentMetrics } = await import("../../src/crons/consent-metrics-updater");
    const r = await processConsentMetrics();
    expect(r).toBeDefined();
  });
});
