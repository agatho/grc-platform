// #S04-01 regression contract — audit ARCTOS-FULL-2026-08-31, Critical.
//
// `continuous_audit_rule.data_source->>'query'` was executed by the worker as
//
//   db.execute(sql.raw(`SET LOCAL statement_timeout = '60s'; ${query}`))
//
// on a connection authenticated as the DB SUPERUSER `grc` (BYPASSRLS, by
// design — docker-compose.production.yml). The only gate was the
// keyword blocklist `isReadOnlySql`, applied at rule-CREATION time only, and
// every payload in evidence/S04/isreadonlysql-bypass.txt passed it.
//
// These tests lock in the two-layer fix:
//
//   1. Every documented bypass payload is refused by the validator AT
//      EXECUTION TIME, and no statement carrying the payload text ever
//      reaches the database. A regression that reinstates the blocklist —
//      or that drops the runtime re-validation and trusts the creation-time
//      check — makes these fail.
//   2. A legitimate SELECT runs inside ONE transaction that issues
//      `SET LOCAL ROLE grc_app`, the org scope, the statement timeout and
//      `SET TRANSACTION READ ONLY` BEFORE the query — and fails CLOSED
//      (no query executed) when the role is unavailable.

import { describe, it, expect, beforeEach, vi } from "vitest";

// Statements handed to db.execute / tx.execute, in order.
let executed: string[] = [];
let roleShouldFail = false;
let dueRules: Record<string, unknown>[] = [];
let insertedResults: Record<string, unknown>[] = [];

function stmtText(stmt: unknown): string {
  const s = stmt as { __sqlText?: string };
  return s?.__sqlText ?? "";
}

// Capture SQL text without a live driver: sql`...`, sql.raw() and
// sql.identifier() all return marker objects carrying reconstructed text.
vi.mock("drizzle-orm", () => {
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = "";
    strings.forEach((part, i) => {
      text += part;
      if (i < values.length) {
        const v = values[i] as { __sqlText?: string } | undefined;
        text +=
          v && typeof v === "object" && "__sqlText" in v
            ? (v.__sqlText ?? "")
            : `$${i + 1}`;
      }
    });
    return { __sqlText: text, __values: values };
  }) as unknown as {
    (strings: TemplateStringsArray, ...values: unknown[]): unknown;
    raw: (s: string) => unknown;
    identifier: (s: string) => unknown;
  };
  sql.raw = (s: string) => ({ __sqlText: s });
  sql.identifier = (s: string) => ({ __sqlText: `"${s}"` });
  const noop = () => ({}) as unknown;
  return { sql, eq: noop, and: noop, desc: noop, asc: noop };
});

vi.mock("@grc/db", () => {
  const tx = {
    async execute(stmt: unknown) {
      const text = stmtText(stmt);
      executed.push(text);
      if (roleShouldFail && /SET LOCAL ROLE/i.test(text)) {
        const err = new Error('role "grc_app" does not exist') as Error & {
          code?: string;
        };
        err.code = "22023";
        throw err;
      }
      return [];
    },
  };

  const chain = (value: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "set", "values", "returning", "limit"]) {
      c[m] = () => c;
    }
    (c as { then: unknown }).then = (resolve: (v: unknown) => void) =>
      resolve(value);
    return c;
  };

  const table = new Proxy({}, { get: () => "col" });

  return {
    continuousAuditRule: table,
    continuousAuditResult: table,
    continuousAuditException: table,
    notification: table,
    get db() {
      return {
        select: () => chain(dueRules),
        insert: () => ({
          values: (v: Record<string, unknown> | Record<string, unknown>[]) => {
            if (!Array.isArray(v)) insertedResults.push(v);
            const c = chain([{ id: "result-1" }]);
            return c;
          },
        }),
        update: () => chain([]),
        async execute(stmt: unknown) {
          executed.push(stmtText(stmt));
          return [];
        },
        async transaction(cb: (t: typeof tx) => Promise<unknown>) {
          return cb(tx);
        },
      };
    },
  };
});

const ORG_ID = "22222222-2222-2222-2222-222222222222";

function rule(query: unknown) {
  return {
    id: "rule-1",
    orgId: ORG_ID,
    ruleType: "custom_sql",
    schedule: "daily",
    dataSource: { query },
    lastExecutedAt: null,
  };
}

async function runRunner() {
  const mod = await import("../../src/crons/continuous-audit-runner");
  return mod.processContinuousAuditRunner();
}

// The exact payloads from evidence/S04/isreadonlysql-bypass.txt, all of
// which the old keyword blocklist reported as "PASSES GUARD".
const BYPASS_PAYLOADS: Array<[string, string]> = [
  [
    "SELECT INTO (creates a table, no blocked keyword)",
    "SELECT * INTO evil_copy FROM organization",
  ],
  [
    "multi-statement DO block with string-split DDL/DML",
    "SELECT 1; DO $$ BEGIN EXECUTE 'CRE'||'ATE TABLE evil(x int)'; EXECUTE 'INS'||'ERT INTO evil VALUES (1)'; END $$",
  ],
  [
    "COPY FROM PROGRAM (remote code execution)",
    "SELECT 1; COPY t FROM PROGRAM 'id'",
  ],
  [
    "GRANT (privilege escalation)",
    "SELECT 1; GRANT ALL ON organization TO PUBLIC",
  ],
  ["pg_sleep (denial of service)", "SELECT pg_sleep(3600)"],
  ["trailing semicolon (multi-statement primer)", "SELECT 1;"],
  ["comment-hidden payload", "SELECT 1 -- ; DROP TABLE audit_log"],
  [
    "data-modifying CTE disguised as a read",
    "WITH x AS (INSERT INTO evil VALUES (1) RETURNING *) SELECT * FROM x",
  ],
  ["block-comment splice", "SELECT /* */ 1"],
  ["server-side file read", "SELECT pg_read_file('/etc/passwd')"],
];

describe("continuous-audit-runner — #S04-01 custom_sql execution guard", () => {
  beforeEach(() => {
    executed = [];
    insertedResults = [];
    roleShouldFail = false;
    dueRules = [];
    vi.resetModules();
  });

  for (const [label, payload] of BYPASS_PAYLOADS) {
    it(`refuses the documented bypass: ${label}`, async () => {
      dueRules = [rule(payload)];
      const result = await runRunner();

      // Nothing carrying the payload may have been sent to the database.
      const leaked = executed.filter((s) => s.includes(payload.slice(0, 24)));
      expect(leaked).toEqual([]);

      // …and the multi-statement primer must never be built at all.
      expect(
        executed.some((s) => /statement_timeout.*;.*SELECT/is.test(s)),
      ).toBe(false);

      // The rule is reported as an ERROR, not silently as "passed".
      expect(result.errors).toBe(1);
      expect(result.passed).toBe(0);
      const errorRow = insertedResults.find(
        (r) => r.resultStatus === "error",
      ) as { errorMessage?: string } | undefined;
      expect(errorRow).toBeDefined();
      expect(String(errorRow?.errorMessage)).toMatch(/rejected by validator/i);
    });
  }

  it("runs a legitimate SELECT under SET LOCAL ROLE grc_app, org scope and READ ONLY", async () => {
    dueRules = [rule("SELECT id FROM risk WHERE status = 'identified'")];
    const result = await runRunner();

    const roleIdx = executed.findIndex((s) =>
      /^SET LOCAL ROLE grc_app$/i.test(s.trim()),
    );
    const orgIdx = executed.findIndex((s) =>
      /set_config\('app\.current_org_id'/i.test(s),
    );
    const timeoutIdx = executed.findIndex((s) =>
      /SET LOCAL statement_timeout/i.test(s),
    );
    const readOnlyIdx = executed.findIndex((s) =>
      /SET TRANSACTION READ ONLY/i.test(s),
    );
    const queryIdx = executed.findIndex((s) => /custom_audit_rule/i.test(s));

    expect(roleIdx).toBeGreaterThanOrEqual(0);
    expect(orgIdx).toBeGreaterThanOrEqual(0);
    expect(timeoutIdx).toBeGreaterThanOrEqual(0);
    expect(readOnlyIdx).toBeGreaterThanOrEqual(0);
    expect(queryIdx).toBeGreaterThanOrEqual(0);

    // Role demotion happens FIRST, the user query LAST.
    expect(roleIdx).toBeLessThan(orgIdx);
    expect(roleIdx).toBeLessThan(queryIdx);
    expect(readOnlyIdx).toBeLessThan(queryIdx);

    // The timeout is its own statement, never concatenated with the query.
    expect(executed[timeoutIdx]).not.toMatch(/SELECT/i);
    // The query is bounded.
    expect(executed[queryIdx]).toMatch(/LIMIT/i);

    expect(result.errors).toBe(0);
  });

  it("fails closed: no query runs when the grc_app role is missing", async () => {
    roleShouldFail = true;
    dueRules = [rule("SELECT id FROM risk")];
    const result = await runRunner();

    expect(executed.some((s) => /custom_audit_rule/i.test(s))).toBe(false);
    expect(result.errors).toBe(1);
  });

  it("ignores a rule with no query instead of executing an empty statement", async () => {
    dueRules = [rule(undefined)];
    const result = await runRunner();
    expect(executed.some((s) => /SET LOCAL ROLE/i.test(s))).toBe(false);
    expect(result.errors).toBe(0);
  });
});
