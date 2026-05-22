// Tests for withAuditContext — the wrapper every mutation in the
// codebase uses to set Postgres session variables that the
// audit_trigger reads when writing audit_log rows.
//
// The most important property pinned here: action_detail and
// reason are ALWAYS set per transaction, even when the caller
// passes no annotation. Without that empty-string reset, a
// leftover value from a previous transaction on the same pooled
// connection would bleed into the next audit_log entry and
// silently misattribute the "why" of an action.
//
// Pre-Wave-26 the wrapper had no unit tests on the bleed guard.
// A future refactor that "optimised" away the empty set_config
// calls would silently regress every audit-log entry into stale
// metadata territory and the test suite wouldn't notice.

import { describe, it, expect, vi, beforeEach } from "vitest";

const txExecutions: string[] = [];

const fakeTx = {
  execute: vi.fn((query: { sql?: string; queryChunks?: unknown[] }) => {
    const text =
      query?.sql ??
      (Array.isArray(query?.queryChunks)
        ? query.queryChunks.map((c) => String(c)).join("")
        : String(query));
    txExecutions.push(text);
    return Promise.resolve([]);
  }),
};

vi.mock("@grc/db", () => ({
  db: {
    transaction: async <T>(fn: (tx: typeof fakeTx) => Promise<T>) => fn(fakeTx),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: (
    parts: TemplateStringsArray,
    ...args: unknown[]
  ): { sql: string; args: unknown[] } => ({
    sql: parts
      .map((p, i) => p + (i < args.length ? `«${String(args[i])}»` : ""))
      .join(""),
    args,
  }),
}));

vi.mock("next-auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Import after mocks so withAuditContext picks up the mocked modules.
import { withAuditContext } from "../../lib/api";

const baseCtx = {
  orgId: "org-1",
  userId: "user-1",
  session: { user: { email: "alice@example.com", name: "Alice" } },
} as Parameters<typeof withAuditContext>[0];

beforeEach(() => {
  txExecutions.length = 0;
  fakeTx.execute.mockClear();
});

describe("withAuditContext — session variable plumbing", () => {
  it("sets all 6 session variables in one transaction", async () => {
    await withAuditContext(baseCtx, async () => "ok");
    // 4 mandatory (org_id, user_id, user_email, user_name)
    // + 2 annotation (action_detail, reason)
    expect(fakeTx.execute).toHaveBeenCalledTimes(6);
  });

  it("sets app.current_org_id from ctx.orgId", async () => {
    await withAuditContext(baseCtx, async () => null);
    expect(txExecutions.some((sql) => sql.includes("app.current_org_id"))).toBe(
      true,
    );
    expect(txExecutions.some((sql) => sql.includes("«org-1»"))).toBe(true);
  });

  it("sets app.current_user_id from ctx.userId", async () => {
    await withAuditContext(baseCtx, async () => null);
    expect(
      txExecutions.some((sql) => sql.includes("app.current_user_id")),
    ).toBe(true);
    expect(txExecutions.some((sql) => sql.includes("«user-1»"))).toBe(true);
  });

  it("sets email + name from ctx.session.user", async () => {
    await withAuditContext(baseCtx, async () => null);
    expect(
      txExecutions.some(
        (sql) =>
          sql.includes("app.current_user_email") &&
          sql.includes("alice@example.com"),
      ),
    ).toBe(true);
    expect(
      txExecutions.some(
        (sql) =>
          sql.includes("app.current_user_name") && sql.includes("Alice"),
      ),
    ).toBe(true);
  });
});

describe("withAuditContext — bleed guard (critical)", () => {
  it("sets app.audit_action_detail to empty string when annotation omitted", async () => {
    await withAuditContext(baseCtx, async () => null);
    const actionDetailCalls = txExecutions.filter((sql) =>
      sql.includes("app.audit_action_detail"),
    );
    expect(actionDetailCalls).toHaveLength(1);
    // The interpolated value must be "" — not "undefined", not absent,
    // not the previous call's value. Pattern: SELECT set_config('app.
    // audit_action_detail', '', true)
    expect(actionDetailCalls[0]).toMatch(/«»/);
  });

  it("sets app.audit_reason to empty string when annotation omitted", async () => {
    await withAuditContext(baseCtx, async () => null);
    const reasonCalls = txExecutions.filter((sql) =>
      sql.includes("app.audit_reason"),
    );
    expect(reasonCalls).toHaveLength(1);
    expect(reasonCalls[0]).toMatch(/«»/);
  });

  it("propagates explicit actionDetail value", async () => {
    await withAuditContext(baseCtx, async () => null, {
      actionDetail: "status:identified→remediated",
    });
    const actionDetailCalls = txExecutions.filter((sql) =>
      sql.includes("app.audit_action_detail"),
    );
    expect(actionDetailCalls[0]).toContain(
      "status:identified→remediated",
    );
  });

  it("propagates explicit reason value", async () => {
    await withAuditContext(baseCtx, async () => null, {
      reason: "Quarterly review found remediation sufficient",
    });
    const reasonCalls = txExecutions.filter((sql) =>
      sql.includes("app.audit_reason"),
    );
    expect(reasonCalls[0]).toContain(
      "Quarterly review found remediation sufficient",
    );
  });

  it("two consecutive calls without annotation leave neither bleeding", async () => {
    // Call 1 sets a value
    await withAuditContext(baseCtx, async () => null, {
      actionDetail: "first",
      reason: "first-reason",
    });
    const callsAfter1 = txExecutions.length;
    txExecutions.length = 0;
    // Call 2 omits annotation — must reset to empty string
    await withAuditContext(baseCtx, async () => null);
    const actionDetailCalls = txExecutions.filter((sql) =>
      sql.includes("app.audit_action_detail"),
    );
    const reasonCalls = txExecutions.filter((sql) =>
      sql.includes("app.audit_reason"),
    );
    expect(actionDetailCalls[0]).toMatch(/«»/);
    expect(reasonCalls[0]).toMatch(/«»/);
    void callsAfter1;
  });
});

describe("withAuditContext — return + propagation", () => {
  it("returns the handler's resolved value unchanged", async () => {
    const result = await withAuditContext(baseCtx, async () => ({
      id: "row-1",
      name: "row-name",
    }));
    expect(result).toEqual({ id: "row-1", name: "row-name" });
  });

  it("re-throws handler errors so the transaction rolls back", async () => {
    await expect(
      withAuditContext(baseCtx, async () => {
        throw new Error("simulated DB error");
      }),
    ).rejects.toThrow("simulated DB error");
  });
});
