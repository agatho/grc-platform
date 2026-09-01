// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. The job writes a financial projection into the
// cost ledger, so the burn-rate arithmetic, the forecast/actual separation and
// the per-org error isolation are what must be pinned.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x", deletedAt: "x" },
  grcBudget: { id: "x", orgId: "x", year: "x", totalAmount: "x" },
  grcBudgetLine: {
    budgetId: "x",
    grcArea: "x",
    costCategory: "x",
    plannedAmount: "x",
  },
  grcCostEntry: {
    orgId: "x",
    entityId: "x",
    entityType: "x",
    costCategory: "x",
    costType: "x",
    amount: "x",
    periodStart: "x",
    periodEnd: "x",
  },
}));

async function run() {
  const { processBudgetForecast } =
    await import("../../src/crons/budget-forecast");
  return processBudgetForecast();
}

type Result = { processed: number; orgsProcessed: number; errors: number };

function payload(index = 0): Record<string, string> {
  return (
    mockDb.insert.mock.results[index]!.value as {
      values: ReturnType<typeof vi.fn>;
    }
  ).values.mock.calls[0]![0] as Record<string, string>;
}

describe("processBudgetForecast", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    // Pin the clock: the forecast is a function of the month, so a test that
    // does not fix it asserts something different in January than in June.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z")); // month 4 of 12
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing for an org without a budget for the current year", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }]))
      .mockReturnValueOnce(chainable([])); // no budget
    const r = (await run()) as Result;
    expect(r).toEqual({ processed: 0, orgsProcessed: 1, errors: 0 });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("extrapolates the year-to-date burn rate over the remaining months", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }]))
      .mockReturnValueOnce(chainable([{ id: "bud-1", totalAmount: "120000" }]))
      .mockReturnValueOnce(chainable([])) // budget lines
      .mockReturnValueOnce(
        chainable([{ costCategory: "licenses", total: "40000" }]),
      );

    const r = (await run()) as Result;
    expect(r.processed).toBe(1);
    expect(r.errors).toBe(0);

    // 40 000 over 4 months = 10 000/month; 8 months remain → 40 000 + 80 000.
    const p = payload();
    expect(p.amount).toBe("120000");
    expect(p.costCategory).toBe("licenses");
    expect(p.costType).toBe("forecast");
    expect(p.entityType).toBe("budget_forecast");
    expect(p.entityId).toBe("bud-1");
    expect(p.periodStart).toBe("2026-01-01");
    expect(p.periodEnd).toBe("2026-12-31");
    expect(p.description).toContain("10000.00/month");
  });

  it("never writes the projection as an actual cost", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }]))
      .mockReturnValueOnce(chainable([{ id: "bud-1", totalAmount: "1" }]))
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([
          { costCategory: "licenses", total: "100" },
          { costCategory: "staff", total: "300" },
        ]),
      );

    await run();
    const types = mockDb.insert.mock.results.map(
      (res) =>
        (
          (res.value as { values: ReturnType<typeof vi.fn> }).values.mock
            .calls[0]![0] as { costType: string }
        ).costType,
    );
    // A forecast row that lands as `actual` would be extrapolated again on the
    // next run and compound every week.
    expect(types).toEqual(["forecast", "forecast"]);
  });

  it("counts a failing org and keeps processing the next one", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }, { id: "org-2" }]))
      .mockImplementationOnce(() => {
        throw new Error("statement timeout");
      })
      .mockReturnValueOnce(chainable([{ id: "bud-2", totalAmount: "10" }]))
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ costCategory: "tooling", total: "100" }]),
      );

    const r = (await run()) as Result;
    expect(r.orgsProcessed).toBe(2);
    expect(r.errors).toBe(1);
    expect(r.processed).toBe(1);
  });
});
