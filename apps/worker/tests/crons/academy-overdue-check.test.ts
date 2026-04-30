import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  academyEnrollment: { id: "x", orgId: "x", userId: "x", deadline: "x", status: "x", courseId: "x" },
}));

describe("processAcademyOverdueCheck", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processAcademyOverdueCheck } = await import("../../src/crons/academy-overdue-check");
    const r = await processAcademyOverdueCheck();
    expect(r).toBeDefined();
  });

  it("processes overdue enrollments without throwing", async () => {
    mockDb.select.mockReturnValue(chainable([
      { id: "e1", orgId: "o", userId: "u", deadline: new Date(Date.now() - 86400000), status: "in_progress", courseId: "c1" },
    ]));
    const { processAcademyOverdueCheck } = await import("../../src/crons/academy-overdue-check");
    await expect(processAcademyOverdueCheck()).resolves.toBeDefined();
  });
});
