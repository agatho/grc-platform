// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape")` asserting
// `expect(r).toBeDefined()`. This job recomputes consent metrics and raises a
// dark-pattern alert above a 30 % withdrawal rate — the arithmetic, the
// threshold and the "no divide-by-zero on an unused consent type" case are
// what the tests hold.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const insertNotification = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  consentType: { id: "x", orgId: "x", name: "x", createdBy: "x" },
  consentRecord: { consentTypeId: "x", withdrawnAt: "x" },
  notification: {},
}));

vi.mock("../../src/lib/notify", () => ({
  insertNotification: (...args: unknown[]) => insertNotification(...args),
}));

async function run() {
  const { processConsentMetrics } =
    await import("../../src/crons/consent-metrics-updater");
  return processConsentMetrics();
}

type Result = { processed: number; alerts: number };

/** types → per type: total given, total withdrawn */
function queue(
  types: Array<Record<string, unknown>>,
  counts: Array<[number, number]>,
) {
  mockDb.select.mockReturnValueOnce(chainable(types));
  for (const [given, withdrawn] of counts) {
    mockDb.select
      .mockReturnValueOnce(chainable([{ value: given }]))
      .mockReturnValueOnce(chainable([{ value: withdrawn }]));
  }
  mockDb.select.mockReturnValue(chainable([{ value: 0 }]));
}

function setPayload(index = 0): Record<string, unknown> {
  return (
    mockDb.update.mock.results[index]!.value as {
      set: ReturnType<typeof vi.fn>;
    }
  ).set.mock.calls[0]![0] as Record<string, unknown>;
}

const TYPE = {
  id: "ct-1",
  orgId: "org-1",
  name: "Newsletter",
  createdBy: "user-1",
};

describe("processConsentMetrics", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    insertNotification.mockReset();
    insertNotification.mockResolvedValue(true);
  });

  it("does nothing when no consent type exists", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r).toEqual({ processed: 0, alerts: 0 });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("writes given, withdrawn, active and the rate for each type", async () => {
    queue([TYPE], [[200, 40]]);
    const r = (await run()) as Result;

    expect(r.processed).toBe(1);
    const p = setPayload();
    expect(p.totalGiven).toBe(200);
    expect(p.totalWithdrawn).toBe(40);
    expect(p.activeConsents).toBe(160);
    expect(p.withdrawalRate).toBe("20.00");
    expect(p.metricsUpdatedAt).toBeInstanceOf(Date);
  });

  it("reports a 0 % rate for an unused consent type instead of NaN", async () => {
    queue([TYPE], [[0, 0]]);
    await run();
    const p = setPayload();
    expect(p.withdrawalRate).toBe("0.00");
    expect(p.activeConsents).toBe(0);
  });

  it("raises no alert at or below the 30 % threshold", async () => {
    queue([TYPE], [[100, 30]]);
    const r = (await run()) as Result;
    expect(r.alerts).toBe(0);
    expect(insertNotification).not.toHaveBeenCalled();
  });

  it("raises a dark-pattern alert above the 30 % threshold", async () => {
    queue([TYPE], [[100, 31]]);
    const r = (await run()) as Result;
    expect(r.alerts).toBe(1);
    expect(insertNotification).toHaveBeenCalledTimes(1);

    const payload = insertNotification.mock.calls[0]![0] as {
      orgId: string;
      userId: string;
      type: string;
      entityId: string;
      title: string;
    };
    expect(payload.orgId).toBe("org-1");
    expect(payload.userId).toBe("user-1");
    expect(payload.type).toBe("escalation");
    expect(payload.entityId).toBe("ct-1");
    expect(payload.title).toContain("Newsletter");
  });

  it("does not alert a consent type without an owner to alert", async () => {
    queue([{ ...TYPE, createdBy: null }], [[100, 90]]);
    const r = (await run()) as Result;
    expect(r.processed).toBe(1);
    expect(r.alerts).toBe(0);
    expect(insertNotification).not.toHaveBeenCalled();
  });
});
