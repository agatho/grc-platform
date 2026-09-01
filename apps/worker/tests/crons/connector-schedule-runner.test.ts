// [ARCTOS-FULL-2026-08-31 / WP9 · S10-06]
//
// This file used to hold exactly one assertion — `resolves.toBeUndefined()`
// — which passed identically before and after the defect; it is one of the
// 103 tautology files S11-09 counted. It now asserts what the job must
// actually do.
//
// The two defects guarded here:
//   * the job wrote one `connector_test_result` per test definition with
//     `status: "pass"` and a `Math.random()` duration, having executed no
//     test at all;
//   * it never wrote `next_run_at`, so a schedule that fell due once stayed
//     due forever — 12 tests × 96 runs a day = 1.152 fabricated passes per
//     schedule per day, growing without bound.

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
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
    connectorType: "x",
  },
  connectorSchedule: {
    id: "x",
    orgId: "x",
    connectorId: "x",
    nextRunAt: "x",
    isEnabled: "x",
  },
  connectorTestDefinition: { testKey: "x", connectorType: "x", isActive: "x" },
  connectorTestResult: {},
}));

const SCHEDULE = {
  id: "11111111-1111-1111-1111-111111111111",
  orgId: "22222222-2222-2222-2222-222222222222",
  connectorId: "33333333-3333-3333-3333-333333333333",
  cronExpression: "0 3 * * *",
  isEnabled: true,
  testIds: [],
  consecutiveFailures: 2,
};

describe("connectorScheduleRunner (S10-06)", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("reports a clean run when nothing is due", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { connectorScheduleRunner } =
      await import("../../src/crons/connector-schedule-runner");
    const result = await connectorScheduleRunner();
    expect(result.due).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.failed).toBe(0);
  });

  it("never inserts a test result for a due schedule", async () => {
    const connector = {
      id: SCHEDULE.connectorId,
      orgId: SCHEDULE.orgId,
      connectorType: "aws",
      status: "active",
      deletedAt: null,
    };
    mockDb.select
      .mockReturnValueOnce(chainable([SCHEDULE]))
      .mockReturnValueOnce(chainable([connector]))
      .mockReturnValueOnce(chainable([{ testKey: "a" }, { testKey: "b" }]));

    const { connectorScheduleRunner } =
      await import("../../src/crons/connector-schedule-runner");
    const result = await connectorScheduleRunner();

    // The heart of the finding: nothing that reads as evidence is written.
    expect(mockDb.insert).not.toHaveBeenCalled();
    // And the run is honestly reported as failed, not as a silent success.
    expect(result.ok).toBe(false);
    expect(result.failed).toBeGreaterThan(0);
    expect(result.testsSkipped).toBe(2);
  });

  it("advances next_run_at so a due schedule does not stay due forever", async () => {
    const updateChain = chainable([]);
    mockDb.update.mockReturnValue(updateChain);
    mockDb.select
      .mockReturnValueOnce(chainable([SCHEDULE]))
      .mockReturnValueOnce(chainable([])); // connector inactive → no tests

    const { connectorScheduleRunner } =
      await import("../../src/crons/connector-schedule-runner");
    const result = await connectorScheduleRunner();

    expect(result.advanced).toBe(1);

    const setCalls = (updateChain.set as Mock).mock.calls.map(
      (c) => c[0] as Record<string, unknown>,
    );
    const scheduleUpdate = setCalls.find((v) => "nextRunAt" in v);
    expect(scheduleUpdate, "no UPDATE wrote nextRunAt").toBeDefined();
    expect(scheduleUpdate!.nextRunAt).toBeInstanceOf(Date);
    // Honest status and a growing failure counter, instead of the constant
    // "success" the old code always produced (failCount was never raised).
    expect(scheduleUpdate!.lastRunStatus).toBe("failure");
    expect(scheduleUpdate!.consecutiveFailures).toBe(3);
  });
});
