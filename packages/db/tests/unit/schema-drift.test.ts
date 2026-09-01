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
  type DbColumn,
  type DbTableFlags,
} from "../schema-drift";

const exports_ = schemas as unknown as Record<string, unknown>;

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
    const report = compareSchema(exports_, [table], columnsOf(table), flags);
    expect(report.columnDrift).toEqual([]);
  });

  it("reports a column the database does not have", () => {
    const cols = columnsOf(table).filter((c) => c.column_name !== "name");
    const report = compareSchema(exports_, [table], cols, flags);
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
    const report = compareSchema(exports_, [table], cols, flags);
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
    const report = compareSchema(exports_, [table], cols, flags);
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
    const report = compareSchema(exports_, [table], cols, flags);
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
    );
    expect(report.rlsDrift).toEqual([]);
  });
});
