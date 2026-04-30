import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  dataBreach: {
    id: "x",
    orgId: "x",
    title: "x",
    severity: "x",
    detectedAt: "x",
    dpoId: "x",
    assigneeId: "x",
    createdBy: "x",
    status: "x",
    deletedAt: "x",
    isDpaNotificationRequired: "x",
    dpaNotifiedAt: "x",
  },
  notification: {},
}));

function breach(over: Partial<{ id: string; detectedAt: Date; dpoId: string | null; assigneeId: string | null; createdBy: string | null }> = {}) {
  return {
    id: "b1",
    orgId: "org",
    title: "Customer DB exposure",
    severity: "high",
    detectedAt: new Date(),
    dpoId: "dpo-1",
    assigneeId: null,
    createdBy: null,
    ...over,
  };
}

describe("processBreach72hMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero when no active breaches", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { processBreach72hMonitor } = await import(
      "../../src/crons/breach-72h-monitor"
    );
    const r = await processBreach72hMonitor();
    expect(r.processed).toBe(0);
    expect(r.notified).toBe(0);
  });

  it("warns at 48h threshold (~23.5h after detection)", async () => {
    // ~23.5h ago → ~48.5h remaining → floor to 48 → in (>47 && <=48]
    const detectedAt = new Date(Date.now() - (23 * 3600 + 1800) * 1000);
    mockDb.select.mockReturnValueOnce(chainable([breach({ detectedAt })]));
    const { processBreach72hMonitor } = await import(
      "../../src/crons/breach-72h-monitor"
    );
    const r = await processBreach72hMonitor();
    expect(r.notified).toBeGreaterThanOrEqual(1);
  });

  it("warns at 24h threshold (~47.5h after detection)", async () => {
    // Detection ~47.5h ago → ~24.5h remaining → floor to 24 → in (>23 && <=24]
    const detectedAt = new Date(Date.now() - (47 * 3600 + 1800) * 1000);
    mockDb.select.mockReturnValueOnce(chainable([breach({ detectedAt })]));
    const { processBreach72hMonitor } = await import(
      "../../src/crons/breach-72h-monitor"
    );
    const r = await processBreach72hMonitor();
    expect(r.notified).toBe(1);
  });

  it("warns OVERDUE when 72h elapsed", async () => {
    const detectedAt = new Date(Date.now() - 80 * 3600 * 1000); // 80h ago = -8h remaining
    mockDb.select.mockReturnValueOnce(chainable([breach({ detectedAt })]));
    const { processBreach72hMonitor } = await import(
      "../../src/crons/breach-72h-monitor"
    );
    const r = await processBreach72hMonitor();
    expect(r.notified).toBe(1);
    const insertChain = mockDb.insert.mock.results[0]?.value as {
      values: ReturnType<typeof vi.fn>;
    };
    const payload = insertChain.values.mock.calls[0]![0];
    expect(payload.title).toMatch(/OVERDUE/i);
  });

  it("does NOT warn between thresholds (e.g. 36h remaining)", async () => {
    // 36h ago = 36h remaining → not in any warning window
    const detectedAt = new Date(Date.now() - 36 * 3600 * 1000);
    mockDb.select.mockReturnValueOnce(chainable([breach({ detectedAt })]));
    const { processBreach72hMonitor } = await import(
      "../../src/crons/breach-72h-monitor"
    );
    const r = await processBreach72hMonitor();
    expect(r.notified).toBe(0);
  });

  it("falls back to assignee then creator when no DPO assigned", async () => {
    const detectedAt = new Date(Date.now() - 24 * 3600 * 1000);
    mockDb.select.mockReturnValueOnce(
      chainable([
        breach({ detectedAt, dpoId: null, assigneeId: "assignee-1" }),
      ]),
    );
    const { processBreach72hMonitor } = await import(
      "../../src/crons/breach-72h-monitor"
    );
    const r = await processBreach72hMonitor();
    expect(r.notified).toBe(1);
    const payload = (
      mockDb.insert.mock.results[0]?.value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values.mock.calls[0]![0];
    expect(payload.userId).toBe("assignee-1");
  });

  it("skips breach without any recipient", async () => {
    const detectedAt = new Date(Date.now() - 24 * 3600 * 1000);
    mockDb.select.mockReturnValueOnce(
      chainable([
        breach({
          detectedAt,
          dpoId: null,
          assigneeId: null,
          createdBy: null,
        }),
      ]),
    );
    const { processBreach72hMonitor } = await import(
      "../../src/crons/breach-72h-monitor"
    );
    const r = await processBreach72hMonitor();
    expect(r.notified).toBe(0);
  });
});
