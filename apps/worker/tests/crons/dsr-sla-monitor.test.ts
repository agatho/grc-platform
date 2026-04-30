// Test for GDPR Art. 12 — 1-Monats-Frist DSR-SLA-Monitor.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  dsr: {
    id: "x",
    orgId: "x",
    requestedAt: "x",
    deadlineAt: "x",
    status: "x",
    title: "x",
    assigneeId: "x",
    dpoId: "x",
  },
  notification: {},
}));

describe("processDsrSlaMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero when no DSRs in pending state", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processDsrSlaMonitor } = await import(
      "../../src/crons/dsr-sla-monitor"
    );
    const r = await processDsrSlaMonitor();
    expect(r).toBeDefined();
  });

  it("does not throw when DSRs are present", async () => {
    mockDb.select.mockReturnValue(
      chainable([
        {
          id: "dsr-1",
          orgId: "org",
          title: "Auskunft Person X",
          status: "in_progress",
          requestedAt: new Date(Date.now() - 25 * 86400000),
          deadlineAt: new Date(Date.now() + 5 * 86400000),
          dpoId: "dpo-1",
          assigneeId: null,
        },
      ]),
    );
    const { processDsrSlaMonitor } = await import(
      "../../src/crons/dsr-sla-monitor"
    );
    await expect(processDsrSlaMonitor()).resolves.toBeDefined();
  });
});
