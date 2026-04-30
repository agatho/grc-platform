// Test for ISMS-CAP overdue monitor (ISO 27001 §10.1).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  ismsNonconformity: {
    id: "x",
    orgId: "x",
    status: "x",
    dueDate: "x",
    assignedTo: "x",
    title: "x",
    severity: "x",
  },
  ismsCorrectiveAction: { id: "x", nonconformityId: "x", status: "x" },
  notification: {},
}));

describe("processIsmsCapOverdueMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero counts when no overdue NCs", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processIsmsCapOverdueMonitor } = await import(
      "../../src/crons/isms-cap-overdue-monitor"
    );
    const r = await processIsmsCapOverdueMonitor();
    expect(r.ncProcessed).toBe(0);
  });

  it("returns expected ISMS-CAP shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processIsmsCapOverdueMonitor } = await import(
      "../../src/crons/isms-cap-overdue-monitor"
    );
    const r = await processIsmsCapOverdueMonitor();
    expect(r).toEqual(
      expect.objectContaining({
        ncProcessed: expect.any(Number),
      }),
    );
  });

  it("processes overdue NCs without throwing", async () => {
    const overdue = [
      {
        id: "nc-1",
        orgId: "org",
        title: "Critical finding",
        severity: "major",
        status: "in_progress",
        dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        assignedTo: "user-1",
      },
    ];
    mockDb.select.mockReturnValue(chainable(overdue));
    const { processIsmsCapOverdueMonitor } = await import(
      "../../src/crons/isms-cap-overdue-monitor"
    );
    await expect(processIsmsCapOverdueMonitor()).resolves.toBeDefined();
  });
});
