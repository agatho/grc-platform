import { describe, it, expect, afterAll } from "vitest";
import { createTestDb, requireAt } from "../helpers";
import { TENANT_TABLE_RLS_EXCEPTIONS } from "../../src/rls-audit";

/**
 * Log-table RLS guard.
 *
 * ---------------------------------------------------------------------------
 * [ARCTOS-FULL-2026-08-31 / WP2 · S01-06, S01-16] Dieser Test hat sich
 * umgedreht.
 * ---------------------------------------------------------------------------
 * Er prüfte bis zur Remediation, dass `audit_log`, `access_log` und
 * `audit_anchor` KEINE RLS tragen — er zementierte damit den Befund S01-06 als
 * Sollzustand und wäre fehlgeschlagen, sobald jemand die Mandantentrennung
 * dieser Tabellen wiederherstellt.
 *
 * Die Ausnahme aus `0379_logtables_rls_exception.sql` ruhte auf zwei
 * Begründungen. Die erste (org-loses INSERT beim Login) trägt und ist in
 * `0396_rls_log_tables.sql` durch eine permissive INSERT-Policy gelöst — die
 * Form, die `0381` für `notification`/`data_export_log` bereits vorgemacht
 * hat. Die zweite (Lesen über die Org-Hierarchie via `includeDescendants`)
 * trug nicht: unter RLS zeigte die rekursive CTE auf `organization` immer nur
 * die eigene Org, die Funktion existierte im abgesicherten Betrieb also gar
 * nicht (S01-26). `app_current_org_scope()` löst sie jetzt sauber.
 *
 * Der Test prüft ab jetzt das Gegenteil: die Ausnahmeliste ist leer, die drei
 * Tabellen tragen RLS + FORCE + Policies, und der org-lose Login-INSERT
 * funktioniert weiterhin.
 */

const adminDb = createTestDb();
const LOG_TABLES = ["audit_log", "access_log", "audit_anchor"];

afterAll(async () => {
  await adminDb.client.end();
});

describe("Log-table RLS (S01-06)", () => {
  it("the exception list is empty — no tenant table may opt out of RLS", () => {
    expect([...TENANT_TABLE_RLS_EXCEPTIONS]).toEqual([]);
  });

  it("audit_log, access_log and audit_anchor carry RLS, FORCE and policies", async () => {
    const rows = await adminDb.client<
      { table: string; rls: boolean; forced: boolean; npol: number }[]
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
        AND c.relname = ANY(${LOG_TABLES})
      ORDER BY c.relname
    `;

    expect(rows.map((r) => r.table)).toEqual(LOG_TABLES.slice().sort());

    const offenders = rows.filter((r) => !r.rls || !r.forced || r.npol === 0);
    expect(
      offenders.map(
        (o) =>
          `${o.table} (rls=${o.rls}, forced=${o.forced}, policies=${o.npol})`,
      ),
      "Log tables must enforce tenant isolation — see migration 0396. " +
        "If a route needs cross-org reads over the org hierarchy, use " +
        "app_current_org_scope(), not a disabled policy.",
    ).toEqual([]);
  });

  it("each log table keeps a permissive INSERT policy for org-less writes", async () => {
    const rows = await adminDb.client<{ tablename: string }[]>`
      SELECT DISTINCT tablename FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = ANY(${LOG_TABLES})
         AND cmd = 'INSERT'
         AND btrim(coalesce(with_check, '')) = 'true'
       ORDER BY tablename
    `;
    expect(rows.map((r) => r.tablename)).toEqual(LOG_TABLES.slice().sort());
  });

  it("app_current_org_scope() exists, is SECURITY DEFINER and not PUBLIC-executable", async () => {
    const rows = await adminDb.client<
      { prosecdef: boolean; hasconfig: boolean; publicexec: boolean }[]
    >`
      SELECT p.prosecdef,
             (p.proconfig IS NOT NULL) AS hasconfig,
             EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
               AS publicexec
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'app_current_org_scope'
    `;
    expect(rows.length).toBe(1);
    expect(requireAt(rows, 0, "rows").prosecdef).toBe(true);
    expect(requireAt(rows, 0, "rows").hasconfig).toBe(true);
    expect(requireAt(rows, 0, "rows").publicexec).toBe(false);
  });
});
