// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. This job publishes cross-tenant benchmark data,
// so the properties that matter are: only consented submissions are
// aggregated, the k-anonymity threshold stays in the query, the pool row
// carries the values the aggregation produced, and a failure is counted
// instead of swallowed.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const reportJobError = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  benchmarkSubmission: { id: "x", poolId: "x", value: "x" },
  benchmarkPool: { id: "x", metricKey: "x" },
}));

vi.mock("../../src/lib/job-runtime", () => ({
  reportJobError: (...args: unknown[]) => reportJobError(...args),
}));

const AGG = {
  module_key: "isms",
  industry: "healthcare",
  org_size_range: "51-250",
  participant_count: 7,
  avg_score: "72.50",
  median_score: "71.00",
  p25_score: "65.00",
  p75_score: "80.00",
};

async function run() {
  const { processBenchmarkAggregator } =
    await import("../../src/crons/benchmark-aggregator");
  return processBenchmarkAggregator();
}

type Result = {
  poolsUpdated: number;
  submissionsProcessed: number;
  errors: number;
};

describe("processBenchmarkAggregator", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    reportJobError.mockReset();
  });

  it("writes no pool when no group reaches the participant threshold", async () => {
    mockDb.execute.mockResolvedValue([]);
    const r = (await run()) as Result;
    expect(r).toEqual({
      poolsUpdated: 0,
      submissionsProcessed: 0,
      errors: 0,
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("keeps the consent filter and the k-anonymity floor in the aggregation query", async () => {
    mockDb.execute.mockResolvedValue([]);
    await run();

    const arg = mockDb.execute.mock.calls[0]![0] as { queryChunks?: unknown[] };
    const text = JSON.stringify(arg);
    // Both clauses are the entire privacy argument for publishing this data
    // across tenants — an aggregation without them is a disclosure.
    expect(text).toContain("consent_given = true");
    expect(text).toContain("count(*) >= 5");
  });

  it("carries the aggregation into the pool row unchanged", async () => {
    mockDb.execute.mockResolvedValue([AGG]);
    const r = (await run()) as Result;

    expect(r.poolsUpdated).toBe(1);
    expect(r.submissionsProcessed).toBe(1);
    expect(r.errors).toBe(0);

    const payload = (
      mockDb.insert.mock.results[0]!.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.moduleKey).toBe("isms");
    expect(payload.industry).toBe("healthcare");
    expect(payload.participantCount).toBe(7);
    expect(payload.avgScore).toBe("72.50");
    expect(payload.p25Score).toBe("65.00");
    expect(payload.p75Score).toBe("80.00");
    expect(String(payload.periodLabel)).toMatch(/^Q[1-4]-\d{4}$/);
  });

  it("counts a failing pool write and continues with the next group", async () => {
    mockDb.execute.mockResolvedValue([AGG, { ...AGG, module_key: "erm" }]);
    let call = 0;
    mockDb.insert.mockImplementation(() => {
      call++;
      if (call === 1) throw new Error("unique violation");
      return { values: vi.fn().mockResolvedValue(undefined) };
    });

    const r = (await run()) as Result;
    expect(r.poolsUpdated).toBe(1);
    expect(r.errors).toBe(1);
    expect(r.submissionsProcessed).toBe(2);
    expect(reportJobError).toHaveBeenCalledTimes(1);
  });

  it("reports — not hides — a failure of the aggregation query itself", async () => {
    mockDb.execute.mockRejectedValue(new Error("relation does not exist"));
    const r = (await run()) as Result;
    expect(r.errors).toBe(1);
    expect(r.poolsUpdated).toBe(0);
    expect(reportJobError).toHaveBeenCalledTimes(1);
  });
});
