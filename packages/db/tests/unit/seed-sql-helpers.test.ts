// [ARCTOS-FULL-2026-08-31 · OP-269] A helper that is dropped before its
// callers run.
//
// `seed_cross_framework_mappings.sql` defined `insert_mapping()` and removed
// it again on its last line (`DROP FUNCTION IF EXISTS`). The four follow-up
// files v2 to v5 call that same function and define it nowhere. Every one of
// their 854 calls failed with
//
//   ERROR:  function insert_mapping(unknown, ..., integer, unknown) does not exist
//
// on every installation, for as long as the files have existed. Measured on
// 2026-09-15 against `grc_platform`: 88 mappings — exactly v1's 89 calls minus
// one. It never showed because `deploy/seed-catalogs.sh` anchored its error
// filter to the start of the line while psql prefixes `psql:/dev/stdin:24: `.
//
// These tests work on the file level, not against a database: which file
// defines, uses and drops a SQL function is right there in the text.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const SQL_DIR = join(__dirname, "..", "..", "sql");
const SRC_DIR = join(__dirname, "..", "..", "src");

const sqlFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));

/** Per file: does it define, use or drop `insert_mapping()`? */
function inspect(file: string) {
  const text = readFileSync(join(SQL_DIR, file), "utf-8");
  // Comment lines do not count — the note about the former DROP deliberately
  // stays as a comment in v1.
  const code = text
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
  return {
    defines: /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+insert_mapping/i.test(code),
    uses: /\binsert_mapping\s*\(/.test(code),
    drops: /DROP\s+FUNCTION[^;]*\binsert_mapping/i.test(code),
  };
}

describe("SQL seed helpers (OP-269)", () => {
  it("no seed file drops insert_mapping()", () => {
    const droppers = sqlFiles.filter((f) => inspect(f).drops);
    expect(
      droppers,
      "v2 to v5 need the helper and do not define it themselves. " +
        "Dropping it breaks 854 mappings silently.",
    ).toEqual([]);
  });

  it("exactly one file defines insert_mapping(), and it is v1", () => {
    const definers = sqlFiles.filter((f) => inspect(f).defines);
    expect(definers).toEqual(["seed_cross_framework_mappings.sql"]);
  });

  it("every file using insert_mapping() is wired into both runners, after v1", () => {
    const users = sqlFiles
      .filter((f) => {
        const i = inspect(f);
        return i.uses && !i.defines;
      })
      .sort();
    expect(users.length).toBeGreaterThan(0);

    for (const runner of ["seed-all.ts", "seed-demo.ts"]) {
      const src = readFileSync(join(SRC_DIR, runner), "utf-8");
      const v1 = src.indexOf('"seed_cross_framework_mappings.sql"');
      expect(v1, `${runner}: v1 is not wired in`).toBeGreaterThan(0);
      for (const file of users) {
        const pos = src.indexOf(`"${file}"`);
        expect(
          pos,
          `${runner}: ${file} calls insert_mapping() but is in no list — ` +
            `its mappings go nowhere.`,
        ).toBeGreaterThan(0);
        expect(
          pos,
          `${runner}: ${file} must come AFTER seed_cross_framework_mappings.sql, ` +
            `which defines the helper.`,
        ).toBeGreaterThan(v1);
      }
    }
  });

  it("every catalog key a mapping asks for is declared by a catalog seed", () => {
    // `insert_mapping()` stays silent when either lookup comes up empty
    // (`IF v_source_id IS NOT NULL AND v_target_id IS NOT NULL`). A typo in a
    // catalog key therefore costs mappings without a single message —
    // `eu_ai_act_2024_1689` against `eu_ai_act` cost seven.
    //
    // Deliberately coarse: any single-quoted lowercase literal in a
    // `seed_catalog_*.sql` counts as declared. A stricter version that read
    // only the `source` column of `INSERT INTO catalog` reported seven correct
    // keys as unknown on its first run — it broke on the `ON CONFLICT` forms
    // of the statement. For the failure this guards against — a key no catalog
    // knows at all — the coarse version is enough, and it reports nothing
    // false.
    const declared = new Set<string>();
    for (const f of sqlFiles.filter((f) => f.startsWith("seed_catalog_"))) {
      const text = readFileSync(join(SQL_DIR, f), "utf-8");
      for (const lit of text.matchAll(/'([a-z0-9_]{4,})'/g)) {
        if (lit[1]) declared.add(lit[1]);
      }
    }

    const requested = new Map<string, string>();
    for (const f of sqlFiles.filter((f) =>
      f.startsWith("seed_cross_framework_mappings"),
    )) {
      const text = readFileSync(join(SQL_DIR, f), "utf-8");
      for (const m of text.matchAll(
        /insert_mapping\(\s*'[^']*'\s*,\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*'([^']+)'/g,
      )) {
        const [, sourceCatalog, targetCatalog] = m;
        if (sourceCatalog) requested.set(sourceCatalog, f);
        if (targetCatalog) requested.set(targetCatalog, f);
      }
    }
    expect(requested.size).toBeGreaterThan(5);

    const unknown = [...requested.entries()]
      .filter(([key]) => !declared.has(key))
      .map(([key, file]) => `${key} (${file})`);
    expect(
      unknown,
      "These catalog keys are requested by a mapping file but declared by no seed_catalog_*.sql. " +
        "insert_mapping() skips such calls silently.",
    ).toEqual([]);
  });
});
