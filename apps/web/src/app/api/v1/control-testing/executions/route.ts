import { db, controlTestExecution } from "@grc/db";
import { testExecutionQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/control-testing/executions — List executions
export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "control_owner",
    "auditor",
    "risk_manager",
  );
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = testExecutionQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, controlId, scriptId, status, result } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(controlTestExecution.orgId, ctx.orgId)];
  if (controlId) conditions.push(eq(controlTestExecution.controlId, controlId));
  if (scriptId) conditions.push(eq(controlTestExecution.scriptId, scriptId));
  if (status) conditions.push(eq(controlTestExecution.status, status));
  if (result) conditions.push(eq(controlTestExecution.result, result));

  const [executions, countResult] = await Promise.all([
    db
      .select()
      .from(controlTestExecution)
      .where(and(...conditions))
      .orderBy(desc(controlTestExecution.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(controlTestExecution)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: executions,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
