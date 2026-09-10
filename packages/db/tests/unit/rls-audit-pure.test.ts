// [ARCTOS-FULL-2026-08-31 / WP11 · S11-10]
//
// WHAT THIS FILE USED TO BE. It declared a local `type TableStatus` and a local
// `function classify(t)` that RE-IMPLEMENTED the classification rules of
// `runRlsAudit()`, then asserted that the copy behaved as written. The
// production function was never called. Deleting `src/rls-audit.ts` would have
// left every test in the file green — which is how `packages/db` came to report
// 409 passing tests at 0.04 % function coverage.
//
// WHAT IT IS NOW. `runRlsAudit()` itself is exercised. The five `db.execute`
// calls it makes (relations, org_id columns, foreign keys, RLS state,
// policies) are fed canned rows and the assertions are on the report it
// returns. Each case below corresponds to a finding the audit raised, so a
// regression in the detector shows up here and not only in the live system
// test — which needs a database and therefore cannot guard a refactor made
// without one.

import { describe, it, expect, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("../../src/index", () => ({
  db: {
    execute: (...args: unknown[]) => execute(...args),
  },
}));

interface Relation {
  table_name: string;
  relkind: "r" | "v" | "m";
}
interface RlsRow {
  table_name: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
  reloptions: string | null;
  readable_by_app: boolean;
}
interface PolicyRow {
  tablename: string;
  policyname: string;
  cmd: string;
  permissive: string;
  qual: string | null;
  with_check: string | null;
}

/** Queues the five result sets `runRlsAudit()` reads, in order. */
function queue(opts: {
  relations: Relation[];
  orgIdTables?: string[];
  fks?: { child: string; parent: string }[];
  rls?: RlsRow[];
  policies?: PolicyRow[];
}) {
  execute.mockReset();
  execute
    .mockResolvedValueOnce(opts.relations)
    .mockResolvedValueOnce(
      (opts.orgIdTables ?? []).map((t) => ({ table_name: t })),
    )
    .mockResolvedValueOnce(opts.fks ?? [])
    .mockResolvedValueOnce(opts.rls ?? [])
    .mockResolvedValueOnce(opts.policies ?? []);
}

const ORG_SCOPED_EXPR =
  "(org_id = (NULLIF(current_setting('app.current_org_id'::text, true), ''::text))::uuid)";

const ALL_CMDS: PolicyRow[] = ["SELECT", "INSERT", "UPDATE", "DELETE"].map(
  (cmd) => ({
    tablename: "risk",
    policyname: `risk_${cmd.toLowerCase()}`,
    cmd,
    permissive: "PERMISSIVE",
    qual: ORG_SCOPED_EXPR,
    with_check: ORG_SCOPED_EXPR,
  }),
);

const HEALTHY_RLS: RlsRow = {
  table_name: "risk",
  relrowsecurity: true,
  relforcerowsecurity: true,
  reloptions: null,
  readable_by_app: true,
};

async function audit() {
  const { runRlsAudit } = await import("../../src/rls-audit");
  return runRlsAudit();
}

type Report = Awaited<ReturnType<typeof audit>>;

function statusOf(report: Report, table: string): string {
  const row = report.tables.find((t) => t.tableName === table);
  if (!row) throw new Error(`table ${table} missing from report`);
  return row.status;
}

describe("runRlsAudit — the real classifier, not a copy of it", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("reports a fully guarded tenant table as ok and counts no gap", async () => {
    queue({
      relations: [{ table_name: "risk", relkind: "r" }],
      orgIdTables: ["risk"],
      rls: [HEALTHY_RLS],
      policies: ALL_CMDS,
    });
    const report = await audit();
    expect(statusOf(report, "risk")).toBe("ok");
    expect(report.gaps).toHaveLength(0);
    expect(report.counts.tenantTables).toBe(1);
    expect(report.counts.ok).toBe(1);
  });

  it("flags a tenant table without RLS (S01-03)", async () => {
    queue({
      relations: [{ table_name: "risk", relkind: "r" }],
      orgIdTables: ["risk"],
      rls: [{ ...HEALTHY_RLS, relrowsecurity: false }],
      policies: ALL_CMDS,
    });
    const report = await audit();
    expect(statusOf(report, "risk")).toBe("missing_rls");
    expect(report.gaps).toHaveLength(1);
  });

  it("flags RLS without FORCE (S01-20)", async () => {
    queue({
      relations: [{ table_name: "risk", relkind: "r" }],
      orgIdTables: ["risk"],
      rls: [{ ...HEALTHY_RLS, relforcerowsecurity: false }],
      policies: ALL_CMDS,
    });
    expect(statusOf(await audit(), "risk")).toBe("missing_force");
  });

  it("flags a missing command policy and names the command", async () => {
    queue({
      relations: [{ table_name: "risk", relkind: "r" }],
      orgIdTables: ["risk"],
      rls: [HEALTHY_RLS],
      policies: ALL_CMDS.filter((p) => p.cmd !== "DELETE"),
    });
    const report = await audit();
    const row = report.tables.find((t) => t.tableName === "risk")!;
    expect(row.status).toBe("missing_policies");
    expect(row.note).toContain("DELETE");
  });

  it("accepts a single ALL policy as covering every command", async () => {
    queue({
      relations: [{ table_name: "risk", relkind: "r" }],
      orgIdTables: ["risk"],
      rls: [HEALTHY_RLS],
      policies: [{ ...ALL_CMDS[0]!, cmd: "ALL", policyname: "risk_all" }],
    });
    expect(statusOf(await audit(), "risk")).toBe("ok");
  });

  // ── the four policy defects the audit found; the tool must detect them ──

  it("detects the app.bypass_rls escape hatch (S01-02)", async () => {
    queue({
      relations: [{ table_name: "risk", relkind: "r" }],
      orgIdTables: ["risk"],
      rls: [HEALTHY_RLS],
      policies: [
        {
          ...ALL_CMDS[0]!,
          cmd: "ALL",
          policyname: "risk_all",
          qual: `(current_setting('app.bypass_rls', true) = 'on') OR ${ORG_SCOPED_EXPR}`,
        },
      ],
    });
    const row = (await audit()).tables[0]!;
    expect(row.status).toBe("weak_policy");
    expect(row.note).toContain("app.bypass_rls");
  });

  it("detects an org_id IS NULL writable policy (S01-07)", async () => {
    queue({
      relations: [{ table_name: "risk", relkind: "r" }],
      orgIdTables: ["risk"],
      rls: [HEALTHY_RLS],
      policies: [
        {
          ...ALL_CMDS[0]!,
          cmd: "ALL",
          policyname: "risk_all",
          qual: `((org_id IS NULL) OR ${ORG_SCOPED_EXPR})`,
        },
      ],
    });
    const row = (await audit()).tables[0]!;
    expect(row.status).toBe("weak_policy");
    expect(row.note).toContain("S01-07");
  });

  it("detects a current_org_id cast without the NULLIF guard (S01-18)", async () => {
    queue({
      relations: [{ table_name: "risk", relkind: "r" }],
      orgIdTables: ["risk"],
      rls: [HEALTHY_RLS],
      policies: [
        {
          ...ALL_CMDS[0]!,
          cmd: "ALL",
          policyname: "risk_all",
          qual: "(org_id = (current_setting('app.current_org_id'::text))::uuid)",
          with_check: null,
        },
      ],
    });
    const row = (await audit()).tables[0]!;
    expect(row.status).toBe("weak_policy");
    expect(row.note).toContain("S01-18");
  });

  it("detects a ::text comparison instead of uuid (S01-25)", async () => {
    queue({
      relations: [{ table_name: "risk", relkind: "r" }],
      orgIdTables: ["risk"],
      rls: [HEALTHY_RLS],
      policies: [
        {
          ...ALL_CMDS[0]!,
          cmd: "ALL",
          policyname: "risk_all",
          qual: "((org_id)::text = current_setting('app.current_org_id'::text, true))",
          with_check: null,
        },
      ],
    });
    const row = (await audit()).tables[0]!;
    expect(row.status).toBe("weak_policy");
    expect(row.note).toContain("S01-25");
  });

  // ── the object classes the old tool was blind to (S01-15) ───────────────

  it("flags a view without security_invoker (S01-08)", async () => {
    queue({
      relations: [{ table_name: "v_risk_summary", relkind: "v" }],
      rls: [
        {
          table_name: "v_risk_summary",
          relrowsecurity: false,
          relforcerowsecurity: false,
          reloptions: null,
          readable_by_app: true,
        },
      ],
    });
    const row = (await audit()).tables[0]!;
    expect(row.scope).toBe("view");
    expect(row.status).toBe("view_not_invoker");
  });

  it("accepts a view with security_invoker=true", async () => {
    queue({
      relations: [{ table_name: "v_risk_summary", relkind: "v" }],
      rls: [
        {
          table_name: "v_risk_summary",
          relrowsecurity: false,
          relforcerowsecurity: false,
          reloptions: "security_invoker=true",
          readable_by_app: true,
        },
      ],
    });
    expect(statusOf(await audit(), "v_risk_summary")).toBe("ok");
  });

  it("flags a materialized view that grc_app can read (S01-08)", async () => {
    queue({
      relations: [{ table_name: "mv_kpi", relkind: "m" }],
      rls: [
        {
          table_name: "mv_kpi",
          relrowsecurity: false,
          relforcerowsecurity: false,
          reloptions: null,
          readable_by_app: true,
        },
      ],
    });
    expect(statusOf(await audit(), "mv_kpi")).toBe("matview_readable");
  });

  it("classifies an org-less table with an FK path to a tenant table as a tenant child (S01-03)", async () => {
    queue({
      relations: [
        { table_name: "risk", relkind: "r" },
        { table_name: "risk_comment", relkind: "r" },
      ],
      orgIdTables: ["risk"],
      fks: [{ child: "risk_comment", parent: "risk" }],
      rls: [
        HEALTHY_RLS,
        {
          table_name: "risk_comment",
          relrowsecurity: false,
          relforcerowsecurity: false,
          reloptions: null,
          readable_by_app: true,
        },
      ],
      policies: ALL_CMDS,
    });
    const report = await audit();
    const child = report.tables.find((t) => t.tableName === "risk_comment")!;
    expect(child.scope).toBe("tenant_child");
    expect(child.status).toBe("missing_rls");
    expect(child.note).toContain("CHILD");
  });

  it("does not classify a genuinely global table as tenant-scoped", async () => {
    queue({
      relations: [{ table_name: "feature_gate", relkind: "r" }],
      rls: [
        {
          table_name: "feature_gate",
          relrowsecurity: false,
          relforcerowsecurity: false,
          reloptions: null,
          readable_by_app: true,
        },
      ],
    });
    const report = await audit();
    expect(statusOf(report, "feature_gate")).toBe("platform_ignored");
    expect(report.gaps).toHaveLength(0);
  });

  it("keeps the RLS exception list empty (S01-06)", async () => {
    const { TENANT_TABLE_RLS_EXCEPTIONS } = await import("../../src/rls-audit");
    expect(
      Array.from(TENANT_TABLE_RLS_EXCEPTIONS),
      "Every entry here switches tenant isolation OFF for that table. " +
        "The set must stay empty (WP2 / S01-06).",
    ).toEqual([]);
  });
});
