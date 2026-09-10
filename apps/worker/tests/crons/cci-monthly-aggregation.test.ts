// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. The Compliance Culture Index is a board-level
// number; what must hold is that it is computed for the PREVIOUS month, that
// the snapshot is idempotent (a re-run must not create a second row for the
// same period), that the score reacts to the metrics, and that a failing org
// is counted and reported instead of swallowed (S10-11).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const reportJobError = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x", deletedAt: "x" },
  complianceCultureSnapshot: {
    orgId: "x",
    orgEntityId: "x",
    period: "x",
    overallScore: "x",
  },
  cciConfiguration: { orgId: "x", factorWeights: "x" },
  workItem: { orgId: "x", deletedAt: "x", dueDate: "x", completedAt: "x" },
  policyAcknowledgment: { orgId: "x", status: "x", distributionId: "x" },
  policyDistribution: { id: "x", deadline: "x", isMandatory: "x" },
  securityIncident: {
    orgId: "x",
    deletedAt: "x",
    detectedAt: "x",
    closedAt: "x",
  },
  finding: {
    orgId: "x",
    deletedAt: "x",
    remediatedAt: "x",
    remediationDueDate: "x",
  },
  rcsaCampaign: { id: "x" },
  rcsaAssignment: { orgId: "x", campaignId: "x", status: "x", deadline: "x" },
}));

vi.mock("../../src/lib/job-runtime", () => ({
  reportJobError: (...args: unknown[]) => reportJobError(...args),
}));

async function run() {
  const { processCCIMonthlyAggregation } =
    await import("../../src/crons/cci-monthly-aggregation");
  return processCCIMonthlyAggregation();
}

type Result = {
  orgsProcessed: number;
  snapshotsCreated: number;
  errors: number;
};

/** A metric row shape that satisfies every collector's destructuring. */
const metric = (total: number, successful: number) => ({
  total,
  successful,
  responded: successful,
  avgHours: 4,
});

function payload(index = 0): Record<string, unknown> {
  return (
    mockDb.insert.mock.results[index]!.value as {
      values: ReturnType<typeof vi.fn>;
    }
  ).values.mock.calls[0]![0] as Record<string, unknown>;
}

describe("processCCIMonthlyAggregation", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    reportJobError.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T02:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes nothing when there is no organisation", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r).toEqual({
      orgsProcessed: 0,
      snapshotsCreated: 0,
      errors: 0,
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("aggregates the PREVIOUS month, not the current one", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }]))
      .mockReturnValue(chainable([metric(10, 8)]));

    const r = (await run()) as Result;
    expect(r.orgsProcessed).toBe(1);
    expect(r.snapshotsCreated).toBe(1);

    const p = payload();
    // Runs on 1 September for August. Reporting September on 1 September
    // would produce an empty month every time.
    expect(p.period).toBe("2026-08");
    expect(p.orgId).toBe("org-1");
    expect(p.orgEntityId).toBeNull();
  });

  it("stores factor scores, weights and a numeric overall score", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }]))
      .mockReturnValue(chainable([metric(10, 8)]));
    await run();

    const p = payload();
    expect(typeof p.overallScore).toBe("string");
    expect(Number(p.overallScore)).toBeGreaterThan(0);
    expect(p.factorScores).toBeTruthy();
    expect(p.factorWeights).toBeTruthy();
    expect(p.rawMetrics).toBeTruthy();
  });

  it("scores a compliant month higher than a non-compliant one", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }]))
      .mockReturnValue(chainable([metric(10, 10)]));
    await run();
    const good = Number(payload().overallScore);

    mockDb = makeMockDb();
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-2" }]))
      .mockReturnValue(chainable([metric(10, 1)]));
    await run();
    const bad = Number(payload().overallScore);

    expect(good).toBeGreaterThan(bad);
  });

  it("is idempotent for a period: a second run must not create a second row", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }]))
      .mockReturnValue(chainable([metric(10, 8)]));
    await run();

    const chain = (
      mockDb.insert.mock.results[0]!.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values.mock.results[0]!.value as {
      onConflictDoNothing: ReturnType<typeof vi.fn>;
    };
    expect(chain.onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("counts and reports a failing org, and still processes the next (S10-11)", async () => {
    let call = 0;
    mockDb.select.mockImplementation(() => {
      call++;
      if (call === 1) return chainable([{ id: "org-1" }, { id: "org-2" }]);
      if (call === 2) throw new Error("statement timeout");
      return chainable([metric(10, 8)]);
    });

    const r = (await run()) as Result;
    expect(r.errors).toBe(1);
    expect(r.orgsProcessed).toBe(1);
    expect(r.snapshotsCreated).toBe(1);
    expect(reportJobError).toHaveBeenCalledTimes(1);
    expect(reportJobError.mock.calls[0]![0]).toMatchObject({
      job: "cci-monthly-aggregation",
    });
  });
});
