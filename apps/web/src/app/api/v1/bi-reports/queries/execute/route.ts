import { db, biQuery } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { executeBiQuerySchema } from "@grc/shared";

// POST /api/v1/bi-reports/queries/execute — Execute read-only query (RLS enforced)
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
    // Set RLS context and execute within read-only transaction
    const result = await db.execute(sql`
      SET LOCAL app.current_org_id = ${ctx.orgId};
      SET TRANSACTION READ ONLY;
    `);

    const queryResult = await db.execute(
      sql`${sql.raw(trimmedSql)} LIMIT ${body.limit}`,
    );

    // Update query status to validated
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

    return Response.json(
      { error: "Query execution failed", details: message },
      { status: 400 },
    );
  }
}
