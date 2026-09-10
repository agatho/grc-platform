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
import { withAuditContext, MAX_AUDIT_REASON_LENGTH } from "../../lib/api";

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
        (sql) => sql.includes("app.current_user_name") && sql.includes("Alice"),
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
    expect(actionDetailCalls[0]).toContain("status:identified→remediated");
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

// [ARCTOS-FULL-2026-08-31 · OP-124] `audit_log.metadata` ist unter Hash-v4
// direkte Hash-Eingabe und deshalb von `tombstone_audit_entry()` nicht
// erreichbar. Was hier durchkommt, überlebt jede DSGVO-Art.-17-Löschung.
describe("withAuditContext — Begründung ist nicht redigierbar (OP-124)", () => {
  async function reasonSql(reason: string): Promise<string> {
    txExecutions.length = 0;
    await withAuditContext(baseCtx, async () => null, { reason });
    return txExecutions.filter((sql) => sql.includes("app.audit_reason"))[0];
  }

  it("entfernt E-Mail-Adressen", async () => {
    const sql = await reasonSql(
      "Abgestimmt mit anna.meier@kunde.example am Freitag",
    );
    expect(sql).not.toContain("anna.meier@kunde.example");
    expect(sql).toContain("[E-Mail]");
    // Der Grund selbst bleibt lesbar — genau das ist der Zweck des Feldes.
    expect(sql).toContain("Abgestimmt mit");
  });

  it("entfernt lange Ziffernfolgen, behält kurze Aktenzeichen", async () => {
    const sql = await reasonSql(
      "Telefonisch bestätigt: 0151 23456789, AZ 4711",
    );
    expect(sql).not.toContain("23456789");
    expect(sql).toContain("[Nummer]");
    expect(sql).toContain("AZ 4711");
  });

  it("deckelt die Länge — vorher stand hier ausdrücklich 'no length cap'", async () => {
    const sql = await reasonSql("A".repeat(5000));
    const wert = sql.slice(sql.indexOf("«") + 1, sql.lastIndexOf("»"));
    expect(wert.length).toBeLessThanOrEqual(MAX_AUDIT_REASON_LENGTH);
  });

  it("lässt eine unverfängliche Begründung unverändert", async () => {
    const sql = await reasonSql(
      "Quarterly review found remediation sufficient",
    );
    expect(sql).toContain("Quarterly review found remediation sufficient");
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
