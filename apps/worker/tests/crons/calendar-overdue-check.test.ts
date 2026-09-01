// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected shape")` asserting `expect(r).toBeDefined()`.
// WP9 rewrote this job for S10-14 (transaction-local org context), S10-10 (one
// escalation per entity, recipient and day — a daily repeat stops working as
// an escalation) and S10-12 (a partial failure must not be reported as
// success). Those are the properties under test here.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const withOrgContext = vi.fn();
const insertNotification = vi.fn();
let txExecute: ReturnType<typeof vi.fn>;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  notification: {},
}));

vi.mock("../../src/lib/org-context", () => ({
  withOrgContext: (...args: unknown[]) => withOrgContext(...args),
}));

vi.mock("../../src/lib/notify", () => ({
  insertNotification: (...args: unknown[]) => insertNotification(...args),
}));

/** The three overdue queries, in the order the job issues them. */
function queueOverdue(
  dsrs: unknown[],
  breaches: unknown[],
  findings: unknown[],
) {
  txExecute
    .mockResolvedValueOnce(dsrs)
    .mockResolvedValueOnce(breaches)
    .mockResolvedValueOnce(findings);
}

async function run() {
  const { processCalendarOverdueCheck } =
    await import("../../src/crons/calendar-overdue-check");
  return processCalendarOverdueCheck();
}

type Result = {
  processed: number;
  overdueFound: number;
  escalationsSent: number;
  ok: boolean;
  failed: number;
  errors: string[];
};

describe("processCalendarOverdueCheck", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withOrgContext.mockReset();
    insertNotification.mockReset();
    txExecute = vi.fn().mockResolvedValue([]);
    withOrgContext.mockImplementation(
      async (_orgId: string, fn: (tx: unknown) => unknown) =>
        fn({ execute: txExecute }),
    );
    insertNotification.mockResolvedValue(true);
  });

  it("returns a clean zero run when there is no organisation", async () => {
    mockDb.execute.mockResolvedValue([]);
    const r = (await run()) as Result;
    expect(r.processed).toBe(0);
    expect(r.overdueFound).toBe(0);
    expect(r.escalationsSent).toBe(0);
    expect(r.ok).toBe(true);
    expect(withOrgContext).not.toHaveBeenCalled();
  });

  it("runs every query inside a transaction-local org context (S10-14)", async () => {
    mockDb.execute.mockResolvedValue([{ id: "org-1" }]);
    const r = (await run()) as Result;
    expect(withOrgContext).toHaveBeenCalledTimes(1);
    expect(withOrgContext.mock.calls[0]![0]).toBe("org-1");
    expect(txExecute).toHaveBeenCalledTimes(3); // dsr, breach, finding
    expect(mockDb.execute).toHaveBeenCalledTimes(1); // org list only
    expect(r.processed).toBe(1);
  });

  it("escalates each overdue item to its assignee with a per-day dedupe key (S10-10)", async () => {
    mockDb.execute.mockResolvedValue([{ id: "org-1" }]);
    queueOverdue(
      [{ id: "dsr-1", assignee: "user-1", title: "DSR: access" }],
      [{ id: "brc-1", assignee: "user-2", title: "Breach 72h: laptop" }],
      [{ id: "fnd-1", assignee: "user-3", title: "Finding: patching" }],
    );

    const r = (await run()) as Result;
    expect(r.overdueFound).toBe(3);
    expect(r.escalationsSent).toBe(3);

    const keys = insertNotification.mock.calls.map(
      (c) => (c[1] as { dedupeKey: string }).dedupeKey,
    );
    expect(keys[0]).toMatch(
      /^calendar-overdue\|dsr\|dsr-1\|user-1\|\d{4}-\d{2}-\d{2}$/,
    );
    expect(keys[1]).toMatch(/^calendar-overdue\|data_breach\|brc-1\|user-2\|/);
    expect(keys[2]).toMatch(/^calendar-overdue\|finding\|fnd-1\|user-3\|/);

    // Every write must join the caller's transaction, not open its own.
    for (const call of insertNotification.mock.calls) {
      expect((call[1] as { tx?: unknown }).tx).toBeDefined();
      expect((call[1] as { job: string }).job).toBe("calendar-overdue-check");
    }
  });

  it("marks a missed 72-hour breach notification as URGENT", async () => {
    mockDb.execute.mockResolvedValue([{ id: "org-1" }]);
    queueOverdue(
      [],
      [{ id: "brc-1", assignee: "user-2", title: "Breach 72h: laptop" }],
      [],
    );
    await run();
    const payload = insertNotification.mock.calls[0]![0] as {
      title: string;
      type: string;
      entityType: string;
    };
    // Art. 33 GDPR: this one is not the same class of reminder as an overdue
    // finding, and the wording is what the recipient triages on.
    expect(payload.title).toContain("URGENT");
    expect(payload.type).toBe("escalation");
    expect(payload.entityType).toBe("data_breach");
  });

  it("counts an unassigned overdue item but sends no escalation into the void", async () => {
    mockDb.execute.mockResolvedValue([{ id: "org-1" }]);
    queueOverdue(
      [{ id: "dsr-1", assignee: null, title: "DSR: access" }],
      [],
      [],
    );
    const r = (await run()) as Result;
    expect(r.overdueFound).toBe(1);
    expect(r.escalationsSent).toBe(0);
    expect(insertNotification).not.toHaveBeenCalled();
  });

  it("counts only escalations that were really written (dedup suppressed the rest)", async () => {
    mockDb.execute.mockResolvedValue([{ id: "org-1" }]);
    queueOverdue(
      [
        { id: "dsr-1", assignee: "user-1", title: "DSR: access" },
        { id: "dsr-2", assignee: "user-1", title: "DSR: erasure" },
      ],
      [],
      [],
    );
    insertNotification.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const r = (await run()) as Result;
    expect(r.overdueFound).toBe(2);
    expect(r.escalationsSent).toBe(1);
  });

  it("reports a failing org as a partial failure, not as success (S10-12)", async () => {
    mockDb.execute.mockResolvedValue([{ id: "org-1" }, { id: "org-2" }]);
    withOrgContext
      .mockImplementationOnce(async () => {
        throw new Error("permission denied for table dsr");
      })
      .mockImplementationOnce(
        async (_orgId: string, fn: (tx: unknown) => unknown) =>
          fn({ execute: txExecute }),
      );

    const r = (await run()) as Result;
    expect(r.ok).toBe(false);
    expect(r.failed).toBe(1);
    expect(r.errors[0]).toContain("org-1");
    // Driver text must stay out of the HTTP body (S10-22).
    expect(r.errors[0]).not.toContain("permission denied");
  });
});
