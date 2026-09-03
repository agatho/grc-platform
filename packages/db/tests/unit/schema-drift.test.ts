/**
 * Unit tests for the deep schema comparator.
 *
 * [ARCTOS-FULL-2026-08-31 / WP1 · S09-08, S09-09]
 * The old drift check compared table names only, so it reported `healthy` for
 * a database missing 23 declared columns. These tests pin the behaviour that
 * replaced it, and they assert the S09-08 defect (one SQL table claimed by two
 * `pgTable` exports) stays fixed.
 */
import { describe, expect, it } from "vitest";
import * as schemas from "../../src/index";
import {
  compareSchema,
  duplicateTableDefinitions,
  expectedTables,
  normalizeDbType,
  normalizeType,
  compareTriggers,
  ALWAYS_ENABLED_GUARDS,
  type DbColumn,
  type DbTableFlags,
  type DbTrigger,
} from "../schema-drift";

const exports_ = schemas as unknown as Record<string, unknown>;

// [ARCTOS-FULL-2026-08-31 · OP-155] `compareSchema` verlangt jetzt den
// Trigger-Zustand. Die Tests dieser Datei prüfen Spalten und RLS; sie reichen
// deshalb den Soll-Zustand durch — jeder Wächter vorhanden und auf `'A'` —,
// damit ihre Aussage unverändert bleibt und nicht heimlich Trigger-Drift
// mitmisst. Die Trigger-Prüfung selbst steht weiter unten.
function guardsInOrder(): DbTrigger[] {
  return ALWAYS_ENABLED_GUARDS.map((g) => ({
    table_name: g.table,
    trigger_name: g.trigger,
    tgenabled: "A",
  }));
}

describe("type normalisation", () => {
  it("maps DDL spellings onto the internal names PostgreSQL reports", () => {
    expect(normalizeType("varchar(500)")).toBe("varchar");
    expect(normalizeType("timestamp with time zone")).toBe("timestamptz");
    expect(normalizeType("char(3)")).toBe("bpchar");
    expect(normalizeType("integer")).toBe("int4");
    expect(normalizeType("numeric(20, 6)")).toBe("numeric");
    expect(normalizeType("text[]")).toBe("_text");
  });

  it("normalises the database side to the same vocabulary", () => {
    expect(normalizeDbType("character varying", "varchar")).toBe("varchar");
    expect(normalizeDbType("ARRAY", "_text")).toBe("_text");
    expect(normalizeDbType("USER-DEFINED", "user_role")).toBe("user_role");
  });
});

describe("duplicate pgTable definitions (S09-08)", () => {
  it("finds none in the current schema", () => {
    expect(duplicateTableDefinitions(exports_)).toEqual([]);
  });

  it("would report a table claimed twice", () => {
    // Reproduces the shape of the defect: `risk_appetite_threshold` was
    // declared by both board-kpi.ts and risk-quantification.ts with disjoint
    // column sets, so one of the two was guaranteed to 500 at runtime.
    const both = {
      a: [...expectedTables(exports_).values()][0],
      b: [...expectedTables(exports_).values()][0],
    };
    const dupes = duplicateTableDefinitions(both);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].exports).toEqual(["a", "b"]);
  });
});

describe("column-level comparison (S09-09)", () => {
  const table = "organization";
  const columnsOf = (name: string): DbColumn[] => {
    const t = expectedTables(exports_).get(name)!;
    const cols = Object.values(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t as any)[Symbol.for("drizzle:Columns")] as Record<string, any>,
    );
    return cols.map((c) => ({
      table_name: name,
      column_name: c.name,
      data_type: "x",
      udt_name: normalizeType(c.getSQLType()),
      is_nullable: c.notNull ? "NO" : "YES",
    }));
  };
  const flags: DbTableFlags[] = [];

  it("is clean when the database matches the declaration", () => {
    const report = compareSchema(
      exports_,
      [table],
      columnsOf(table),
      flags,
      guardsInOrder(),
    );
    expect(report.columnDrift).toEqual([]);
  });

  it("reports a column the database does not have", () => {
    const cols = columnsOf(table).filter((c) => c.column_name !== "name");
    const report = compareSchema(
      exports_,
      [table],
      cols,
      flags,
      guardsInOrder(),
    );
    expect(
      report.columnDrift.some(
        (d) => d.column === "name" && d.kind === "missing-in-db",
      ),
    ).toBe(true);
    expect(report.healthy).toBe(false);
  });

  it("reports a type mismatch", () => {
    const cols = columnsOf(table).map((c) =>
      c.column_name === "name" ? { ...c, udt_name: "int4" } : c,
    );
    const report = compareSchema(
      exports_,
      [table],
      cols,
      flags,
      guardsInOrder(),
    );
    expect(
      report.columnDrift.some(
        (d) => d.column === "name" && d.kind === "type-mismatch",
      ),
    ).toBe(true);
  });

  it("reports a NOT NULL promise the database does not keep", () => {
    const cols = columnsOf(table).map((c) =>
      c.column_name === "name" ? { ...c, is_nullable: "YES" } : c,
    );
    const report = compareSchema(
      exports_,
      [table],
      cols,
      flags,
      guardsInOrder(),
    );
    expect(
      report.columnDrift.some(
        (d) => d.column === "name" && d.kind === "nullability-mismatch",
      ),
    ).toBe(true);
  });

  // [ARCTOS-FULL-2026-08-31 / Restdefekte · O-6] The direction the check was
  // missing. Without it the comparison only ever asked whether the database
  // has everything the code declares; a column that exists ONLY in the
  // database (`control.source_library_ref` and 203 others) stayed invisible
  // and the report still said "column drift: 0".
  it("reports a column the DATABASE has and the schema does not declare", () => {
    const cols = [
      ...columnsOf(table),
      {
        table_name: table,
        column_name: "legacy_only_in_db",
        data_type: "character varying",
        udt_name: "varchar",
        is_nullable: "YES",
      },
    ];
    const report = compareSchema(
      exports_,
      [table],
      cols,
      flags,
      guardsInOrder(),
    );
    expect(report.columnDrift).toContainEqual({
      table,
      column: "legacy_only_in_db",
      kind: "extra-in-db",
      actual: "varchar",
    });
    // …and it has to make the report unhealthy. A direction that is reported
    // but does not fail the gate would leave "drift empty" half true.
    expect(report.healthy).toBe(false);
  });

  it("does not report extra columns for tables the schema does not claim", () => {
    // Tables that predate the TypeScript schema are `extraInDb` as a whole and
    // stay informational; their columns must not flood the column report.
    const report = compareSchema(
      exports_,
      [table, "some_sql_only_table"],
      [
        ...columnsOf(table),
        {
          table_name: "some_sql_only_table",
          column_name: "whatever",
          data_type: "text",
          udt_name: "text",
          is_nullable: "YES",
        },
      ],
      flags,
      guardsInOrder(),
    );
    expect(report.columnDrift).toEqual([]);
    expect(report.extraInDb).toContain("some_sql_only_table");
  });
});

describe("RLS comparison", () => {
  it("flags an org_id table without RLS and one with RLS but no policy", () => {
    const report = compareSchema(
      exports_,
      ["risk", "control"],
      [],
      [
        {
          table_name: "risk",
          relrowsecurity: false,
          policy_count: 0,
          has_org_id: true,
        },
        {
          table_name: "control",
          relrowsecurity: true,
          policy_count: 0,
          has_org_id: true,
        },
      ],
      guardsInOrder(),
    );
    expect(report.rlsDrift).toEqual([
      { table: "control", kind: "rls-without-policy" },
      { table: "risk", kind: "rls-missing" },
    ]);
  });

  it("ignores platform tables without org_id", () => {
    const report = compareSchema(
      exports_,
      ["risk"],
      [],
      [
        {
          table_name: "risk",
          relrowsecurity: false,
          policy_count: 0,
          has_org_id: false,
        },
      ],
      guardsInOrder(),
    );
    expect(report.rlsDrift).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// [ARCTOS-FULL-2026-08-31 · OP-155] Der ENABLE-Zustand der Trigger.
//
// Der Vergleicher las ihn nicht. Was das bedeutet, ist keine Theorie: Welle 1b
// hat gegen eine laufende Datenbank gemessen, dass
// `ALTER TABLE … ENABLE TRIGGER ALL` einen `ENABLE ALWAYS`-Trigger
// (`tgenabled = 'A'`) auf `'O'` (origin) zurückstuft. Danach feuert er unter
// `session_replication_role = 'replica'` nicht mehr — und genau so sind die 17
// Wächter des Audit-Trails gebaut. In `pg_trigger` steht der Trigger weiter,
// mit unveränderter Definition; jede Prüfung, die nur nach seiner Existenz
// fragt, ist danach grün und der Trail trotzdem beschreibbar.
describe("trigger ENABLE state (OP-155)", () => {
  it("is clean when every guard stands on ENABLE ALWAYS", () => {
    expect(compareTriggers(guardsInOrder())).toEqual([]);
  });

  it("catches the downgrade ENABLE TRIGGER ALL produces ('A' → 'O')", () => {
    const triggers = guardsInOrder().map((t) =>
      t.trigger_name === "audit_log_refuse_delete_trg"
        ? { ...t, tgenabled: "O" }
        : t,
    );
    expect(compareTriggers(triggers)).toEqual([
      {
        table: "audit_log",
        trigger: "audit_log_refuse_delete_trg",
        kind: "guard-not-always",
        expected: "A",
        actual: "O",
      },
    ]);
  });

  it("catches a guard that is gone entirely", () => {
    const triggers = guardsInOrder().filter(
      (t) => t.trigger_name !== "wb_audit_log_append_only_trg",
    );
    expect(compareTriggers(triggers)).toEqual([
      {
        table: "whistleblowing_audit_log",
        trigger: "wb_audit_log_append_only_trg",
        kind: "guard-missing",
        expected: "A",
      },
    ]);
  });

  it("catches ANY disabled trigger, guard or not", () => {
    // Ein `DISABLE TRIGGER`, das jemand nach einer Datenmigration liegen
    // lässt, ist ein entfernter Trigger, der aussieht, als wäre er da. Der
    // Befund gilt deshalb für jeden Trigger, nicht nur für die 17 Wächter.
    const triggers: DbTrigger[] = [
      ...guardsInOrder(),
      {
        table_name: "risk",
        trigger_name: "risk_audit_trigger",
        tgenabled: "D",
      },
    ];
    expect(compareTriggers(triggers)).toEqual([
      {
        table: "risk",
        trigger: "risk_audit_trigger",
        kind: "trigger-disabled",
        expected: "O",
        actual: "D",
      },
    ]);
  });

  // Die Gegenrichtung, ohne die das Register still hinter dem Schema
  // zurückbliebe: ein NEUER `ENABLE ALWAYS`-Wächter aus einer Migration muss
  // auffallen, solange ihn niemand eingetragen hat. Sonst wäre die Liste ein
  // Stand von 2026 und nicht der Soll-Zustand.
  it("catches an ENABLE ALWAYS trigger that is not in the register", () => {
    const triggers: DbTrigger[] = [
      ...guardsInOrder(),
      {
        table_name: "brandneue_tabelle",
        trigger_name: "brandneu_append_only_trg",
        tgenabled: "A",
      },
    ];
    expect(compareTriggers(triggers)).toEqual([
      {
        table: "brandneue_tabelle",
        trigger: "brandneu_append_only_trg",
        kind: "unregistered-always",
        actual: "A",
      },
    ]);
  });

  it("makes the whole report unhealthy — a downgraded guard is not cosmetic", () => {
    const report = compareSchema(
      exports_,
      [],
      [],
      [],
      guardsInOrder().map((t) =>
        t.trigger_name === "audit_log_chain_assign_trg"
          ? { ...t, tgenabled: "O" }
          : t,
      ),
    );
    expect(report.healthy).toBe(false);
    expect(report.triggerDrift).toHaveLength(1);
  });

  // Das Register ist eine Behauptung über die Datenbank. Diese Zusicherung
  // hält sie wenigstens in sich konsistent; ob sie mit dem laufenden Schema
  // übereinstimmt, prüft der Live-Lauf (tests/integration/schema-drift-live).
  //
  // Die Zahl ist Absicht und kein Detail: Sie fällt, sobald ein Wächter
  // still hinzukommt oder verschwindet. Sie wird deshalb nur zusammen mit
  // dem Grund fortgeschrieben, nie um einen roten Lauf zu beruhigen.
  //   17 → 18 am 2026-09-03 (OP-087, Migration 0477): Die drei neuen
  //   Wächter gegen `ALTER … DISABLE RLS` und `DROP POLICY` sind
  //   `ENABLE ALWAYS`; dazu kam der aus 0397, der auf 'O' stand und damit
  //   unter `session_replication_role = replica` wirkungslos war.
  it("registers 18 guards, each with a stated reason and no duplicates", () => {
    expect(ALWAYS_ENABLED_GUARDS).toHaveLength(18);
    const keys = ALWAYS_ENABLED_GUARDS.map((g) => `${g.table}.${g.trigger}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const g of ALWAYS_ENABLED_GUARDS) {
      expect(
        g.why.length,
        `${g.trigger} braucht eine Begründung`,
      ).toBeGreaterThan(20);
    }
  });
});
