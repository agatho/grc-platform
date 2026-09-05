// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. The job derives a "this control keeps failing"
// pattern from execution history. What must hold: the 50 % fail-rate gate, the
// confidence cap, the sample size carried into the row, and the conflict
// handling that stops the daily run from stacking duplicates.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  controlTestExecution: {
    orgId: "x",
    controlId: "x",
    result: "x",
  },
  controlTestLearning: { orgId: "x", controlId: "x", patternType: "x" },
}));

const stat = (total: number, fail: number, controlId = "ctl-1") => ({
  orgId: "org-1",
  controlId,
  totalTests: total,
  failCount: fail,
  passCount: total - fail,
});

async function run() {
  const { processControlTestLearning } =
    await import("../../src/crons/control-test-learning-updater");
  return processControlTestLearning();
}

function payload(index = 0): Record<string, unknown> {
  return (
    mockDb.insert.mock.results[index]!.value as {
      values: ReturnType<typeof vi.fn>;
    }
  ).values.mock.calls[0]![0] as Record<string, unknown>;
}

describe("processControlTestLearning", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("records nothing when there is no execution history", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as { patternsUpdated: number };
    expect(r).toEqual({ patternsUpdated: 0 });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("does not record a pattern at or below a 50 % fail rate", async () => {
    mockDb.select.mockReturnValue(chainable([stat(10, 5)]));
    const r = (await run()) as { patternsUpdated: number };
    // Exactly 50 % is not "keeps failing" — the threshold is strict.
    expect(r.patternsUpdated).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("records a common-failure pattern above a 50 % fail rate", async () => {
    mockDb.select.mockReturnValue(chainable([stat(10, 8)]));
    const r = (await run()) as { patternsUpdated: number };
    expect(r.patternsUpdated).toBe(1);

    const p = payload();
    expect(p.orgId).toBe("org-1");
    expect(p.controlId).toBe("ctl-1");
    expect(p.patternType).toBe("common_failure");
    expect(p.sampleSize).toBe(10);
    expect(p.confidence).toBe("80");
    expect((p.pattern as { description: string }).description).toContain("80%");
    expect((p.pattern as { frequency: number }).frequency).toBe(8);
    expect(
      (p.pattern as { conditions: { totalTests: number } }).conditions
        .totalTests,
    ).toBe(10);
  });

  it("caps the confidence at 99 so a 100 % fail rate is not stated as certainty", async () => {
    mockDb.select.mockReturnValue(chainable([stat(4, 4)]));
    await run();
    expect(payload().confidence).toBe("99");
  });

  it("does not stack duplicates on a daily re-run", async () => {
    mockDb.select.mockReturnValue(chainable([stat(10, 8)]));
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

  it("evaluates each control on its own numbers", async () => {
    mockDb.select.mockReturnValue(
      chainable([stat(10, 9, "ctl-a"), stat(10, 1, "ctl-b")]),
    );
    const r = (await run()) as { patternsUpdated: number };
    expect(r.patternsUpdated).toBe(1);
    expect(payload().controlId).toBe("ctl-a");
  });
});
