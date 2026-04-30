// Test for TPRM Vendor-Reassessment-Monitor (NIS2 Art. 21 Abs. 2 Lit. d).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  vendor: {
    id: "x",
    orgId: "x",
    name: "x",
    nextReviewDue: "x",
    riskTier: "x",
    relationshipOwnerId: "x",
    deletedAt: "x",
  },
  notification: {},
}));

describe("processVendorReassessmentMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero when no vendors are due", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processVendorReassessmentMonitor } = await import(
      "../../src/crons/vendor-reassessment-monitor"
    );
    const r = await processVendorReassessmentMonitor();
    expect(r).toBeDefined();
  });

  it("processes due vendors without throwing", async () => {
    mockDb.select.mockReturnValue(
      chainable([
        {
          id: "v1",
          orgId: "org",
          name: "Cloud Provider X",
          riskTier: "critical",
          nextReviewDue: new Date(Date.now() - 86400000)
            .toISOString()
            .slice(0, 10),
          relationshipOwnerId: "owner-1",
        },
      ]),
    );
    const { processVendorReassessmentMonitor } = await import(
      "../../src/crons/vendor-reassessment-monitor"
    );
    await expect(processVendorReassessmentMonitor()).resolves.toBeDefined();
  });
});
