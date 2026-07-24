import { describe, it, expect, afterAll } from "vitest";
import { createTestDb } from "../helpers";
import { TENANT_TABLE_RLS_EXCEPTIONS } from "../../src/rls-audit";

/**
 * Log-table RLS-exception regression guard (Pentest F-01 follow-up).
 *
 * The tables in TENANT_TABLE_RLS_EXCEPTIONS (audit_log, access_log,
 * data_export_log, notification, audit_anchor) are append-only log/anchor
 * tables that the auth- and worker-flow write WITHOUT an org context
 * (org_id may be NULL — e.g. access_log at login time). They MUST NOT carry
 * active RLS: an org-based policy rejects those org-less INSERTs and breaks
 * login under the non-superuser `grc_app` role.
 *
 * Migration 0379_logtables_rls_exception.sql explicitly disables RLS and
 * drops every policy on these tables. This test pins that state: if a future
 * gap-closure migration (like 0315/0336 did) re-enables RLS or adds a policy
 * to one of them, CI fails here with the offending table named.
 *
 * The static audit in rls-coverage-systemtest.test.ts does NOT catch this —
 * it classifies exception-list tables as "ok" no matter their RLS state, so
 * a dedicated check is required.
 */

const adminDb = createTestDb();
const exceptionTables = [...TENANT_TABLE_RLS_EXCEPTIONS];

afterAll(async () => {
  await adminDb.client.end();
});

describe("Log-table RLS exception (F-01 regression guard)", () => {
  it("every TENANT_TABLE_RLS_EXCEPTIONS table has RLS disabled and zero policies", async () => {
    const rows = await adminDb.client<
      {
        table: string;
        rls: boolean;
        forced: boolean;
        npol: number;
      }[]
    >`
      SELECT c.relname AS table,
             c.relrowsecurity AS rls,
             c.relforcerowsecurity AS forced,
             (
               SELECT count(*)::int FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname
             ) AS npol
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname = ANY(${exceptionTables})
      ORDER BY c.relname
    `;

    // Every whitelisted table that exists in this environment must be
    // RLS-free. (Tables absent on a lagging environment simply aren't
    // returned — nothing to enforce.)
    const offenders = rows.filter(
      (r) => r.rls === true || r.forced === true || r.npol > 0,
    );

    if (offenders.length > 0) {
      const detail = offenders
        .map(
          (o) =>
            `${o.table} (rls=${o.rls}, forced=${o.forced}, policies=${o.npol})`,
        )
        .join(", ");
      throw new Error(
        `RLS re-enabled on log-exception table(s): ${detail}. ` +
          `These must stay RLS-free (see migration 0379 + rls-audit.ts ` +
          `TENANT_TABLE_RLS_EXCEPTIONS). A gap-closure migration likely ` +
          `swept them in — add an exclusion and a follow-up disable migration.`,
      );
    }

    expect(offenders).toEqual([]);
  });
});
