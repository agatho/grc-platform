// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns shape with empty cleanup")` whose only assertion was
// `expect(r).toBeDefined()` — true for every object the function could ever
// return, including a wrong one. This job DELETES rows, so the things that
// matter are: it deletes only what has expired, it reports how much it
// deleted, and a database failure does not come back as a clean run.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  auditAnalyticsImport: { id: "x", createdAt: "x", expiresAt: "x" },
}));

async function run() {
  const { processAnalyticsCleanup } =
    await import("../../src/crons/analytics-cleanup");
  return processAnalyticsCleanup();
}

describe("processAnalyticsCleanup", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("reports zero when nothing has expired and still issues exactly one delete", async () => {
    mockDb.delete.mockReturnValue(chainable([]));
    const r = (await run()) as { deleted: number };
    expect(r.deleted).toBe(0);
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });

  it("counts the rows it actually removed", async () => {
    mockDb.delete.mockReturnValue(
      chainable([{ id: "imp-1" }, { id: "imp-2" }, { id: "imp-3" }]),
    );
    const r = (await run()) as { deleted: number };
    expect(r.deleted).toBe(3);
  });

  it("scopes the delete with a WHERE clause — never an unfiltered wipe", async () => {
    const chain = chainable([]);
    mockDb.delete.mockReturnValue(chain);
    await run();
    // A `delete()` whose `where()` is never called removes the whole table.
    expect(
      (chain.where as ReturnType<typeof vi.fn>).mock.calls.length,
      "analytics-cleanup issued a DELETE without a WHERE clause",
    ).toBe(1);
    expect(chain.returning).toHaveBeenCalled();
  });

  it("propagates a database failure instead of reporting a clean run", async () => {
    mockDb.delete.mockImplementation(() => {
      throw new Error("deadlock detected");
    });
    await expect(run()).rejects.toThrow("deadlock detected");
  });
});
