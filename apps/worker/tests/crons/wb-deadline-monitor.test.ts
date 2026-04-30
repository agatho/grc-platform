// Test for Whistleblowing-Deadline-Monitor (HinSchG / EU 2019/1937).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  wbCase: {
    id: "x",
    orgId: "x",
    receivedAt: "x",
    acknowledgmentSentAt: "x",
    feedbackDueAt: "x",
    status: "x",
    assignedOfficerId: "x",
  },
  notification: {},
  user: {},
}));

describe("processWbDeadlineMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape with no cases", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processWbDeadlineMonitor } = await import(
      "../../src/crons/wb-deadline-monitor"
    );
    const r = await processWbDeadlineMonitor();
    expect(r).toBeDefined();
  });
});
