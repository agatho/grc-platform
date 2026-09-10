// Test for Whistleblowing-Deadline-Monitor (HinSchG / EU 2019/1937).
//
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected result shape with no cases")` asserting
// `expect(r).toBeDefined()`. This job sends whistleblower CASE NUMBERS and
// missed-HinSchG-deadline notices; §8 HinSchG requires strict confidentiality
// towards everyone not entrusted with the report. WP9 fixed the admin lookup
// for S10-07 (a REVOKED admin role is a soft delete and was still returned).
//
// The tests hold: the four deadline queries, the confidentiality filters on
// the recipient lookup, warnings vs. breaches, and the error isolation from
// S10-11.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const insertNotification = vi.fn();
const reportJobError = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  wbCase: {},
  notification: {},
  user: {},
}));

vi.mock("../../src/lib/notify", () => ({
  insertNotification: (...args: unknown[]) => insertNotification(...args),
}));

vi.mock("../../src/lib/job-runtime", () => ({
  reportJobError: (...args: unknown[]) => reportJobError(...args),
}));

const ackCase = {
  id: "case-1",
  org_id: "org-1",
  case_number: "WB-2026-001",
  assigned_to: "officer-1",
  acknowledge_deadline: "2026-09-03T00:00:00Z",
};
const respCase = {
  id: "case-2",
  org_id: "org-1",
  case_number: "WB-2026-002",
  assigned_to: "officer-1",
  response_deadline: "2026-11-03T00:00:00Z",
};

/** Flattens a drizzle `sql` template back into its literal text. */
function sqlText(arg: unknown): string {
  const chunks = (arg as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((c) =>
      c &&
      typeof c === "object" &&
      Array.isArray((c as { value?: unknown }).value)
        ? (c as { value: string[] }).value.join("")
        : "",
    )
    .join("");
}

/**
 * The job interleaves queries: each breach row triggers an admin lookup before
 * the next case query runs, so a fixed `mockResolvedValueOnce` sequence
 * mis-assigns results (that is how the first draft of this test lied to
 * itself). Dispatch on the query text instead — it survives a reordering of
 * the job without silently testing the wrong thing.
 */
function queue(opts: {
  ackWarn?: unknown[];
  respWarn?: unknown[];
  ackBreach?: unknown[];
  respBreach?: unknown[];
  admins?: unknown[];
}) {
  mockDb.execute.mockImplementation(async (arg: unknown) => {
    const q = sqlText(arg);
    if (q.includes("user_organization_role")) return opts.admins ?? [];
    if (q.includes("acknowledge_deadline > NOW()")) return opts.ackWarn ?? [];
    if (q.includes("response_deadline > NOW()")) return opts.respWarn ?? [];
    if (q.includes("acknowledge_deadline < NOW()")) return opts.ackBreach ?? [];
    if (q.includes("response_deadline < NOW()")) return opts.respBreach ?? [];
    throw new Error(`unexpected query in wb-deadline-monitor: ${q}`);
  });
}

/** All queries the job issued, as text. */
function issuedQueries(): string[] {
  return mockDb.execute.mock.calls.map((c) => sqlText(c[0]));
}

async function run() {
  const { processWbDeadlineMonitor } =
    await import("../../src/crons/wb-deadline-monitor");
  return processWbDeadlineMonitor();
}

type Result = { processed: number; warnings: number; breaches: number };

describe("processWbDeadlineMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    insertNotification.mockReset();
    reportJobError.mockReset();
    insertNotification.mockResolvedValue(true);
  });

  it("notifies nobody when no deadline is near or missed", async () => {
    queue({});
    const r = (await run()) as Result;
    expect(r).toEqual({ processed: 0, warnings: 0, breaches: 0 });
    expect(insertNotification).not.toHaveBeenCalled();
  });

  it("checks all four HinSchG deadline conditions", async () => {
    queue({});
    await run();
    const queries = issuedQueries();
    expect(queries).toHaveLength(4);
    // 7-day acknowledgment: warning window and breach.
    expect(queries[0]).toContain("acknowledge_deadline");
    expect(queries[0]).toContain("2 days");
    expect(queries[2]).toContain("acknowledge_deadline < NOW()");
    // 3-month response: warning window and breach.
    expect(queries[1]).toContain("response_deadline");
    expect(queries[1]).toContain("14 days");
    expect(queries[3]).toContain("response_deadline < NOW()");
  });

  it("warns the assigned case handler before the acknowledgment deadline", async () => {
    queue({ ackWarn: [ackCase] });
    const r = (await run()) as Result;

    expect(r.warnings).toBe(1);
    expect(r.breaches).toBe(0);
    expect(r.processed).toBe(1);

    const payload = insertNotification.mock.calls[0]![0] as {
      userId: string;
      orgId: string;
      type: string;
      entityType: string;
      title: string;
    };
    expect(payload.userId).toBe("officer-1");
    expect(payload.orgId).toBe("org-1");
    expect(payload.type).toBe("deadline_approaching");
    expect(payload.entityType).toBe("wb_case");
    expect(payload.title).toContain("WB-2026-001");
  });

  it("sends nothing for an unassigned case rather than broadcasting it", async () => {
    queue({ ackWarn: [{ ...ackCase, assigned_to: null }] });
    const r = (await run()) as Result;
    // §8 HinSchG: without an entrusted handler there is nobody to tell.
    expect(insertNotification).not.toHaveBeenCalled();
    expect(r.warnings).toBe(0);
    expect(r.processed).toBe(1);
  });

  it("escalates a missed acknowledgment deadline to the org admins", async () => {
    queue({ ackBreach: [ackCase], admins: [{ id: "adm-1" }, { id: "adm-2" }] });
    const r = (await run()) as Result;

    expect(r.breaches).toBe(1);
    expect(insertNotification).toHaveBeenCalledTimes(2);
    const payload = insertNotification.mock.calls[0]![0] as {
      type: string;
      title: string;
      templateKey: string;
    };
    expect(payload.type).toBe("escalation");
    expect(payload.title).toContain("SLA BREACH");
    expect(payload.templateKey).toBe("wb_sla_breach_ack");
  });

  it("excludes revoked and deactivated admins from the recipient list (S10-07)", async () => {
    queue({ ackBreach: [ackCase], admins: [{ id: "adm-1" }] });
    await run();

    const adminQuery = issuedQueries().find((q) =>
      q.includes("user_organization_role"),
    )!;
    expect(adminQuery, "the admin lookup was never issued").toBeTruthy();
    // A revoked admin role is a SOFT delete. Without these filters a former
    // admin keeps receiving whistleblower case numbers.
    expect(adminQuery).toContain("uor.deleted_at IS NULL");
    expect(adminQuery).toContain("u.is_active = true");
    expect(adminQuery).toContain("u.deleted_at IS NULL");
    expect(adminQuery).toContain("role = 'admin'");
  });

  it("counts warnings and breaches separately across all four conditions", async () => {
    queue({
      ackWarn: [ackCase],
      respWarn: [respCase],
      ackBreach: [ackCase],
      respBreach: [respCase],
      admins: [{ id: "adm-1" }],
    });
    const r = (await run()) as Result;
    expect(r.warnings).toBe(2);
    expect(r.breaches).toBe(2);
    expect(r.processed).toBe(4);
  });

  it("reports a failing row instead of swallowing it (S10-11)", async () => {
    queue({ ackWarn: [ackCase] });
    insertNotification.mockRejectedValueOnce(new Error("notify insert failed"));

    const r = (await run()) as Result;
    expect(r.warnings).toBe(0);
    expect(reportJobError).toHaveBeenCalledTimes(1);
    expect(reportJobError.mock.calls[0]![0]).toMatchObject({
      job: "wb-deadline-monitor",
    });
  });
});
