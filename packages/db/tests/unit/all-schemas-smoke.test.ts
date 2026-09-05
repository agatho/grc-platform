// [ARCTOS-FULL-2026-08-31 / WP11 · S11-10]
//
// WHAT THIS FILE USED TO BE. It auto-discovered the 113 Drizzle schema files
// and emitted three `it()` blocks per file — "loads without errors", "exports
// at least one entity", "each exported value is non-null" — i.e. the bulk of
// the package's 409 tests. All three are restatements of "the import
// succeeded". They are how `packages/db` reported 409 green tests while
// covering 1 of 2 047 functions (S11-10).
//
// WHAT IT IS NOW. The import check survives as ONE test that names every
// offender at once. Everything else is a schema *contract* checked against the
// real Drizzle table metadata:
//
//   * every table has a primary key      — a table without one cannot be
//                                          updated or audited row-wise;
//   * `org_id` is uuid everywhere        — S01-25 was a ::text comparison in a
//                                          policy; a varchar org_id is the
//                                          same defect one layer down;
//   * no physical table is defined twice — S09-08 found two `pgTable`
//                                          definitions per DB table with
//                                          disjoint column sets;
//   * soft-delete columns come in pairs  — `deleted_by` without `deleted_at`
//                                          cannot be filtered;
//   * column names are snake_case        — a camelCase name type-checks and
//                                          then fails at runtime.
//
// Each of these can fail on a change the old file waved through.

import { describe, it, expect, beforeAll } from "vitest";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";

// [ARCTOS-FULL-2026-08-31 · OP-167] Kein Typargument an `import.meta.glob`.
//
// Next 16.3 bringt eine eigene Deklaration von `import.meta.glob` mit, die
// KEIN Typargument nimmt; Vites Deklaration nimmt eines. Sie gilt für den
// ganzen Baum, also auch hier, wo gar kein Next im Spiel ist. Wer eines
// übergibt, bekommt `TS2558: Expected 0 type arguments, but got 1` und
// darunter eine Kaskade von `unknown`. Die Form unten ist unter beiden
// Deklarationen gültig und sagt dasselbe.
const schemaModules = import.meta.glob("../../src/schema/*.ts") as Record<
  string,
  () => Promise<Record<string, unknown>>
>;

interface DiscoveredTable {
  file: string;
  exportName: string;
  table: PgTable;
}

let cache: {
  tables: DiscoveredTable[];
  brokenImports: string[];
  emptyFiles: string[];
} | null = null;

async function discover() {
  if (cache) return cache;
  const tables: DiscoveredTable[] = [];
  const brokenImports: string[] = [];
  const emptyFiles: string[] = [];

  for (const [path, importer] of Object.entries(schemaModules)) {
    const file = path.split("/").pop()!.replace(".ts", "");
    let mod: Record<string, unknown>;
    try {
      mod = await importer();
    } catch (err) {
      brokenImports.push(
        `${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
    const exportNames = Object.keys(mod).filter(
      (k) => k !== "default" && !k.startsWith("__"),
    );
    if (exportNames.length === 0) {
      emptyFiles.push(file);
      continue;
    }
    for (const name of exportNames) {
      const value = mod[name];
      if (is(value, PgTable)) {
        tables.push({ file, exportName: name, table: value as PgTable });
      }
    }
  }
  cache = { tables, brokenImports, emptyFiles };
  return cache;
}

// Discovery is done once, in a hook, so the per-test timeout applies to the
// assertions and not to 113 module imports.
beforeAll(async () => {
  await discover();
}, 60_000);

describe("Drizzle schema files — module integrity (auto-discovered)", () => {
  it("discovers every schema file", () => {
    expect(Object.keys(schemaModules).length).toBeGreaterThanOrEqual(100);
  });

  it("imports every schema module and finds tables in them", async () => {
    const { tables, brokenImports, emptyFiles } = await discover();
    expect(
      brokenImports,
      `schema modules that fail to import:\n${brokenImports.join("\n")}`,
    ).toEqual([]);
    expect(
      emptyFiles,
      `schema files without any export:\n${emptyFiles.join("\n")}`,
    ).toEqual([]);
    // The whole platform schema. A collapse to a handful would mean the glob
    // stopped matching — something the old per-file loop could not notice.
    expect(tables.length).toBeGreaterThan(400);
  });
});

describe("Drizzle schema contract", () => {
  it("every table declares a primary key", async () => {
    const { tables } = await discover();
    const without: string[] = [];
    for (const t of tables) {
      const cfg = getTableConfig(t.table);
      const hasPk =
        cfg.primaryKeys.length > 0 || cfg.columns.some((c) => c.primary);
      if (!hasPk) without.push(`${t.file}.${t.exportName} (${cfg.name})`);
    }
    expect(
      without,
      "tables without a primary key — they cannot be updated or audited " +
        `row-wise:\n${without.join("\n")}`,
    ).toEqual([]);
  });

  it("org_id is a uuid wherever it exists", async () => {
    const { tables } = await discover();
    const wrong: string[] = [];
    for (const t of tables) {
      const cfg = getTableConfig(t.table);
      for (const col of cfg.columns) {
        if (col.name !== "org_id" && col.name !== "organization_id") continue;
        if (col.columnType !== "PgUUID") {
          wrong.push(`${cfg.name}.${col.name} is ${col.columnType}, not uuid`);
        }
      }
    }
    expect(
      wrong,
      "RLS policies compare org_id as uuid. A non-uuid column forces a cast " +
        `and reintroduces S01-25:\n${wrong.join("\n")}`,
    ).toEqual([]);
  });

  it("no physical table is defined by two pgTable objects (S09-08)", async () => {
    const { tables } = await discover();
    const byName = new Map<string, string[]>();
    for (const t of tables) {
      const cfg = getTableConfig(t.table);
      byName.set(cfg.name, [
        ...(byName.get(cfg.name) ?? []),
        `${t.file}.${t.exportName}`,
      ]);
    }
    const duplicates = [...byName.entries()]
      .filter(([, defs]) => defs.length > 1)
      .map(([name, defs]) => `${name}: ${defs.join(" + ")}`);
    expect(
      duplicates,
      "Two Drizzle definitions for one physical table let each half see a " +
        `different column set — the S09-08 pattern:\n${duplicates.join("\n")}`,
    ).toEqual([]);
  });

  it("soft-delete columns come as a usable pair", async () => {
    const { tables } = await discover();
    const broken: string[] = [];
    for (const t of tables) {
      const cfg = getTableConfig(t.table);
      const names = new Set(cfg.columns.map((c) => c.name));
      if (names.has("deleted_by") && !names.has("deleted_at")) {
        broken.push(`${cfg.name}: deleted_by without deleted_at`);
      }
    }
    expect(
      broken,
      "A table that records WHO deleted a row but not WHEN cannot be " +
        `filtered by the soft-delete predicate:\n${broken.join("\n")}`,
    ).toEqual([]);
  });

  it("every column name is snake_case (matches the SQL migrations)", async () => {
    const { tables } = await discover();
    const offenders: string[] = [];
    for (const t of tables) {
      const cfg = getTableConfig(t.table);
      for (const col of cfg.columns) {
        if (!/^[a-z0-9_]+$/.test(col.name)) {
          offenders.push(`${cfg.name}.${col.name}`);
        }
      }
    }
    expect(
      offenders,
      "A camelCase column name in the Drizzle definition does not exist in " +
        "the database and produces a runtime error, not a type error:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
