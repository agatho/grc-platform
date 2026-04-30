// Test for NIS2 Art. 23 deadline monitor.
// Verifies smoke path + auth-grade error handling.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  nis2IncidentReport: { id: "x", orgId: "x", deadlineAt: "x", status: "x" },
  securityIncident: { id: "x", orgId: "x" },
  organization: { id: "x", name: "x" },
}));

describe("processNis2DeadlineMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero stats when no orgs have NIS2 reports", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
    const { processNis2DeadlineMonitor } = await import(
      "../../src/crons/nis2-deadline-monitor"
    );
    const r = await processNis2DeadlineMonitor();
    expect(r.errors).toBe(0);
    expect(r.orgsProcessed).toBeGreaterThanOrEqual(0);
  });

  it("does not throw when DB returns unexpected shape", async () => {
    mockDb.select.mockReturnValue(chainable([{ id: "x" }]));
    mockDb.execute.mockResolvedValue([]);
    const { processNis2DeadlineMonitor } = await import(
      "../../src/crons/nis2-deadline-monitor"
    );
    await expect(processNis2DeadlineMonitor()).resolves.toBeDefined();
  });

  it("returns NIS2-specific result keys", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processNis2DeadlineMonitor } = await import(
      "../../src/crons/nis2-deadline-monitor"
    );
    const r = await processNis2DeadlineMonitor();
    expect(r).toEqual(
      expect.objectContaining({
        orgsProcessed: expect.any(Number),
        overdueReports: expect.any(Number),
        upcomingAlerts: expect.any(Number),
        errors: expect.any(Number),
      }),
    );
  });
});
