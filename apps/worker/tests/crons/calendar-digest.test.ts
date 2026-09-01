// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("runs without error with empty calendar")` asserting
// `expect(r).toBeDefined()`. WP9 rewrote this job for S10-14 (transaction-local
// org context instead of a session GUC on the shared pool), S10-10 (dedupe key
// per user/org/week) and S10-07 (skip revoked memberships). Those three
// properties are exactly what the tests below hold — the old assertion held
// none of them.

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

const MEMBERS = [
  {
    org_id: "org-1",
    user_id: "user-1",
    user_name: "Ada Lovelace",
    email: "ada@example.com",
  },
  {
    org_id: "org-2",
    user_id: "user-1",
    user_name: "Ada Lovelace",
    email: "ada@example.com",
  },
];

const EVENTS = [
  { title: "ISO Audit", start_at: "2026-09-03T09:00:00Z", module: "audit" },
  { title: "DPIA review", start_at: "2026-09-04T09:00:00Z", module: "manual" },
];

async function run() {
  const { processCalendarDigest } =
    await import("../../src/crons/calendar-digest");
  return processCalendarDigest();
}

type Result = {
  processed: number;
  digestsCreated: number;
  ok: boolean;
  failed: number;
  errors: string[];
};

describe("processCalendarDigest", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    withOrgContext.mockReset();
    insertNotification.mockReset();
    txExecute = vi.fn().mockResolvedValue(EVENTS);
    withOrgContext.mockImplementation(
      async (_orgId: string, fn: (tx: unknown) => unknown) =>
        fn({ execute: txExecute }),
    );
    insertNotification.mockResolvedValue(true);
  });

  it("stops early and writes nothing when no active member exists", async () => {
    mockDb.execute.mockResolvedValue([]);
    const r = (await run()) as Result;
    expect(r.processed).toBe(0);
    expect(r.digestsCreated).toBe(0);
    expect(withOrgContext).not.toHaveBeenCalled();
    expect(insertNotification).not.toHaveBeenCalled();
  });

  it("filters revoked memberships and deactivated users in the query (S10-07)", async () => {
    mockDb.execute.mockResolvedValue([]);
    await run();
    const text = JSON.stringify(mockDb.execute.mock.calls[0]![0]);
    expect(text).toContain("uor.deleted_at IS NULL");
    expect(text).toContain("u.is_active = true");
    expect(text).toContain("u.deleted_at IS NULL");
  });

  it("opens one transaction-scoped org context per membership, never a session GUC (S10-14)", async () => {
    mockDb.execute.mockResolvedValue(MEMBERS);
    const r = (await run()) as Result;

    // One user with two orgs → one context per (user, org).
    expect(r.processed).toBe(1);
    expect(withOrgContext).toHaveBeenCalledTimes(2);
    expect(withOrgContext.mock.calls.map((c) => c[0])).toEqual([
      "org-1",
      "org-2",
    ]);
    // The event query must run on the transaction handle, not on the pool.
    expect(txExecute).toHaveBeenCalledTimes(2);
    expect(mockDb.execute).toHaveBeenCalledTimes(1); // the member query only
  });

  it("carries a per user/org/week dedupe key so a re-run creates no second digest (S10-10)", async () => {
    mockDb.execute.mockResolvedValue([MEMBERS[0]!]);
    await run();

    expect(insertNotification).toHaveBeenCalledTimes(1);
    const opts = insertNotification.mock.calls[0]![1] as {
      dedupeKey: string;
      job: string;
      tx: unknown;
    };
    expect(opts.job).toBe("calendar-digest");
    expect(opts.tx).toBeDefined();
    expect(opts.dedupeKey).toMatch(
      /^calendar-digest\|org-1\|user-1\|\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("counts only the digests that were actually written", async () => {
    mockDb.execute.mockResolvedValue(MEMBERS);
    // Second org: dedup suppressed the write.
    insertNotification.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const r = (await run()) as Result;
    expect(insertNotification).toHaveBeenCalledTimes(2);
    expect(r.digestsCreated).toBe(1);
  });

  it("writes no digest for a week without events", async () => {
    mockDb.execute.mockResolvedValue([MEMBERS[0]!]);
    txExecute.mockResolvedValue([]);
    const r = (await run()) as Result;
    expect(insertNotification).not.toHaveBeenCalled();
    expect(r.digestsCreated).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("reports a failed membership as a partial failure instead of success (S10-12)", async () => {
    mockDb.execute.mockResolvedValue(MEMBERS);
    withOrgContext
      .mockImplementationOnce(async () => {
        throw new Error("RLS denied");
      })
      .mockImplementationOnce(
        async (_orgId: string, fn: (tx: unknown) => unknown) =>
          fn({ execute: txExecute }),
      );

    const r = (await run()) as Result;
    expect(r.ok).toBe(false);
    expect(r.failed).toBe(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain("org-1");
    // The raw driver message must not travel back over HTTP (S10-22).
    expect(r.errors[0]).not.toContain("RLS denied");
    expect(r.digestsCreated).toBe(1);
  });
});
