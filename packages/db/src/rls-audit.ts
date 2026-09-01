/**
 * RLS Coverage Audit (ADR-001 enforcement check)
 *
 * ADR-001 requires every tenant-scoped object to enforce multi-entity
 * isolation via PostgreSQL RLS. This module queries pg_catalog and reports,
 * per object, whether that is actually the case.
 *
 * ---------------------------------------------------------------------------
 * [ARCTOS-FULL-2026-08-31 / WP2 · S01-15] Warum diese Datei neu geschrieben
 * wurde
 * ---------------------------------------------------------------------------
 * Die vorherige Fassung hatte drei blinde Flecken — und zwar genau in den drei
 * Objektklassen, in denen Stream S01 Cross-Tenant-Zugriff praktisch
 * nachgewiesen hat:
 *
 *   1. Jede Tabelle OHNE `org_id` galt pauschal als `platform_ignored`
 *      ("Platform-wide table, RLS not required"). Damit waren die 18
 *      Kindtabellen aus S01-03 (approval_decision, bowtie_path,
 *      wb_anonymous_mailbox, role_permission, …) und die Auth-Kerntabellen
 *      aus S01-04 (user, session, account, verification_token) per Definition
 *      "ok" — obwohl sie mandantenbezogene Daten halten und keinerlei RLS
 *      trugen.
 *   2. Views und Materialized Views wurden nie betrachtet (`pg_tables`
 *      liefert nur `relkind='r'`), also blieb S01-08 unsichtbar.
 *   3. Policy-AUSDRÜCKE wurden nie gelesen, nur `pg_policies.cmd`. Eine
 *      Policy `USING (true)`, `USING (org_id IS NULL OR …)` oder mit
 *      `app.bypass_rls` zählte als vollwertige Abdeckung — S01-02 und S01-07
 *      blieben unsichtbar.
 *
 * Das Werkzeug, das die Admin-UI und der Systemtest als Nachweis der
 * Mandantentrennung verwenden, meldete also "ok" für genau die Objekte, an
 * denen die Trennung nachweislich nicht hielt. Diese Fassung schliesst alle
 * drei Lücken:
 *
 *   * Tabellen ohne `org_id` werden gegen ihre Fremdschlüssel geprüft. Zeigt
 *     ein FK (direkt oder über eine Zwischentabelle) auf eine org-skalierte
 *     Tabelle, ist die Tabelle `tenant_child` und braucht RLS — mit einer
 *     Policy, die den Elternbezug herstellt.
 *   * Views bekommen `security_invoker`, Materialized Views ihr Leserecht
 *     geprüft.
 *   * Policy-Ausdrücke werden auf verbotene Muster geprüft: `app.bypass_rls`,
 *     `USING (true)`, `org_id IS NULL` in einem schreibenden Kommando, und
 *     `current_setting('app.current_org_id')` ohne NULLIF-Guard.
 *
 * Die Rückgabe ist bewusst maschinenlesbar: `scripts/audit-rls-coverage.mjs
 * --check` und `packages/db/tests/rls/tenant-isolation-systemtest.test.ts`
 * verwenden dieselbe Quelle.
 */

import { sql } from "drizzle-orm";
import { db } from "./index";

export type RlsScope =
  | "tenant" // hat org_id
  | "tenant_child" // keine org_id, aber FK auf eine org-skalierte Tabelle
  | "auth" // Auth-Kerntabellen (user/session/account/verification_token)
  | "platform" // wirklich global
  | "view"
  | "matview";

export type RlsStatus =
  | "ok"
  | "missing_rls"
  | "missing_force"
  | "missing_policies"
  | "weak_policy"
  | "view_not_invoker"
  | "matview_readable"
  | "platform_ignored";

export interface RlsTableStatus {
  tableName: string;
  scope: RlsScope;
  rlsEnabled: boolean;
  rlsForced: boolean;
  policies: string[];
  coveredCommands: string[];
  /** Concrete policy-expression defects, empty when none */
  policyDefects: string[];
  status: RlsStatus;
  note?: string;
}

export interface RlsAuditReport {
  generatedAt: string;
  counts: {
    totalObjects: number;
    /** Tables carrying an org_id/organization_id column */
    orgIdTables: number;
    /**
     * Every object that must enforce tenant isolation: org_id tables, child
     * tables, auth core tables, views and materialized views. `tenantsOk ===
     * tenantTables` is therefore exactly "no gaps".
     */
    tenantTables: number;
    tenantChildTables: number;
    authTables: number;
    platformTables: number;
    views: number;
    matviews: number;
    ok: number;
    gaps: number;
    // Kept for the existing consumers (admin/rls-audit route + dashboard
    // page, both outside WP2's file ownership). "tenant" now means every
    // object that needs isolation — tenant tables, child tables, auth core,
    // views and matviews — not only tables carrying an org_id column.
    totalTables: number;
    tenantsOk: number;
    tenantsMissingRls: number;
    tenantsMissingForce: number;
    tenantsMissingPolicies: number;
  };
  /** Every object whose status is not "ok"/"platform_ignored". */
  gaps: RlsTableStatus[];
  tables: RlsTableStatus[];
}

/**
 * Tenant-scoped tables that are allowed to carry no RLS.
 *
 * [WP2 · S01-06] Diese Menge ist LEER und soll es bleiben.
 *
 * Sie enthielt `access_log`, `audit_log` und `audit_anchor` — die drei
 * Tabellen, auf denen `0379_logtables_rls_exception.sql` RLS abgeschaltet und
 * alle Policies gelöscht hatte. Migration `0396_rls_log_tables.sql` hebt diese
 * Ausnahme auf: die Tabellen tragen jetzt RLS+FORCE mit getrennten Policies
 * (permissives INSERT für die org-losen Login-/Trigger-Schreibvorgänge,
 * org-skaliertes SELECT/UPDATE/DELETE). Die Begründung der Ausnahme — Lesen
 * über die Org-Hierarchie — ist durch `app_current_org_scope()` sauber gelöst
 * statt durch das Abschalten der Isolation (S01-26).
 *
 * Wer hier je wieder einen Eintrag hinzufügt, hebt die Mandantentrennung für
 * die genannte Tabelle auf. Das ist eine Entscheidung mit Begründungspflicht,
 * kein Konfigurationsdetail —
 * `tests/rls/tenant-isolation-systemtest.test.ts` schlägt fehl, solange die
 * Menge nicht leer ist.
 */
export const TENANT_TABLE_RLS_EXCEPTIONS = new Set<string>([]);

/** Auth core tables — tenant-relevant, but scoped via membership, not org_id. */
const AUTH_CORE_TABLES = new Set([
  "user",
  "session",
  "account",
  "verification_token",
]);

/** Internal bookkeeping, never tenant data. */
const INFRA_TABLES = new Set(["_arctos_migrations"]);

interface RawRow extends Record<string, unknown> {
  table_name: string;
}

function rows<T>(res: unknown): T[] {
  return Array.isArray(res) ? (res as T[]) : [];
}

export async function runRlsAudit(): Promise<RlsAuditReport> {
  // ── 1. Relations: tables, views, matviews ────────────────────────────────
  const relations = await db.execute<{ table_name: string; relkind: string }>(sql`
    SELECT c.relname AS table_name, c.relkind::text AS relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
     ORDER BY c.relname
  `);

  // ── 2. org_id columns ────────────────────────────────────────────────────
  const orgScoped = await db.execute<RawRow>(sql`
    SELECT table_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name IN ('org_id', 'organization_id')
  `);
  const tenantSet = new Set(rows<RawRow>(orgScoped).map((r) => r.table_name));

  // ── 3. Foreign keys, to classify org-less tables as tenant children ──────
  const fks = await db.execute<{ child: string; parent: string }>(sql`
    SELECT src.relname AS child, tgt.relname AS parent
      FROM pg_constraint con
      JOIN pg_class src ON src.oid = con.conrelid
      JOIN pg_class tgt ON tgt.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = src.relnamespace
     WHERE con.contype = 'f' AND n.nspname = 'public'
  `);
  const parentsOf = new Map<string, string[]>();
  for (const f of rows<{ child: string; parent: string }>(fks)) {
    if (f.child === f.parent) continue; // self-reference proves nothing
    parentsOf.set(f.child, [...(parentsOf.get(f.child) ?? []), f.parent]);
  }

  /** Does `table` reach an org-scoped table via FKs (max 4 hops)? */
  function reachesTenantParent(table: string): boolean {
    const seen = new Set<string>([table]);
    let frontier = parentsOf.get(table) ?? [];
    for (let depth = 0; depth < 4 && frontier.length; depth++) {
      const next: string[] = [];
      for (const p of frontier) {
        if (tenantSet.has(p)) return true;
        if (seen.has(p)) continue;
        seen.add(p);
        next.push(...(parentsOf.get(p) ?? []));
      }
      frontier = next;
    }
    return false;
  }

  // ── 4. RLS state ─────────────────────────────────────────────────────────
  const rlsState = await db.execute<{
    table_name: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
    reloptions: string | null;
    readable_by_app: boolean;
  }>(sql`
    SELECT c.relname AS table_name,
           c.relrowsecurity,
           c.relforcerowsecurity,
           array_to_string(c.reloptions, ',') AS reloptions,
           COALESCE(
             has_table_privilege('grc_app', c.oid, 'SELECT'),
             false
           ) AS readable_by_app
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
  `);
  const rlsMap = new Map<
    string,
    {
      enabled: boolean;
      forced: boolean;
      reloptions: string;
      readableByApp: boolean;
    }
  >();
  for (const r of rows<{
    table_name: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
    reloptions: string | null;
    readable_by_app: boolean;
  }>(rlsState)) {
    rlsMap.set(r.table_name, {
      enabled: r.relrowsecurity,
      forced: r.relforcerowsecurity,
      reloptions: r.reloptions ?? "",
      readableByApp: r.readable_by_app,
    });
  }

  // ── 5. Policies INCLUDING their expressions (S01-15, blind spot 3) ───────
  const policyRows = await db.execute<{
    tablename: string;
    policyname: string;
    cmd: string;
    permissive: string;
    qual: string | null;
    with_check: string | null;
  }>(sql`
    SELECT tablename, policyname, cmd, permissive, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
  `);
  const policiesByTable = new Map<
    string,
    {
      names: string[];
      cmds: Set<string>;
      defects: string[];
    }
  >();
  for (const p of rows<{
    tablename: string;
    policyname: string;
    cmd: string;
    permissive: string;
    qual: string | null;
    with_check: string | null;
  }>(policyRows)) {
    const slot = policiesByTable.get(p.tablename) ?? {
      names: [],
      cmds: new Set<string>(),
      defects: [],
    };
    slot.names.push(p.policyname);
    const cmd = p.cmd.toUpperCase();
    slot.cmds.add(cmd);

    const expr = `${p.qual ?? ""} ${p.with_check ?? ""}`;
    const writeCmd = cmd === "ALL" || cmd === "INSERT" || cmd === "UPDATE";

    if (expr.includes("app.bypass_rls")) {
      slot.defects.push(`${p.policyname}: app.bypass_rls escape hatch (S01-02)`);
    }
    if (
      (p.qual ?? "").trim() === "true" ||
      (p.with_check ?? "").trim() === "true"
    ) {
      // A permissive INSERT policy with WITH CHECK (true) is deliberate on the
      // log tables (org-less writes at login) — everything else is a hole.
      if (cmd !== "INSERT") {
        slot.defects.push(`${p.policyname}: USING/CHECK (true) on ${cmd}`);
      }
    }
    if (writeCmd && expr.includes("org_id IS NULL")) {
      slot.defects.push(
        `${p.policyname}: org_id IS NULL writable on ${cmd} (S01-07)`,
      );
    }
    if (
      expr.includes("current_setting('app.current_org_id'") &&
      !expr.includes("NULLIF(current_setting('app.current_org_id'")
    ) {
      slot.defects.push(
        `${p.policyname}: current_org_id cast without NULLIF guard (S01-18)`,
      );
    }
    if (expr.includes("(org_id)::text = current_setting")) {
      slot.defects.push(`${p.policyname}: text comparison instead of uuid (S01-25)`);
    }
    policiesByTable.set(p.tablename, slot);
  }

  // ── 6. Classify ──────────────────────────────────────────────────────────
  const statuses: RlsTableStatus[] = rows<{
    table_name: string;
    relkind: string;
  }>(relations).map((t) => {
    const name = t.table_name;
    const rls = rlsMap.get(name) ?? {
      enabled: false,
      forced: false,
      reloptions: "",
      readableByApp: false,
    };
    const pol = policiesByTable.get(name) ?? {
      names: [],
      cmds: new Set<string>(),
      defects: [],
    };
    const base = {
      tableName: name,
      rlsEnabled: rls.enabled,
      rlsForced: rls.forced,
      policies: pol.names,
      coveredCommands: Array.from(pol.cmds),
      policyDefects: pol.defects,
    };

    // ---- Views (S01-15 blind spot 2) --------------------------------------
    if (t.relkind === "v") {
      const invoker = rls.reloptions.includes("security_invoker=true");
      return {
        ...base,
        scope: "view" as const,
        status: invoker ? ("ok" as const) : ("view_not_invoker" as const),
        note: invoker
          ? undefined
          : "View without security_invoker — evaluated with the OWNER's rights, bypassing RLS on its base tables (S01-08)",
      };
    }
    if (t.relkind === "m") {
      return {
        ...base,
        scope: "matview" as const,
        status: rls.readableByApp
          ? ("matview_readable" as const)
          : ("ok" as const),
        note: rls.readableByApp
          ? "Materialized view readable by grc_app — MVs carry no RLS, their content is materialized across tenants (S01-08)"
          : "Materialized view — SELECT revoked from grc_app",
      };
    }

    if (INFRA_TABLES.has(name)) {
      return {
        ...base,
        scope: "platform" as const,
        status: "platform_ignored" as const,
        note: "Migration ledger",
      };
    }

    // ---- Scope --------------------------------------------------------------
    const isTenant = tenantSet.has(name);
    const isAuth = AUTH_CORE_TABLES.has(name);
    const isChild = !isTenant && !isAuth && reachesTenantParent(name);
    const scope: RlsScope = isTenant
      ? "tenant"
      : isAuth
        ? "auth"
        : isChild
          ? "tenant_child"
          : "platform";

    if (scope === "platform") {
      return {
        ...base,
        scope,
        status: "platform_ignored" as const,
        note: "No org_id, no FK path to an org-scoped table — genuinely global",
      };
    }

    if (TENANT_TABLE_RLS_EXCEPTIONS.has(name)) {
      return {
        ...base,
        scope,
        status: "weak_policy" as const,
        note: "Listed in TENANT_TABLE_RLS_EXCEPTIONS — tenant isolation is OFF for this table (S01-06)",
      };
    }

    if (!rls.enabled) {
      return {
        ...base,
        scope,
        status: "missing_rls" as const,
        note:
          scope === "tenant_child"
            ? "Tenant CHILD table (FK to an org-scoped parent) without RLS — isolation depends on hand-written parent lookups in every route (S01-03)"
            : "Tenant table without ENABLE ROW LEVEL SECURITY",
      };
    }

    // Deny-all is a valid, deliberate state for the unused Auth.js token
    // tables (0392): RLS on, zero policies, SELECT revoked.
    if (pol.names.length === 0) {
      const denyAll = isAuth && !rls.readableByApp;
      return {
        ...base,
        scope,
        status: denyAll ? ("ok" as const) : ("missing_policies" as const),
        note: denyAll
          ? "Deny-all: RLS enabled, no policies, no grant to grc_app"
          : "RLS enabled but no policy at all — deny-all for the runtime role, which breaks the feature (S01-19)",
      };
    }

    const requiredCmds = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    const missing = pol.cmds.has("ALL")
      ? []
      : requiredCmds.filter((c) => !pol.cmds.has(c));
    if (missing.length > 0) {
      return {
        ...base,
        scope,
        status: "missing_policies" as const,
        note: `No policy for: ${missing.join(", ")}`,
      };
    }

    if (pol.defects.length > 0) {
      return {
        ...base,
        scope,
        status: "weak_policy" as const,
        note: pol.defects.join("; "),
      };
    }

    if (!rls.forced) {
      return {
        ...base,
        scope,
        status: "missing_force" as const,
        note: "RLS enabled but not FORCED — the table owner bypasses its own policies (S01-20)",
      };
    }

    return { ...base, scope, status: "ok" as const };
  });

  const gaps = statuses.filter(
    (s) => s.status !== "ok" && s.status !== "platform_ignored",
  );
  const count = (s: RlsScope) => statuses.filter((x) => x.scope === s).length;
  const isolationRelevant = statuses.filter(
    (s) => s.scope !== "platform" || s.status !== "platform_ignored",
  );
  const withStatus = (s: RlsStatus) =>
    isolationRelevant.filter((x) => x.status === s).length;

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      totalObjects: statuses.length,
      orgIdTables: count("tenant"),
      tenantTables: isolationRelevant.length,
      tenantChildTables: count("tenant_child"),
      authTables: count("auth"),
      platformTables: count("platform"),
      views: count("view"),
      matviews: count("matview"),
      ok: statuses.filter((s) => s.status === "ok").length,
      gaps: gaps.length,
      totalTables: statuses.length,
      tenantsOk: withStatus("ok"),
      tenantsMissingRls: withStatus("missing_rls"),
      tenantsMissingForce: withStatus("missing_force"),
      tenantsMissingPolicies:
        withStatus("missing_policies") +
        withStatus("weak_policy") +
        withStatus("view_not_invoker") +
        withStatus("matview_readable"),
    },
    gaps,
    tables: statuses,
  };
}
