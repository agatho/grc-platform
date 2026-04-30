import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  notification: {},
}));

describe("processCalendarDigest", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("runs without error with empty calendar", async () => {
    mockDb.execute.mockResolvedValue([]);
    const { processCalendarDigest } = await import("../../src/crons/calendar-digest");
    const r = await processCalendarDigest();
    expect(r).toBeDefined();
  });
});
