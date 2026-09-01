/**
 * schema-drift-report.ts — CLI for the deep schema comparison.
 *
 * [ARCTOS-FULL-2026-08-31 / WP1 · S09-09]
 * Usage:
 *   DATABASE_URL=… npx tsx tests/schema-drift-report.ts [--fail-on-drift] [--json]
 *
 * Exit code 1 with `--fail-on-drift` when anything the code declares is
 * missing or differs in the database. `extraInDb` (objects in the database
 * that the Drizzle schema does not declare) is reported but never fails the
 * run: a number of tables predate the TypeScript schema and are managed by
 * SQL alone.
 */
import postgres from "postgres";
import * as schemas from "../src/index";
import {
  compareSchema,
  duplicateTableDefinitions,
  DRIFT_QUERIES,
  type DbColumn,
  type DbTableFlags,
} from "./schema-drift";

async function main() {
  const failOnDrift = process.argv.includes("--fail-on-drift");
  const asJson = process.argv.includes("--json");
  const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

  try {
    const tables = (
      await client.unsafe<{ table_name: string }[]>(DRIFT_QUERIES.tables)
    ).map((r) => r.table_name);
    const columns = await client.unsafe<DbColumn[]>(DRIFT_QUERIES.columns);
    const flags = await client.unsafe<DbTableFlags[]>(DRIFT_QUERIES.flags);

    const report = compareSchema(
      schemas as unknown as Record<string, unknown>,
      tables,
      columns,
      flags,
    );
    const duplicates = duplicateTableDefinitions(
      schemas as unknown as Record<string, unknown>,
    );

    if (asJson) {
      console.log(JSON.stringify({ ...report, duplicates }, null, 2));
    } else {
      console.log(
        `Drizzle tables: ${report.expectedTableCount}   DB tables: ${report.dbTableCount}`,
      );
      console.log(`missing in DB : ${report.missingInDb.length}`);
      console.log(`extra in DB   : ${report.extraInDb.length} (informational)`);
      console.log(`column drift  : ${report.columnDrift.length}`);
      console.log(`RLS drift     : ${report.rlsDrift.length}`);
      console.log(`duplicate defs: ${duplicates.length}`);

      for (const t of report.missingInDb) console.log(`  MISSING TABLE  ${t}`);
      for (const c of report.columnDrift) {
        console.log(
          `  ${c.kind.toUpperCase().padEnd(22)} ${c.table}.${c.column}` +
            (c.expected ? `  expected=${c.expected}` : "") +
            (c.actual ? ` actual=${c.actual}` : ""),
        );
      }
      for (const r of report.rlsDrift) {
        console.log(`  ${r.kind.toUpperCase().padEnd(22)} ${r.table}`);
      }
      for (const d of duplicates) {
        console.log(
          `  DUPLICATE pgTable      ${d.table} declared by ${d.exports.join(", ")}`,
        );
      }
    }

    // RLS drift is reported but does not fail the gate yet: the three log
    // tables (access_log, audit_anchor, audit_log) are finding S01-06 and
    // belong to WP2 (Mandantentrennung/RLS). Pass --fail-on-rls once that
    // package has landed — this is a named hand-over, not a frozen baseline.
    const failOnRls = process.argv.includes("--fail-on-rls");
    const bad =
      report.missingInDb.length > 0 ||
      report.columnDrift.length > 0 ||
      duplicates.length > 0 ||
      (failOnRls && report.rlsDrift.length > 0);
    if (failOnDrift && bad) {
      console.error("\nschema drift detected — see the list above.");
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
