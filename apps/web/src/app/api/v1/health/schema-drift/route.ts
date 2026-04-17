import * as schemas from "@grc/db";
import { db } from "@grc/db";
import { Table, getTableName, is, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/health/schema-drift
//
// Returns a reconciliation between the Drizzle ORM schema exported by
// `@grc/db` and the tables that actually exist in the current database.
// Backs F-18: the migration split (F-17) meant that the TypeScript build
// kept compiling cleanly while server-side endpoints threw 500 at runtime
// because tables simply weren't there. This endpoint surfaces the drift
// deterministically so monitoring / staging smoke tests can gate a deploy.
//
// Admin-only. Performs one pg_class query + one in-memory iteration of the
// Drizzle schema exports; O(N_tables). Runs synchronously — not a cron.
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  // 1. Collect expected table names from all Drizzle schema exports.
  const expected = new Set<string>();
  for (const value of Object.values(schemas)) {
    if (value && is(value as never, Table)) {
      expected.add(getTableName(value as unknown as Table));
    }
  }

  // 2. Enumerate actually-existing tables in the connected database
  //    (user-space schemas only, no catalog / pg_* system tables).
  type PgRow = { table_schema: string; table_name: string };
  const result = await db.execute<PgRow>(sql`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
  `);
  const rows: PgRow[] = Array.isArray(result) ? (result as PgRow[]) : [];
  const dbTables = new Set(rows.map((r) => r.table_name));

  // 3. Compute the diff.
  const missingInDb: string[] = [];
  for (const t of expected) {
    if (!dbTables.has(t)) missingInDb.push(t);
  }
  const extraInDb: string[] = [];
  for (const t of dbTables) {
    if (!expected.has(t)) extraInDb.push(t);
  }

  missingInDb.sort();
  extraInDb.sort();

  const healthy = missingInDb.length === 0;

  return Response.json(
    {
      data: {
        healthy,
        expectedCount: expected.size,
        dbCount: dbTables.size,
        missingInDb,
        extraInDb,
        generatedAt: new Date().toISOString(),
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
