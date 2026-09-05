#!/usr/bin/env node
/**
 * check-migration-index-names.mjs
 *
 * [ARCTOS-FULL-2026-08-31 / WP1 · S09-01]
 * Index names are unique SCHEMA-WIDE in PostgreSQL, not per table. Three of
 * the 43 permanently failing migrations died on exactly that:
 *   * `0268` reused `pqr_org_idx`, taken by `0026` for policy_quiz_response
 *   * `0039` reused `ccs_org_idx`, taken by `0166` for cloud_compliance_snapshot
 *   * `0025` reused `rc_org_idx`/`rc_status_idx`, taken by `0200`
 * Each aborted its whole file (42P07), so the tables it created never existed.
 *
 * This check reads the migration directory in the order the runner applies it
 * (byte order) and fails when a later file gives an existing index name to a
 * DIFFERENT table without `IF NOT EXISTS`. Reuse WITH `IF NOT EXISTS` is
 * reported as a warning: it does not break the migration, but it silently
 * skips an index someone intended to create.
 *
 * Exit code 1 on a hard collision. Run: node packages/db/tests/check-migration-index-names.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "drizzle",
);

const CREATE_INDEX =
  /CREATE\s+(UNIQUE\s+)?INDEX\s+(CONCURRENTLY\s+)?(IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z0-9_]+)"?\s+ON\s+"?([A-Za-z0-9_]+)"?/gi;

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** name -> { file, table } of the first definition. */
const seen = new Map();
const hard = [];
const soft = [];

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8").replace(
    /--[^\n]*/g,
    "",
  );
  for (const m of sql.matchAll(CREATE_INDEX)) {
    const [, , , ifNotExists, name, table] = m;
    const prev = seen.get(name);
    if (!prev) {
      seen.set(name, { file, table });
      continue;
    }
    if (prev.table === table) continue; // same table — a re-declaration, harmless
    const entry = `${name}: ${prev.file} (${prev.table}) → ${file} (${table})`;
    if (ifNotExists) soft.push(entry);
    else hard.push(entry);
  }
}

for (const s of soft) {
  console.log(
    `warning: index name reused across tables, silently skipped by IF NOT EXISTS — ${s}`,
  );
}

if (hard.length > 0) {
  console.error("");
  console.error(
    `Index-name collisions that abort a migration (42P07): ${hard.length}`,
  );
  for (const h of hard) console.error(`  ${h}`);
  console.error("");
  console.error(
    "Index names are unique schema-wide. Prefix the name with the table name.",
  );
  process.exit(1);
}

console.log(
  `OK: ${seen.size} index names across ${files.length} migrations, no hard collisions (${soft.length} soft reuses).`,
);
