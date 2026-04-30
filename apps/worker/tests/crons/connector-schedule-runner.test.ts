import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  evidenceConnector: { id: "x", orgId: "x", isEnabled: "x" },
  connectorSchedule: { id: "x", connectorId: "x", nextRunAt: "x" },
}));

describe("connectorScheduleRunner", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("runs without throwing", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { connectorScheduleRunner } = await import("../../src/crons/connector-schedule-runner");
    await expect(connectorScheduleRunner()).resolves.toBeUndefined();
  });
});
