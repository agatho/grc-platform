// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. The Control Effectiveness Score is a number the
// product puts in front of an auditor; the job must compute it from the real
// inputs, record the trend against the previous value, upsert instead of
// duplicating, and count a failing control instead of hiding it (S10-11).
// `computeCES`/`computeTrend` from @grc/shared run for real here — mocking
// them would leave nothing but the loop under test.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const reportJobError = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x", deletedAt: "x" },
  control: { id: "x", orgId: "x", deletedAt: "x", automationLevel: "x" },
  controlTest: { controlId: "x", orgId: "x", testDate: "x", todResult: "x" },
  finding: {
    controlId: "x",
    orgId: "x",
    deletedAt: "x",
    severity: "x",
    status: "x",
  },
  controlEffectivenessScore: { orgId: "x", controlId: "x", score: "x" },
}));

vi.mock("../../src/lib/job-runtime", () => ({
  reportJobError: (...args: unknown[]) => reportJobError(...args),
}));

async function run() {
  const { processCesRecompute } = await import("../../src/crons/ces-recompute");
  return processCesRecompute();
}

type Result = { processed: number; orgsProcessed: number; errors: number };

/** org list → control list → (tests, findings, existing score) per control */
function queue(opts: {
  orgs: { id: string }[];
  controls: { id: string; automationLevel: string }[];
  tests?: unknown[];
  findings?: unknown[];
  existing?: unknown[];
}) {
  mockDb.select
    .mockReturnValueOnce(chainable(opts.orgs))
    .mockReturnValueOnce(chainable(opts.controls));
  for (let i = 0; i < opts.controls.length; i++) {
    mockDb.select
      .mockReturnValueOnce(chainable(opts.tests ?? []))
      .mockReturnValueOnce(chainable(opts.findings ?? []))
      .mockReturnValueOnce(chainable(opts.existing ?? []));
  }
  mockDb.select.mockReturnValue(chainable([]));
}

function payload(index = 0): Record<string, unknown> {
  return (
    mockDb.insert.mock.results[index]!.value as {
      values: ReturnType<typeof vi.fn>;
    }
  ).values.mock.calls[0]![0] as Record<string, unknown>;
}

describe("processCesRecompute", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    reportJobError.mockReset();
  });

  it("writes nothing when there is no organisation", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r).toEqual({ processed: 0, orgsProcessed: 0, errors: 0 });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("scores every control of every org exactly once", async () => {
    queue({
      orgs: [{ id: "org-1" }],
      controls: [
        { id: "ctl-1", automationLevel: "manual" },
        { id: "ctl-2", automationLevel: "manual" },
      ],
      tests: [{ result: "effective", executedDate: "2026-08-01" }],
    });

    const r = (await run()) as Result;
    expect(r.orgsProcessed).toBe(1);
    expect(r.processed).toBe(2);
    expect(r.errors).toBe(0);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    expect(payload(0).controlId).toBe("ctl-1");
    expect(payload(1).controlId).toBe("ctl-2");
    expect(payload(0).orgId).toBe("org-1");
  });

  it("carries the open-finding count and the last test date into the row", async () => {
    queue({
      orgs: [{ id: "org-1" }],
      controls: [{ id: "ctl-1", automationLevel: "manual" }],
      tests: [
        { result: "effective", executedDate: "2026-08-20" },
        { result: "ineffective", executedDate: "2026-05-20" },
      ],
      findings: [{ severity: "high" }, { severity: "medium" }],
    });

    await run();
    const p = payload();
    expect(p.openFindingsCount).toBe(2);
    expect((p.lastTestAt as Date).toISOString()).toContain("2026-08-20");
    expect(typeof p.score).toBe("number");
  });

  it("compares against the stored score to derive the trend", async () => {
    queue({
      orgs: [{ id: "org-1" }],
      controls: [{ id: "ctl-1", automationLevel: "manual" }],
      tests: [{ result: "effective", executedDate: "2026-08-20" }],
      existing: [{ score: 10 }],
    });

    await run();
    const p = payload();
    expect(p.previousScore).toBe(10);
    // A control that tests effective scores well above 10 → improving.
    expect(p.trend).toBe("improving");
  });

  it("upserts on (org, control) so a daily run keeps one row per control", async () => {
    queue({
      orgs: [{ id: "org-1" }],
      controls: [{ id: "ctl-1", automationLevel: "manual" }],
    });
    await run();
    const chain = (
      mockDb.insert.mock.results[0]!.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values.mock.results[0]!.value as {
      onConflictDoUpdate: ReturnType<typeof vi.fn>;
    };
    expect(chain.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it("counts and reports a failing control instead of swallowing it (S10-11)", async () => {
    queue({
      orgs: [{ id: "org-1" }],
      controls: [
        { id: "ctl-1", automationLevel: "manual" },
        { id: "ctl-2", automationLevel: "manual" },
      ],
    });
    let call = 0;
    mockDb.insert.mockImplementation(() => {
      call++;
      if (call === 1) throw new Error("deadlock detected");
      return chainable([]);
    });

    const r = (await run()) as Result;
    expect(r.processed).toBe(1);
    expect(r.errors).toBe(1);
    expect(reportJobError).toHaveBeenCalledTimes(1);
    expect(reportJobError.mock.calls[0]![0]).toMatchObject({
      job: "ces-recompute",
    });
  });
});
