/**
 * schema-drift.ts — deep comparison of the Drizzle schema against a live
 * database.
 *
 * [ARCTOS-FULL-2026-08-31 / WP1 · S09-09]
 * The previous drift check (`/api/v1/health/schema-drift`) compared table
 * NAMES and nothing else. Columns, types, nullability, primary keys, foreign
 * keys and RLS stayed out of scope — so the endpoint reported `healthy: true`
 * for a database in which 23 declared columns were missing, and ADR-014's
 * deploy gate was built on that value. Worse, the value only turned green
 * *because* `create-missing-tables.ts` had created empty shells: the gate
 * rewarded the workaround it was meant to catch.
 *
 * This module is the single implementation of the comparison. It is used by
 *   * `tests/schema-drift-report.ts`      — CLI, used by the CI rehearsal job
 *   * `tests/unit/schema-drift.test.ts`   — regression test
 *   * `apps/web/.../health/schema-drift`  — the runtime endpoint
 */
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export interface ColumnDrift {
  table: string;
  column: string;
  // [ARCTOS-FULL-2026-08-31 / Restdefekte · O-6] `extra-in-db` is the second
  // direction. Until it existed the check only asked "does the database have
  // everything the code declares?" and never "does the code know everything
  // the database has?" — so `control.source_library_ref` stayed invisible
  // while the report said `column drift: 0`, and 203 further columns did the
  // same. An undeclared column is not cosmetic: `db.select()` silently omits
  // it, `$inferSelect` denies it exists, and every read of it has to leave the
  // ORM for raw SQL.
  kind:
    "missing-in-db" | "extra-in-db" | "type-mismatch" | "nullability-mismatch";
  expected?: string;
  actual?: string;
}

export interface TableDrift {
  table: string;
  kind: "missing-in-db" | "rls-missing" | "rls-without-policy";
}

export interface DriftReport {
  healthy: boolean;
  expectedTableCount: number;
  dbTableCount: number;
  missingInDb: string[];
  extraInDb: string[];
  columnDrift: ColumnDrift[];
  rlsDrift: TableDrift[];
  generatedAt: string;
}

/** One row of `information_schema.columns` reduced to what we compare. */
export interface DbColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
}

export interface DbTableFlags {
  table_name: string;
  relrowsecurity: boolean;
  policy_count: number;
  has_org_id: boolean;
}

/**
 * Map a Drizzle column to the `udt_name` PostgreSQL reports for it. Drizzle's
 * `getSQLType()` produces the DDL spelling (`varchar(500)`, `timestamp with
 * time zone`, `jsonb`, an enum's type name); `udt_name` is the internal name
 * (`varchar`, `timestamptz`, `jsonb`, the enum's type name). Normalising both
 * to the internal spelling keeps the comparison free of false positives from
 * length modifiers, which PostgreSQL reports separately anyway.
 */
export function normalizeType(sqlType: string): string {
  let t = sqlType.trim().toLowerCase();
  t = t.replace(/\s*\(.*?\)\s*$/, ""); // drop length/precision modifiers
  const arrayDepth = (t.match(/\[\]/g) ?? []).length;
  t = t.replace(/\[\]/g, "").trim();
  const map: Record<string, string> = {
    "timestamp with time zone": "timestamptz",
    "timestamp without time zone": "timestamp",
    "time with time zone": "timetz",
    "time without time zone": "time",
    "character varying": "varchar",
    character: "bpchar",
    char: "bpchar",
    "double precision": "float8",
    "double-precision": "float8",
    boolean: "bool",
    integer: "int4",
    int: "int4",
    smallint: "int2",
    bigint: "int8",
    serial: "int4",
    bigserial: "int8",
    real: "float4",
    decimal: "numeric",
  };
  t = map[t] ?? t;
  return arrayDepth > 0 ? "_".repeat(arrayDepth) + t : t;
}

/** Same normalisation from the database side. */
export function normalizeDbType(dataType: string, udtName: string): string {
  if (dataType.toLowerCase() === "array") {
    // udt_name of an array column is already `_int4`, `_text`, …
    return udtName.toLowerCase();
  }
  return normalizeType(udtName || dataType);
}

/** Every `pgTable` exported by `@grc/db`, de-duplicated by SQL table name. */
export function expectedTables(
  schemaExports: Record<string, unknown>,
): Map<string, Table> {
  const out = new Map<string, Table>();
  for (const value of Object.values(schemaExports)) {
    if (value && is(value as never, Table)) {
      const t = value as unknown as Table;
      const name = getTableName(t);
      // S09-08: two `pgTable` definitions can claim the same SQL table. The
      // first wins here; `duplicateTableDefinitions` reports the conflict.
      if (!out.has(name)) out.set(name, t);
    }
  }
  return out;
}

/**
 * S09-08: report SQL table names that more than one `pgTable` export claims.
 * Two definitions with disjoint column sets mean one of them is guaranteed to
 * produce `column … does not exist` at runtime.
 */
export function duplicateTableDefinitions(
  schemaExports: Record<string, unknown>,
): { table: string; exports: string[] }[] {
  const byName = new Map<string, string[]>();
  for (const [exportName, value] of Object.entries(schemaExports)) {
    if (value && is(value as never, Table)) {
      const name = getTableName(value as unknown as Table);
      byName.set(name, [...(byName.get(name) ?? []), exportName]);
    }
  }
  return [...byName.entries()]
    .filter(([, exports]) => exports.length > 1)
    .map(([table, exports]) => ({ table, exports: exports.sort() }))
    .sort((a, b) => (a.table < b.table ? -1 : 1));
}

/**
 * Deliberately accepted type differences: cases in which the DATABASE is
 * stricter than the TypeScript declaration. Aligning the database to the code
 * would remove a real constraint, so the code side is the one that has to
 * catch up — which belongs to the work package that owns the module. Every
 * entry names that owner. The list is short and explicit on purpose: it is
 * not a baseline that silently absorbs new drift, because the comparison
 * still fails on anything not listed here.
 */
export const ACCEPTED_TYPE_DRIFT: Record<string, string> = {
  // [ARCTOS-FULL-2026-08-31 · OP-137] Die fuenf Eintraege, die hier standen,
  // sind erledigt: `*_sign_off.ip_address` ist im Schema jetzt `inet`, und
  // `catalog_entry_mapping.relationship`/`.mapping_source` benutzen die
  // pgEnum-Deklarationen aus `schema/phase3-extras.ts`. Damit ist diese Liste
  // leer — und das ist der Zustand, den sie anstreben soll: eine akzeptierte
  // Abweichung ist eine unbeantwortete Frage, keine Antwort.
  //
  // Eine neue Zeile hier braucht denselben Nachweis wie damals: WARUM die
  // Datenbank strenger sein DARF als der Code, und wer die Code-Seite
  // nachzieht. „Faellt schon nicht auf" ist keine Begruendung — der Grund,
  // aus dem diese fuenf ueberhaupt entstanden sind, war genau der.
};

export function compareSchema(
  schemaExports: Record<string, unknown>,
  dbTables: string[],
  dbColumns: DbColumn[],
  dbFlags: DbTableFlags[],
): DriftReport {
  const expected = expectedTables(schemaExports);
  const dbTableSet = new Set(dbTables);

  const missingInDb = [...expected.keys()]
    .filter((t) => !dbTableSet.has(t))
    .sort();
  const extraInDb = dbTables.filter((t) => !expected.has(t)).sort();

  const colsByTable = new Map<string, Map<string, DbColumn>>();
  for (const c of dbColumns) {
    let m = colsByTable.get(c.table_name);
    if (!m) colsByTable.set(c.table_name, (m = new Map()));
    m.set(c.column_name, c);
  }

  const columnDrift: ColumnDrift[] = [];
  for (const [tableName, table] of expected) {
    const actual = colsByTable.get(tableName);
    if (!actual) continue; // whole table missing — already reported
    const declaredNames = new Set<string>();
    for (const col of Object.values(
      getTableColumns(table) as Record<string, PgColumn>,
    )) {
      declaredNames.add(col.name);
      const found = actual.get(col.name);
      if (!found) {
        columnDrift.push({
          table: tableName,
          column: col.name,
          kind: "missing-in-db",
          expected: normalizeType(col.getSQLType()),
        });
        continue;
      }
      const want = normalizeType(col.getSQLType());
      const have = normalizeDbType(found.data_type, found.udt_name);
      if (want !== have && !ACCEPTED_TYPE_DRIFT[`${tableName}.${col.name}`]) {
        columnDrift.push({
          table: tableName,
          column: col.name,
          kind: "type-mismatch",
          expected: want,
          actual: have,
        });
      }
      const dbNullable = found.is_nullable === "YES";
      // Only flag the dangerous direction: the code promises NOT NULL but the
      // database allows NULL, so a read can hand `null` to a non-nullable type.
      if (col.notNull && dbNullable) {
        columnDrift.push({
          table: tableName,
          column: col.name,
          kind: "nullability-mismatch",
          expected: "NOT NULL",
          actual: "NULL",
        });
      }
    }

    // O-6 — the other direction: columns the database has and the Drizzle
    // declaration does not. Only for tables the code claims: a table that is
    // entirely unknown to the schema is `extraInDb` and stays informational
    // (a number of tables predate the TypeScript schema and are managed by
    // SQL alone). There is deliberately NO exception list here — the five
    // GENERATED columns are declared with `.generatedAlwaysAs(...)`, which
    // keeps them out of the insert/update types, so "the ORM must not write
    // it" is expressed in the schema instead of in a waiver.
    for (const [columnName, dbCol] of actual) {
      if (declaredNames.has(columnName)) continue;
      columnDrift.push({
        table: tableName,
        column: columnName,
        kind: "extra-in-db",
        actual: normalizeDbType(dbCol.data_type, dbCol.udt_name),
      });
    }
  }

  // RLS: every table the code knows and that carries an org_id must have row
  // level security enabled AND at least one policy. RLS without a policy is a
  // deny-all table, which is a defect of its own (S01-19).
  const rlsDrift: TableDrift[] = [];
  for (const f of dbFlags) {
    if (!expected.has(f.table_name)) continue;
    if (!f.has_org_id) continue;
    if (!f.relrowsecurity) {
      rlsDrift.push({ table: f.table_name, kind: "rls-missing" });
    } else if (f.policy_count === 0) {
      rlsDrift.push({ table: f.table_name, kind: "rls-without-policy" });
    }
  }
  rlsDrift.sort((a, b) => (a.table < b.table ? -1 : 1));

  return {
    healthy:
      missingInDb.length === 0 &&
      columnDrift.length === 0 &&
      rlsDrift.length === 0,
    expectedTableCount: expected.size,
    dbTableCount: dbTableSet.size,
    missingInDb,
    extraInDb,
    columnDrift,
    rlsDrift,
    generatedAt: new Date().toISOString(),
  };
}

/** The three queries the comparison needs, as plain SQL text. */
export const DRIFT_QUERIES = {
  tables: `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema = 'public'`,
  columns: `
    SELECT table_name, column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'`,
  flags: `
    SELECT c.relname AS table_name,
           c.relrowsecurity,
           (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count,
           EXISTS (
             SELECT 1 FROM information_schema.columns col
             WHERE col.table_schema = 'public'
               AND col.table_name = c.relname
               AND col.column_name = 'org_id'
           ) AS has_org_id
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind = 'r'`,
} as const;
