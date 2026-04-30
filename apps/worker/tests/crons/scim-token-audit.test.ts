// Test for SCIM-Token-Audit cron (90-day staleness check).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
}));

describe("processScimTokenAudit", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result structure", async () => {
    mockDb.execute.mockResolvedValue([{ count: 0 }]);
    const { processScimTokenAudit } = await import(
      "../../src/crons/scim-token-audit"
    );
    const r = await processScimTokenAudit();
    expect(r).toEqual(
      expect.objectContaining({
        staleTokenCount: expect.any(Number),
        error: null,
      }),
    );
  });

  it("captures error when DB query fails", async () => {
    mockDb.execute.mockRejectedValue(new Error("connection lost"));
    const { processScimTokenAudit } = await import(
      "../../src/crons/scim-token-audit"
    );
    const r = await processScimTokenAudit();
    expect(r.error).toBe("connection lost");
  });
});
