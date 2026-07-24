// #SEC-F02 regression contract — pentest HIGH finding.
//
// POST /api/v1/bi-reports/queries/execute runs a stored, admin-authored
// SELECT via sql.raw(). The only tenant boundary is Row-Level Security,
// which is a no-op the moment the app pool connects as a superuser /
// BYPASSRLS role. These tests lock in the defense-in-depth fix:
//
//   1. Happy path: the stored query is executed inside a transaction that
//      FIRST issues `SET LOCAL ROLE grc_app` and then sets
//      `app.current_org_id`, so RLS is enforced regardless of how the app
//      itself authenticated.
//   2. Fail-closed: if the `grc_app` role is missing (SET LOCAL ROLE
//      throws), the endpoint returns 500 and the user-supplied query is
//      NEVER executed — no unguarded fallback.
//
// A regression that strips the role demotion (e.g. someone "simplifying"
// the transaction) would make test #1 fail; a regression that runs the
// query anyway when the role is missing would make test #2 fail.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();

// Records every statement handed to tx.execute, in order, as { text, raw }.
let executed: { text: string; raw: boolean }[] = [];
// Flip to true to simulate the grc_app role not existing.
let roleShouldFail = false;
// Row returned for the stored-query lookup (db.select()).
let storedQueryRow: Record<string, unknown> | undefined;

const MOCK_ROWS = [{ id: "r1" }, { id: "r2" }];

function stmtText(stmt: unknown): { text: string; raw: boolean } {
  const s = stmt as { __sqlText?: string; __raw?: boolean };
  return { text: s?.__sqlText ?? "", raw: Boolean(s?.__raw) };
}

vi.mock("@grc/db", () => {
  const tx = {
    async execute(stmt: unknown) {
      const rec = stmtText(stmt);
      executed.push(rec);
      if (roleShouldFail && /SET LOCAL ROLE/i.test(rec.text)) {
        const err = new Error('role "grc_app" does not exist') as Error & {
          code?: string;
        };
        err.code = "22023";
        throw err;
      }
      // The user query is the only statement that carries a LIMIT clause.
      if (/LIMIT/i.test(rec.text)) return MOCK_ROWS;
      return [];
    },
  };
  return {
    biQuery: {
      id: "id",
      orgId: "orgId",
      status: "status",
      lastValidatedAt: "lastValidatedAt",
      validationError: "validationError",
      sqlText: "sqlText",
    },
    get db() {
      return {
        select() {
          return {
            from() {
              return {
                where() {
                  return Promise.resolve(
                    storedQueryRow ? [storedQueryRow] : [],
                  );
                },
              };
            },
          };
        },
        async transaction(cb: (t: typeof tx) => Promise<unknown>) {
          return cb(tx);
        },
        update() {
          return {
            set() {
              return { where: () => Promise.resolve([]) };
            },
          };
        },
      };
    },
  };
});

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
}));

// Capture SQL text without a live driver. sql`...` and sql.raw() both
// return a marker object carrying the reconstructed statement text.
vi.mock("drizzle-orm", () => {
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => ({
    __sqlText: strings.join("?"),
    __values: values,
    __raw: false,
  })) as unknown as {
    (strings: TemplateStringsArray, ...values: unknown[]): unknown;
    raw: (s: string) => unknown;
  };
  sql.raw = (s: string) => ({ __sqlText: s, __raw: true });
  const noop = () => ({}) as unknown;
  return { sql, eq: noop, and: noop };
});

const QUERY_ID = "11111111-1111-1111-1111-111111111111";
const ORG_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";

function makeReq() {
  return new Request("http://localhost/api/v1/bi-reports/queries/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ queryId: QUERY_ID, limit: 100 }),
  });
}

describe("bi-reports execute — #SEC-F02 org-scoping role enforcement", () => {
  beforeEach(() => {
    executed = [];
    roleShouldFail = false;
    storedQueryRow = {
      id: QUERY_ID,
      orgId: ORG_ID,
      sqlText: "SELECT id FROM risk",
      status: "draft",
    };
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuthMock.mockResolvedValue({
      orgId: ORG_ID,
      userId: USER_ID,
      session: { user: { email: "admin@arctos.dev", name: "Admin" } },
    });
    requireModuleMock.mockResolvedValue(undefined);
  });

  it("runs the stored query under SET LOCAL ROLE grc_app with org context", async () => {
    const { POST } =
      await import("../../app/api/v1/bi-reports/queries/execute/route");
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const roleIdx = executed.findIndex(
      (e) => e.raw && /^SET LOCAL ROLE grc_app$/i.test(e.text),
    );
    const orgIdx = executed.findIndex((e) =>
      /set_config\('app.current_org_id'/i.test(e.text),
    );
    const queryIdx = executed.findIndex((e) => /LIMIT/i.test(e.text));

    // All three ran…
    expect(roleIdx).toBeGreaterThanOrEqual(0);
    expect(orgIdx).toBeGreaterThanOrEqual(0);
    expect(queryIdx).toBeGreaterThanOrEqual(0);
    // …and the role demotion happened BEFORE the org scope and the query.
    expect(roleIdx).toBeLessThan(orgIdx);
    expect(roleIdx).toBeLessThan(queryIdx);
    expect(orgIdx).toBeLessThan(queryIdx);
  });

  it("fails closed (500) and never runs the query when grc_app is missing", async () => {
    roleShouldFail = true;
    const { POST } =
      await import("../../app/api/v1/bi-reports/queries/execute/route");
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/provision/i);

    // The user-supplied query (the LIMIT-bearing statement) must NOT have
    // executed — the role demotion threw and the txn rolled back.
    expect(executed.some((e) => /LIMIT/i.test(e.text))).toBe(false);
  });
});
