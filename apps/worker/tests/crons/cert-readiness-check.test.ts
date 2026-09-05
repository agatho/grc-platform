// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. This job recomputes the certification readiness
// percentage a customer shows an auditor, so the formula, the not-applicable
// handling and the "only write when it changed" rule are what must not drift.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  certReadinessAssessment: {
    id: "x",
    orgId: "x",
    framework: "x",
    status: "x",
    readinessScore: "x",
  },
}));

async function run() {
  const { processCertReadinessCheck } =
    await import("../../src/crons/cert-readiness-check");
  return processCertReadinessCheck();
}

type Result = { processed: number; updated: number };

function setPayload(index = 0): Record<string, string | number> {
  return (
    mockDb.update.mock.results[index]!.value as {
      set: ReturnType<typeof vi.fn>;
    }
  ).set.mock.calls[0]![0] as Record<string, string | number>;
}

const s = (status: string) => ({ status });

describe("processCertReadinessCheck", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("does nothing when no assessment is active", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r).toEqual({ processed: 0, updated: 0 });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("counts a partially implemented control as half (implemented + 0.5*partial)", async () => {
    mockDb.select.mockReturnValue(
      chainable([
        {
          id: "a-1",
          readinessScore: "0",
          controlDetails: [
            s("implemented"),
            s("implemented"),
            s("partial"),
            s("not_implemented"),
          ],
        },
      ]),
    );

    const r = (await run()) as Result;
    expect(r).toEqual({ processed: 1, updated: 1 });

    // (2 + 0.5) / 4 * 100 = 62.5
    const p = setPayload();
    expect(p.readinessScore).toBe("62.50");
    expect(p.implementedControls).toBe(2);
    expect(p.partialControls).toBe(1);
    expect(p.notImplemented).toBe(1);
    expect(p.notApplicable).toBe(0);
  });

  it("excludes not_applicable controls from the denominator", async () => {
    mockDb.select.mockReturnValue(
      chainable([
        {
          id: "a-1",
          readinessScore: "0",
          controlDetails: [
            s("implemented"),
            s("not_applicable"),
            s("not_applicable"),
            s("not_implemented"),
          ],
        },
      ]),
    );

    await run();
    // 1 of 2 applicable = 50 %, not 25 % of all four.
    const p = setPayload();
    expect(p.readinessScore).toBe("50.00");
    expect(p.notApplicable).toBe(2);
  });

  it("skips an assessment whose controls are all not_applicable instead of dividing by zero", async () => {
    mockDb.select.mockReturnValue(
      chainable([
        {
          id: "a-1",
          readinessScore: "0",
          controlDetails: [s("not_applicable"), s("not_applicable")],
        },
      ]),
    );
    const r = (await run()) as Result;
    expect(r.processed).toBe(1);
    expect(r.updated).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("does not rewrite the row when the score is unchanged", async () => {
    mockDb.select.mockReturnValue(
      chainable([
        {
          id: "a-1",
          readinessScore: "50.00",
          controlDetails: [s("implemented"), s("not_implemented")],
        },
      ]),
    );
    const r = (await run()) as Result;
    // 50 % now, 50 % before: an UPDATE would only churn updated_at and the
    // audit trail.
    expect(r.updated).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("skips an assessment with no control details and still counts it as processed", async () => {
    mockDb.select.mockReturnValue(
      chainable([{ id: "a-1", readinessScore: "0", controlDetails: [] }]),
    );
    const r = (await run()) as Result;
    expect(r).toEqual({ processed: 1, updated: 0 });
  });

  it("isolates a failing assessment and keeps going", async () => {
    mockDb.select.mockReturnValue(
      chainable([
        { id: "a-1", readinessScore: "0", controlDetails: [s("implemented")] },
        { id: "a-2", readinessScore: "0", controlDetails: [s("implemented")] },
      ]),
    );
    let call = 0;
    mockDb.update.mockImplementation(() => {
      call++;
      if (call === 1) throw new Error("row locked");
      return chainable([]);
    });

    const r = (await run()) as Result;
    expect(r.processed).toBe(2);
    expect(r.updated).toBe(1);
  });
});
