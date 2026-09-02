import * as schemas from "@grc/db";
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import {
  compareSchema,
  duplicateTableDefinitions,
  DRIFT_QUERIES,
  type DbColumn,
  type DbTableFlags,
} from "@grc/db/tests/schema-drift";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/health/schema-drift
//
// Reconciles the Drizzle ORM schema exported by `@grc/db` against the schema
// that actually exists in the connected database. ADR-014 ("Monitoring")
// recommends this endpoint as a deploy gate.
//
// [ARCTOS-FULL-2026-08-31 / WP1 · S09-09]
// The previous implementation compared TABLE NAMES and nothing else:
//
//     const missingInDb: string[] = [];
//     for (const t of expected) if (!dbTables.has(t)) missingInDb.push(t);
//
// Columns, types, nullability, constraints and RLS stayed out of scope. The
// endpoint therefore reported `healthy: true` for databases in which 23
// declared columns were missing — exactly the `column … does not exist` class
// its own header claimed to prevent. And the value only turned green *because*
// `create-missing-tables.ts` had created empty shells beforehand: the gate
// rewarded the very workaround it existed to catch.
//
// It now reports, through the shared comparator in
// `@grc/db/tests/schema-drift` (the same code the CI rehearsal job runs):
//   * tables declared but absent                       → missingInDb
//   * tables present but undeclared (informational)    → extraInDb
//   * columns absent, of the wrong type, or nullable
//     against a NOT NULL declaration                   → columnDrift
//   * org_id tables without RLS, or with RLS but no
//     policy — a deny-all table                        → rlsDrift
//   * one SQL table claimed by two `pgTable` definitions (S09-08)
//
// Admin-only. Three catalog queries plus one in-memory pass over the schema
// exports. Runs synchronously — not a cron.
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const rows = async <T>(query: string): Promise<T[]> => {
    const result = await db.execute<Record<string, unknown>>(sql.raw(query));
    return Array.isArray(result) ? (result as unknown as T[]) : [];
  };

  const [tableRows, columnRows, flagRows] = await Promise.all([
    rows<{ table_name: string }>(DRIFT_QUERIES.tables),
    rows<DbColumn>(DRIFT_QUERIES.columns),
    rows<DbTableFlags>(DRIFT_QUERIES.flags),
  ]);

  const schemaExports = schemas as unknown as Record<string, unknown>;
  const report = compareSchema(
    schemaExports,
    tableRows.map((r) => r.table_name),
    columnRows,
    flagRows,
  );
  const duplicateDefinitions = duplicateTableDefinitions(schemaExports);

  // `extraInDb` never affects health: some tables are managed by SQL alone and
  // legitimately have no `pgTable`. Everything else does — a missing table, a
  // missing or mistyped column, a tenant table without RLS and a table claimed
  // by two definitions each produce runtime 500s or a tenancy hole.
  const healthy = report.healthy && duplicateDefinitions.length === 0;

  return Response.json(
    {
      data: {
        healthy,
        expectedCount: report.expectedTableCount,
        dbCount: report.dbTableCount,
        missingInDb: report.missingInDb,
        extraInDb: report.extraInDb,
        columnDrift: report.columnDrift,
        rlsDrift: report.rlsDrift,
        duplicateDefinitions,
        counts: {
          missingInDb: report.missingInDb.length,
          extraInDb: report.extraInDb.length,
          columnDrift: report.columnDrift.length,
          rlsDrift: report.rlsDrift.length,
          duplicateDefinitions: duplicateDefinitions.length,
        },
        generatedAt: report.generatedAt,
      },
    },
    { status: healthy ? 200 : 503 },
  );
});
