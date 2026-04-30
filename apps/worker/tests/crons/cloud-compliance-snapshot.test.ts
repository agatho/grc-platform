import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  cloudTestSuite: { id: "x", orgId: "x" },
  cloudComplianceSnapshot: {},
  evidenceConnector: { id: "x", orgId: "x", isEnabled: "x", deletedAt: "x" },
}));

describe("cloudComplianceSnapshotJob", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("runs without error", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { cloudComplianceSnapshotJob } = await import("../../src/crons/cloud-compliance-snapshot");
    await expect(cloudComplianceSnapshotJob()).resolves.toBeUndefined();
  });
});
