// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. This job runs every 15 minutes and enqueues
// control-test executions; without a working frequency check it would enqueue
// the same test 96 times a day. The frequency arithmetic, the "never tested
// yet" case and the error isolation are what the tests pin.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const reportJobError = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  controlTestScript: {
    id: "x",
    orgId: "x",
    controlId: "x",
    isActive: "x",
    testType: "x",
    frequency: "x",
  },
  controlTestExecution: { scriptId: "x", createdAt: "x" },
}));

vi.mock("../../src/lib/job-runtime", () => ({
  reportJobError: (...args: unknown[]) => reportJobError(...args),
}));

const NOW = new Date("2026-09-01T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const script = (frequency: string, id = "scr-1") => ({
  id,
  orgId: "org-1",
  controlId: "ctl-1",
  frequency,
});

async function run() {
  const { processControlTestScheduler } =
    await import("../../src/crons/control-test-scheduler");
  return processControlTestScheduler();
}

type Result = { scriptsChecked: number; testsScheduled: number };

/** script list, then one "last execution" row per script */
function queue(scripts: unknown[], lastRuns: Array<Date | null>) {
  mockDb.select.mockReturnValueOnce(chainable(scripts));
  for (const d of lastRuns) {
    mockDb.select.mockReturnValueOnce(chainable(d ? [{ createdAt: d }] : []));
  }
  mockDb.select.mockReturnValue(chainable([]));
}

describe("processControlTestScheduler", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    reportJobError.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules nothing when no script is due", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r).toEqual({ scriptsChecked: 0, testsScheduled: 0 });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("schedules a script that has never run", async () => {
    queue([script("weekly")], [null]);
    const r = (await run()) as Result;
    expect(r).toEqual({ scriptsChecked: 1, testsScheduled: 1 });

    const p = (
      mockDb.insert.mock.results[0]!.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values.mock.calls[0]![0] as Record<string, unknown>;
    expect(p.scriptId).toBe("scr-1");
    expect(p.orgId).toBe("org-1");
    expect(p.controlId).toBe("ctl-1");
    expect(p.status).toBe("pending");
    expect(p.triggeredBy).toBe("scheduled");
  });

  it("does not re-schedule a daily script that ran two hours ago", async () => {
    queue([script("daily")], [new Date(NOW.getTime() - 2 * 60 * 60 * 1000)]);
    const r = (await run()) as Result;
    expect(r.scriptsChecked).toBe(1);
    expect(r.testsScheduled).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("re-schedules a daily script that ran more than a day ago", async () => {
    queue([script("daily")], [daysAgo(2)]);
    const r = (await run()) as Result;
    expect(r.testsScheduled).toBe(1);
  });

  it("honours the per-script frequency rather than one global interval", async () => {
    // 10 days since the last run: due for weekly, not for monthly.
    queue(
      [script("weekly", "scr-w"), script("monthly", "scr-m")],
      [daysAgo(10), daysAgo(10)],
    );
    const r = (await run()) as Result;
    expect(r.scriptsChecked).toBe(2);
    expect(r.testsScheduled).toBe(1);
    const p = (
      mockDb.insert.mock.results[0]!.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values.mock.calls[0]![0] as { scriptId: string };
    expect(p.scriptId).toBe("scr-w");
  });

  it("falls back to the weekly interval for an unknown frequency", async () => {
    queue([script("fortnightly")], [daysAgo(8)]);
    const r = (await run()) as Result;
    expect(r.testsScheduled).toBe(1);
  });

  it("reports a failing script and continues with the next (S10-11)", async () => {
    mockDb.select
      .mockReturnValueOnce(
        chainable([script("daily", "scr-1"), script("daily", "scr-2")]),
      )
      .mockImplementationOnce(() => {
        throw new Error("statement timeout");
      })
      .mockReturnValueOnce(chainable([]));

    const r = (await run()) as Result;
    expect(r.scriptsChecked).toBe(2);
    expect(r.testsScheduled).toBe(1);
    expect(reportJobError).toHaveBeenCalledTimes(1);
  });
});
