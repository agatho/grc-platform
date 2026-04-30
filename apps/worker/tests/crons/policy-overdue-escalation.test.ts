// Test for Policy Acknowledgment Overdue-Escalation.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  policyDistribution: {
    id: "x",
    orgId: "x",
    deadlineDate: "x",
    documentId: "x",
    title: "x",
  },
  policyAcknowledgment: {
    id: "x",
    distributionId: "x",
    userId: "x",
    acknowledgedAt: "x",
  },
  notification: {},
  user: { id: "x", orgId: "x", email: "x", name: "x" },
}));

describe("processPolicyOverdueEscalation", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected shape with no overdue policies", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processPolicyOverdueEscalation } = await import(
      "../../src/crons/policy-overdue-escalation"
    );
    const r = await processPolicyOverdueEscalation();
    expect(r).toBeDefined();
    expect(r).toEqual(
      expect.objectContaining({
        processed: expect.any(Number),
      }),
    );
  });
});
