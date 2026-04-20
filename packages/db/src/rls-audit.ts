/**
 * RLS Coverage Audit (ADR-001 enforcement check)
 *
 * ADR-001 requires every tenant-scoped table to enforce multi-entity
 * isolation via PostgreSQL RLS. "Tenant-scoped" means: the table has a
 * column named `org_id` (or `organization_id`). Platform-wide tables
 * (`module_definition`, `catalog`, `catalog_entry`, `framework_mapping`,
 * etc.) are intentionally global and do not need RLS.
 *
 * This module queries pg_catalog to answer three questions per table:
 *
 *   1. Is RLS ENABLED (pg_class.relrowsecurity = true)?
 *   2. Is RLS FORCED for table owners too (relforcerowsecurity = true)?
 *      — without this, the DB super user bypasses RLS even with
 *        FORCE ROW LEVEL SECURITY set on write operations that use
 *        the owner role. For us, `grc` is the owner; API calls go
 *        through `grc_app` which does NOT bypass.
 *   3. Does the table have at least one policy for each of
 *      SELECT / INSERT / UPDATE / DELETE?
 *
 * The return shape is designed to feed directly into a report:
 * the caller sees exactly which tables are OK and which are gaps.
 */

import { sql } from "drizzle-orm";
import { db } from "./index";

export interface RlsTableStatus {
  tableName: string;
  /** "platform" if no org_id column, "tenant" otherwise */
  scope: "platform" | "tenant";
  rlsEnabled: boolean;
  rlsForced: boolean;
  /** Names of policies attached to the table */
  policies: string[];
  /** Commands that have at least one policy */
  coveredCommands: string[];
  /** Overall judgement */
  status:
    | "ok"
    | "missing_rls"
    | "missing_force"
    | "missing_policies"
    | "platform_ignored";
  /** Short explanation for the UI */
  note?: string;
}

export interface RlsAuditReport {
  generatedAt: string;
  counts: {
    totalTables: number;
    tenantTables: number;
    platformTables: number;
    tenantsOk: number;
    tenantsMissingRls: number;
    tenantsMissingForce: number;
    tenantsMissingPolicies: number;
  };
  tables: RlsTableStatus[];
}

/**
 * A whitelist of tenant-named tables that are ALLOWED to have no RLS.
 * Usually log tables that accumulate platform-wide and are queried via
 * app-level filters with audit context, never directly.
 */
const TENANT_TABLE_RLS_EXCEPTIONS = new Set<string>([
  // Append-only logs: filtered by org_id server-side, own integrity
  // guarantee via hash chain. Opening RLS on these would prevent
  // platform admins from running the integrity check.
  "audit_log",
  "access_log",
  "data_export_log",
  "notification",
  // Anchor table — accessed by worker and API, both server-scoped
  "audit_anchor",
]);

export async function runRlsAudit(): Promise<RlsAuditReport> {
  // 1. All user tables in public schema
  const tables = await db.execute<{ table_name: string }>(sql`
    SELECT tablename AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  // 2. Tables that have an org_id column
  const orgScoped = await db.execute<{ table_name: string }>(sql`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('org_id', 'organization_id')
  `);
  const tenantSet = new Set(
    (Array.isArray(orgScoped) ? orgScoped : []).map((r) => r.table_name),
  );

  // 3. RLS state per table
  const rlsState = await db.execute<{
    table_name: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(sql`
    SELECT c.relname AS table_name,
           c.relrowsecurity,
           c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `);
  const rlsMap = new Map<string, { enabled: boolean; forced: boolean }>();
  for (const r of Array.isArray(rlsState) ? rlsState : []) {
    rlsMap.set(r.table_name, {
      enabled: r.relrowsecurity,
      forced: r.relforcerowsecurity,
    });
  }

  // 4. Policies per table
  const policyRows = await db.execute<{
    tablename: string;
    policyname: string;
    cmd: string;
  }>(sql`
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
  `);
  const policiesByTable = new Map<
    string,
    { names: string[]; cmds: Set<string> }
  >();
  for (const p of Array.isArray(policyRows) ? policyRows : []) {
    const slot = policiesByTable.get(p.tablename) ?? {
      names: [],
      cmds: new Set<string>(),
    };
    slot.names.push(p.policyname);
    slot.cmds.add(p.cmd.toUpperCase());
    policiesByTable.set(p.tablename, slot);
  }

  const tableRows = Array.isArray(tables) ? tables : [];
  const statuses: RlsTableStatus[] = tableRows.map((t) => {
    const isTenant = tenantSet.has(t.table_name);
    const rls = rlsMap.get(t.table_name) ?? { enabled: false, forced: false };
    const pol = policiesByTable.get(t.table_name) ?? {
      names: [],
      cmds: new Set<string>(),
    };
    const covered = Array.from(pol.cmds);

    if (!isTenant) {
      return {
        tableName: t.table_name,
        scope: "platform",
        rlsEnabled: rls.enabled,
        rlsForced: rls.forced,
        policies: pol.names,
        coveredCommands: covered,
        status: "platform_ignored",
        note: "Platform-wide table, RLS not required",
      };
    }

    if (TENANT_TABLE_RLS_EXCEPTIONS.has(t.table_name)) {
      return {
        tableName: t.table_name,
        scope: "tenant",
        rlsEnabled: rls.enabled,
        rlsForced: rls.forced,
        policies: pol.names,
        coveredCommands: covered,
        status: "ok",
        note: "Exception: log/append-only, filtered server-side",
      };
    }

    if (!rls.enabled) {
      return {
        tableName: t.table_name,
        scope: "tenant",
        rlsEnabled: false,
        rlsForced: false,
        policies: pol.names,
        coveredCommands: covered,
        status: "missing_rls",
        note: "Tenant table without ENABLE ROW LEVEL SECURITY",
      };
    }

    const requiredCmds = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    const hasAllCmd = pol.cmds.has("ALL");
    const missing = hasAllCmd
      ? []
      : requiredCmds.filter((c) => !pol.cmds.has(c));

    if (missing.length > 0) {
      return {
        tableName: t.table_name,
        scope: "tenant",
        rlsEnabled: rls.enabled,
        rlsForced: rls.forced,
        policies: pol.names,
        coveredCommands: covered,
        status: "missing_policies",
        note: `No policy for: ${missing.join(", ")}`,
      };
    }

    if (!rls.forced) {
      return {
        tableName: t.table_name,
        scope: "tenant",
        rlsEnabled: true,
        rlsForced: false,
        policies: pol.names,
        coveredCommands: covered,
        status: "missing_force",
        note: "RLS enabled but not FORCED — owner role bypasses",
      };
    }

    return {
      tableName: t.table_name,
      scope: "tenant",
      rlsEnabled: true,
      rlsForced: true,
      policies: pol.names,
      coveredCommands: covered,
      status: "ok",
    };
  });

  const tenantStatuses = statuses.filter((s) => s.scope === "tenant");

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      totalTables: statuses.length,
      tenantTables: tenantStatuses.length,
      platformTables: statuses.length - tenantStatuses.length,
      tenantsOk: tenantStatuses.filter((s) => s.status === "ok").length,
      tenantsMissingRls: tenantStatuses.filter(
        (s) => s.status === "missing_rls",
      ).length,
      tenantsMissingForce: tenantStatuses.filter(
        (s) => s.status === "missing_force",
      ).length,
      tenantsMissingPolicies: tenantStatuses.filter(
        (s) => s.status === "missing_policies",
      ).length,
    },
    tables: statuses,
  };
}
