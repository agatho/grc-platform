import { db, biQuery } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { executeBiQuerySchema } from "@grc/shared";

// POST /api/v1/bi-reports/queries/execute — Execute read-only query (RLS enforced)
//
// #CRIT-SEC-RLS-BYPASS: previous version called db.execute() twice:
//   1. SET LOCAL app.current_org_id = ...; SET TRANSACTION READ ONLY;
//   2. the actual user query
// node-postgres wraps each db.execute() in its OWN implicit
// transaction, so the SET LOCALs were dropped before the second call
// fired. That left the user-supplied query running with NO RLS
// context and NO read-only constraint — a cross-tenant read primitive
// for any admin/risk_manager. (The comment "RLS enforced" was false.)
//
// Fix: wrap both statements in a single db.transaction(async (tx) =>
// { ... }) so SET LOCAL stays scoped to the same transaction as the
// query. Use tx.execute throughout.
//
// Also: the query is run via sql.raw(trimmedSql) which means
// trimmedSql goes through Postgres parser. We still validate that
// the string starts with SELECT, has no semicolons (no multi-
// statement), and has no comment sequences — those guards remain.
// What changes is the LRS/read-only enforcement, which is now real.

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = executeBiQuerySchema.parse(await req.json());

  // Retrieve the query
  const [queryDef] = await db
    .select()
    .from(biQuery)
    .where(and(eq(biQuery.id, body.queryId), eq(biQuery.orgId, ctx.orgId)));
  if (!queryDef)
    return Response.json({ error: "Query not found" }, { status: 404 });

  // Validate query is read-only — strict approach
  const trimmedSql = queryDef.sqlText.trim();
  const normalizedSql = trimmedSql.toUpperCase();

  // Must start with SELECT
  if (!normalizedSql.startsWith("SELECT")) {
    return Response.json(
      { error: "Only SELECT queries are allowed" },
      { status: 400 },
    );
  }

  // Block semicolons (no multi-statement)
  if (trimmedSql.includes(";")) {
    return Response.json(
      { error: "Multi-statement queries are not allowed" },
      { status: 400 },
    );
  }

  // Block comment sequences that could hide malicious SQL
  if (
    trimmedSql.includes("/*") ||
    trimmedSql.includes("*/") ||
    trimmedSql.includes("--")
  ) {
    return Response.json(
      { error: "SQL comments are not allowed" },
      { status: 400 },
    );
  }

  try {
    // Single transaction holds: SET LOCAL app.current_org_id + SET
    // TRANSACTION READ ONLY + user query. The SET LOCALs are scoped to
    // this transaction (Postgres semantics) and visible to the user
    // query that follows on the SAME connection.
    const queryResult = await db.transaction(async (tx) => {
      // RLS context — every RLS policy in the schema reads
      // current_setting('app.current_org_id').
      await tx.execute(
        sql`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`,
      );
      // Postgres won't accept arbitrary writes (INSERT/UPDATE/DELETE/
      // CREATE/etc) inside this txn even if the SELECT guard above
      // somehow lets one through.
      await tx.execute(sql`SET TRANSACTION READ ONLY`);
      // The actual user query, bounded by LIMIT.
      return tx.execute(sql`${sql.raw(trimmedSql)} LIMIT ${body.limit}`);
    });

    // Update query status to validated (outside the read-only txn)
    await db
      .update(biQuery)
      .set({ status: "validated", lastValidatedAt: new Date() })
      .where(eq(biQuery.id, body.queryId));

    return Response.json({
      data: {
        rows: queryResult,
        rowCount: Array.isArray(queryResult) ? queryResult.length : 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await db
      .update(biQuery)
      .set({ status: "failed", validationError: message })
      .where(eq(biQuery.id, body.queryId));

    // #SEC-LEAK-FIX consistent with the Wave-26 sweep: don't echo
    // Postgres' raw error back to the client (it may include schema
    // names + table names from the failed query). validationError is
    // stored on the row for the admin to inspect.
    console.error("[bi-reports/execute] query failed", err);
    return Response.json(
      { error: "Query execution failed" },
      { status: 400 },
    );
  }
}
