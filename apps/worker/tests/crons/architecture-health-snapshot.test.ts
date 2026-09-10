// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. This job persists a governance score that ends up
// on a management dashboard, so the score arithmetic and the per-org error
// isolation are what a test has to hold.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const reportJobError = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  organization: { id: "x" },
  architectureHealthSnapshot: {},
  applicationPortfolio: { orgId: "x" },
  technologyEntry: { orgId: "x" },
  architectureRuleViolation: { orgId: "x", status: "x" },
  dataFlow: { orgId: "x" },
}));

vi.mock("../../src/lib/job-runtime", () => ({
  reportJobError: (...args: unknown[]) => reportJobError(...args),
}));

async function run() {
  const { processArchitectureHealthSnapshot } =
    await import("../../src/crons/architecture-health-snapshot");
  return processArchitectureHealthSnapshot();
}

/** Queues the org list plus one org's four metric queries. */
function queueOrg(
  orgs: { id: string }[],
  metrics: {
    apps: { total: number; healthy: number };
    tech: { total: number; current: number };
    violations: number;
    flows: { personalTotal: number; compliant: number };
  },
) {
  mockDb.select
    .mockReturnValueOnce(chainable(orgs))
    .mockReturnValueOnce(chainable([metrics.apps]))
    .mockReturnValueOnce(chainable([metrics.tech]))
    .mockReturnValueOnce(chainable([{ count: metrics.violations }]))
    .mockReturnValueOnce(chainable([metrics.flows]));
}

function insertPayload(index = 0): Record<string, number | string> {
  return (
    mockDb.insert.mock.results[index]!.value as {
      values: ReturnType<typeof vi.fn>;
    }
  ).values.mock.calls[0]![0] as Record<string, number | string>;
}

describe("processArchitectureHealthSnapshot", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    reportJobError.mockReset();
  });

  it("writes no snapshot when there is no organisation", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as { orgsProcessed: number };
    expect(r).toEqual({ orgsProcessed: 0 });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("scores an empty landscape as perfect rather than as zero", async () => {
    queueOrg([{ id: "org-1" }], {
      apps: { total: 0, healthy: 0 },
      tech: { total: 0, current: 0 },
      violations: 0,
      flows: { personalTotal: 0, compliant: 0 },
    });

    const r = (await run()) as { orgsProcessed: number };
    expect(r.orgsProcessed).toBe(1);

    const p = insertPayload();
    // No applications, no technology, no violations, no personal data flows:
    // dividing by zero must not turn into a 0 % health score on a board
    // dashboard. 100*.2 + 100*.2 + 80*.15 + 80*.15 + 100*.15 + 100*.15 = 94
    expect(p.portfolioAgeScore).toBe(100);
    expect(p.technologyCurrencyScore).toBe(100);
    expect(p.dataFlowComplianceScore).toBe(100);
    expect(p.overallScore).toBe(94);
    expect(p.orgId).toBe("org-1");
  });

  it("derives each factor from its own metric", async () => {
    queueOrg([{ id: "org-1" }], {
      apps: { total: 10, healthy: 6 }, // 60 %
      tech: { total: 4, current: 1 }, // 25 %
      violations: 3, // 100 - 15 = 85
      flows: { personalTotal: 4, compliant: 3 }, // 75 %
    });

    await run();
    const p = insertPayload();
    expect(p.portfolioAgeScore).toBe(60);
    expect(p.technologyCurrencyScore).toBe(25);
    expect(p.ruleViolations).toBe(3);
    expect(p.dataFlowComplianceScore).toBe(75);
    // 60*.2 + 25*.2 + 80*.15 + 80*.15 + 85*.15 + 75*.15 = 65
    expect(p.overallScore).toBe(65);
  });

  it("floors rule compliance at zero instead of going negative", async () => {
    queueOrg([{ id: "org-1" }], {
      apps: { total: 1, healthy: 1 },
      tech: { total: 1, current: 1 },
      violations: 100, // 100 - 500 → must clamp to 0
      flows: { personalTotal: 1, compliant: 1 },
    });

    await run();
    const p = insertPayload();
    // 100*.2 + 100*.2 + 80*.15 + 80*.15 + 0*.15 + 100*.15 = 79
    expect(p.overallScore).toBe(79);
    expect(p.ruleViolations).toBe(100);
  });

  it("isolates a failing org and reports it instead of swallowing it (S10-11)", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([{ id: "org-1" }, { id: "org-2" }]))
      // org-1: first metric query blows up
      .mockImplementationOnce(() => {
        throw new Error("statement timeout");
      })
      // org-2: complete metric set
      .mockReturnValueOnce(chainable([{ total: 0, healthy: 0 }]))
      .mockReturnValueOnce(chainable([{ total: 0, current: 0 }]))
      .mockReturnValueOnce(chainable([{ count: 0 }]))
      .mockReturnValueOnce(chainable([{ personalTotal: 0, compliant: 0 }]));

    const r = (await run()) as { orgsProcessed: number };
    expect(r.orgsProcessed).toBe(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(reportJobError).toHaveBeenCalledTimes(1);
    expect(reportJobError.mock.calls[0]![0]).toMatchObject({
      job: "architecture-health-snapshot",
    });
  });
});
