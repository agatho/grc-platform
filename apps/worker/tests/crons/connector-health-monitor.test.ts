// [ARCTOS-FULL-2026-08-31 / WP9 · S14-02, S10-15]
//
// Replaces the previous single `resolves.toBeUndefined()` tautology.
//
// The job used to write `connector_health_check` rows with
// `status: "healthy"` for every active connector — from
// `const isHealthy = true;`, without a single packet leaving the
// container. The dashboard therefore showed perfect uptime for
// integrations that may have been broken for months.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  get baseClient() {
    return undefined;
  },
  evidenceConnector: {
    id: "x",
    orgId: "x",
    status: "x",
    deletedAt: "x",
  },
}));

describe("connectorHealthMonitor (S14-02)", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("does nothing and reports success when no connector is active", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { connectorHealthMonitor } =
      await import("../../src/crons/connector-health-monitor");
    await expect(connectorHealthMonitor()).resolves.toEqual({
      activeConnectors: 0,
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("refuses instead of recording an unmeasured health check", async () => {
    mockDb.select.mockReturnValue(
      chainable([{ id: "44444444-4444-4444-4444-444444444444" }]),
    );
    const { connectorHealthMonitor } =
      await import("../../src/crons/connector-health-monitor");

    await expect(connectorHealthMonitor()).rejects.toThrow(
      /No evidence produced/,
    );
    // Nothing written, and nothing marked healthy.
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
