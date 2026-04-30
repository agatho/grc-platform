import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  notification: {},
}));

describe("processCalendarOverdueCheck", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected shape", async () => {
    mockDb.execute.mockResolvedValue([]);
    const { processCalendarOverdueCheck } = await import("../../src/crons/calendar-overdue-check");
    const r = await processCalendarOverdueCheck();
    expect(r).toBeDefined();
  });
});
