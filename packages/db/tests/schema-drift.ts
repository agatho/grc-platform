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

// [ARCTOS-FULL-2026-08-31 · OP-155]
// Der Drift-Bericht verglich Tabellen, Spalten, Typen, Nullability und RLS —
// aber nicht den ENABLE-Zustand der Trigger. Warum ausgerechnet der zählt:
// Welle 1b hat gemessen, dass `ALTER TABLE … ENABLE TRIGGER ALL` nur EINEN
// Zielzustand kennt, `'O'` (origin). Ein Trigger, der vorher `ENABLE ALWAYS`
// (`'A'`) war, kommt als origin-only zurück und feuert danach unter
// `session_replication_role = 'replica'` NICHT mehr:
//
//   CREATE TRIGGER _probe …; ALTER TABLE _probe ENABLE ALWAYS TRIGGER _probe;
//   -- tgenabled = 'A'
//   ALTER TABLE _probe DISABLE TRIGGER ALL;
//   ALTER TABLE _probe ENABLE  TRIGGER ALL;   -- tgenabled = 'O'
//
// Genau so sind die 17 Wächter des Audit-Trails gebaut. Nach einer solchen
// Rückstufung steht der Trigger unverändert in `pg_trigger`, mit unveränderter
// Definition — und ist wirkungslos, sobald jemand als Replikationsrolle
// schreibt (Seed, Datenmigration, Cleanup-Skript). Ein Bericht, der den
// ENABLE-Zustand nicht liest, meldet für eine so entschärfte Datenbank
// `healthy: true`: „Guard vorhanden" ist eben nicht „Guard wirkt".
//
// Die vier Befundklassen:
//   `guard-missing`       — registrierter Wächter fehlt in der Datenbank ganz;
//   `guard-not-always`    — er steht nicht mehr auf ENABLE ALWAYS (der Fall
//                           aus Welle 1b);
//   `trigger-disabled`    — irgendein Trigger steht auf `'D'`; ein
//                           abgeschalteter Trigger ist ein entfernter Trigger,
//                           der aussieht, als wäre er da;
//   `unregistered-always` — ENABLE ALWAYS in der Datenbank, aber nicht im
//                           Register (siehe ALWAYS_ENABLED_GUARDS).
export type TriggerDriftKind =
  | "guard-missing"
  | "guard-not-always"
  | "trigger-disabled"
  | "unregistered-always";

export interface TriggerDrift {
  table: string;
  trigger: string;
  kind: TriggerDriftKind;
  expected?: string;
  actual?: string;
}

export interface DriftReport {
  healthy: boolean;
  expectedTableCount: number;
  dbTableCount: number;
  missingInDb: string[];
  extraInDb: string[];
  columnDrift: ColumnDrift[];
  rlsDrift: TableDrift[];
  triggerDrift: TriggerDrift[];
  generatedAt: string;
}

/** One row of the trigger catalog query, reduced to what we compare. */
export interface DbTrigger {
  table_name: string;
  trigger_name: string;
  /** `pg_trigger.tgenabled`: 'O' origin, 'A' always, 'R' replica, 'D' disabled. */
  tgenabled: string;
}

/**
 * Die Wächter, die `ENABLE ALWAYS` sein MÜSSEN.
 *
 * Warum ein Register im Code und keine Ableitung aus den Migrationen: sechs der
 * siebzehn werden gar nicht als Literal gesetzt, sondern in einer Schleife —
 * `0401_audit_chain_assign_and_guards.sql:458` schreibt
 * `EXECUTE format('ALTER TABLE public.%I ENABLE ALWAYS TRIGGER %I', t, t ||
 * '_no_truncate')`. Ein Textscan über `drizzle/*.sql` findet deshalb nur 11 von
 * 17 (gemessen 2026-09-03), und eine Ableitung, die ein Drittel der Wächter
 * übersieht, ist als Soll-Zustand schlechter als gar keine.
 *
 * Das Register bleibt trotzdem nicht sich selbst überlassen: `unregistered-
 * always` meldet jeden Trigger, der in der Datenbank auf `'A'` steht und hier
 * fehlt. Ein neuer Wächter macht den Vergleich also rot, bis er eingetragen
 * ist — die Liste kann nicht stillschweigend hinter dem Schema zurückbleiben.
 *
 * Gemessen am 2026-09-03 gegen eine von Null migrierte Datenbank
 * (426 Migrationen): genau diese 17, und keine weiteren.
 */
export const ALWAYS_ENABLED_GUARDS: readonly {
  readonly table: string;
  readonly trigger: string;
  readonly why: string;
}[] = [
  {
    table: "access_log",
    trigger: "access_log_no_truncate",
    why: "TRUNCATE auf einer Protokolltabelle ist eine Löschung ohne Spur.",
  },
  {
    table: "audit_anchor",
    trigger: "audit_anchor_append_only_trg",
    why: "Der externe Anker darf nach dem Setzen nicht mehr verändert werden.",
  },
  {
    table: "audit_anchor",
    trigger: "audit_anchor_no_truncate",
    why: "Wie oben, für den Weg über TRUNCATE.",
  },
  {
    table: "audit_anchor_seal",
    trigger: "audit_anchor_seal_immutable_trg",
    why: "Das Siegel des Ankers ist der Beweis; ein änderbarer Beweis ist keiner.",
  },
  {
    table: "audit_anchor_seal",
    trigger: "audit_anchor_seal_no_truncate",
    why: "Wie oben, für den Weg über TRUNCATE.",
  },
  {
    table: "audit_chain_verification",
    trigger: "audit_chain_verification_immutable_trg",
    why: "Das Prüfprotokoll der Hash-Kette darf nicht nachträglich geglättet werden.",
  },
  {
    table: "audit_log",
    trigger: "audit_log_chain_assign_trg",
    why: "Weist Geltungsbereich, previous_hash und entry_hash zu (0401). Feuert er nicht, entstehen Zeilen ausserhalb der Kette.",
  },
  {
    table: "audit_log",
    trigger: "audit_log_no_truncate",
    why: "TRUNCATE würde den gesamten Trail spurlos entfernen.",
  },
  {
    table: "audit_log",
    trigger: "audit_log_redaction_event_trg",
    why: "Jede Schwärzung ist selbst ein protokollpflichtiges Ereignis.",
  },
  {
    table: "audit_log",
    trigger: "audit_log_refuse_delete_trg",
    why: "Append-only. Ohne ihn ist der Audit-Trail löschbar.",
  },
  {
    table: "audit_log",
    trigger: "audit_log_tombstone_guard",
    why: "Grenzt die eine erlaubte Ausnahme (Tombstone) gegen freie Änderung ab.",
  },
  {
    table: "audit_log_write_attempt",
    trigger: "audit_log_write_attempt_no_truncate",
    why: "Die Tabelle hält die abgewiesenen Schreibversuche — gerade sie.",
  },
  {
    table: "data_export_log",
    trigger: "data_export_log_no_truncate",
    why: "Datenexporte sind DSGVO-relevant und müssen nachweisbar bleiben.",
  },
  {
    table: "document_signature",
    trigger: "document_signature_append_only_trg",
    why: "Eine getroffene Signaturentscheidung ist ein Kettenglied (0421).",
  },
  {
    table: "document_version",
    trigger: "document_version_file_immutable_trg",
    why: "Verhindert den Dateitausch hinter einer freigegebenen Version (0422).",
  },
  {
    table: "whistleblowing_audit_log",
    trigger: "wb_audit_log_append_only_trg",
    why: "HinSchG §8: das Hinweisgeberprotokoll ist unveränderlich.",
  },
  {
    table: "whistleblowing_audit_log",
    trigger: "whistleblowing_audit_log_no_truncate",
    why: "Wie oben, für den Weg über TRUNCATE.",
  },
];

/**
 * Vergleicht den ENABLE-Zustand der Trigger gegen das Register.
 *
 * Vier Befundklassen — siehe `TriggerDriftKind`.
 */
export function compareTriggers(dbTriggers: DbTrigger[]): TriggerDrift[] {
  const byKey = new Map<string, DbTrigger>();
  for (const t of dbTriggers) {
    byKey.set(`${t.table_name}.${t.trigger_name}`, t);
  }
  const registered = new Set(
    ALWAYS_ENABLED_GUARDS.map((g) => `${g.table}.${g.trigger}`),
  );

  const out: TriggerDrift[] = [];
  for (const guard of ALWAYS_ENABLED_GUARDS) {
    const key = `${guard.table}.${guard.trigger}`;
    const found = byKey.get(key);
    if (!found) {
      out.push({
        table: guard.table,
        trigger: guard.trigger,
        kind: "guard-missing",
        expected: "A",
      });
      continue;
    }
    if (found.tgenabled !== "A") {
      out.push({
        table: guard.table,
        trigger: guard.trigger,
        kind: "guard-not-always",
        expected: "A",
        actual: found.tgenabled,
      });
    }
  }

  for (const t of dbTriggers) {
    const key = `${t.table_name}.${t.trigger_name}`;
    if (t.tgenabled === "D") {
      out.push({
        table: t.table_name,
        trigger: t.trigger_name,
        kind: "trigger-disabled",
        expected: "O",
        actual: "D",
      });
      continue;
    }
    if (t.tgenabled === "A" && !registered.has(key)) {
      out.push({
        table: t.table_name,
        trigger: t.trigger_name,
        kind: "unregistered-always",
        actual: "A",
      });
    }
  }

  out.sort((a, b) =>
    `${a.table}.${a.trigger}` < `${b.table}.${b.trigger}` ? -1 : 1,
  );
  return out;
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
  // [ARCTOS-FULL-2026-08-31 · OP-155] Pflichtparameter, ohne Vorgabewert.
  // Ein optionales `dbTriggers = []` hätte für jeden Aufrufer, der ihn
  // vergisst, „17 Wächter fehlen" gemeldet — laut, aber am falschen Ort. Ein
  // optionales „dann eben nicht vergleichen" wäre die andere Richtung: still,
  // und genau der Zustand, den OP-155 beschreibt. Jeder Aufrufer entscheidet
  // deshalb ausdrücklich.
  dbTriggers: DbTrigger[],
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

  // [OP-155] Der ENABLE-Zustand ist Teil der Gesundheit, nicht Beiwerk: ein
  // zurückgestufter Wächter ist genau der Unterschied zwischen „Guard
  // vorhanden" und „Guard wirkt", und er ist von aussen nicht sichtbar.
  const triggerDrift = compareTriggers(dbTriggers);

  return {
    healthy:
      missingInDb.length === 0 &&
      columnDrift.length === 0 &&
      rlsDrift.length === 0 &&
      triggerDrift.length === 0,
    expectedTableCount: expected.size,
    dbTableCount: dbTableSet.size,
    missingInDb,
    extraInDb,
    columnDrift,
    rlsDrift,
    triggerDrift,
    generatedAt: new Date().toISOString(),
  };
}

/** The queries the comparison needs, as plain SQL text. */
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
  // [ARCTOS-FULL-2026-08-31 · OP-155] `NOT tgisinternal` schliesst die
  // RI-Constraint-Trigger aus, die PostgreSQL selbst anlegt (auf `document`
  // allein 36). Sie tragen denselben `tgenabled`-Zustand, gehören aber der
  // Fremdschlüsselmechanik und nicht dem Audit-Trail — sie hier zu melden
  // würde den Bericht mit hunderten Zeilen füllen und die 17 Wächter darin
  // begraben.
  triggers: `
    SELECT c.relname  AS table_name,
           t.tgname   AS trigger_name,
           t.tgenabled::text AS tgenabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE NOT t.tgisinternal`,
} as const;
