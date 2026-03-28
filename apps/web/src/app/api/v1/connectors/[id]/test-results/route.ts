import { db, connectorTestResult, connectorTestDefinition } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, count } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

// GET /api/v1/connectors/:id/test-results — List test results for a connector
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(connectorTestResult.connectorId, id),
    eq(connectorTestResult.orgId, ctx.orgId),
  ];

  const status = searchParams.get("status");
  if (status) {
    conditions.push(eq(connectorTestResult.status, status));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: connectorTestResult.id,
        testDefinitionId: connectorTestResult.testDefinitionId,
        testName: connectorTestDefinition.name,
        testKey: connectorTestDefinition.testKey,
        category: connectorTestDefinition.category,
        severity: connectorTestDefinition.severity,
        status: connectorTestResult.status,
        resourcesScanned: connectorTestResult.resourcesScanned,
        resourcesFailed: connectorTestResult.resourcesFailed,
        findings: connectorTestResult.findings,
        durationMs: connectorTestResult.durationMs,
        executedAt: connectorTestResult.executedAt,
      })
      .from(connectorTestResult)
      .leftJoin(connectorTestDefinition, eq(connectorTestResult.testDefinitionId, connectorTestDefinition.id))
      .where(where)
      .orderBy(desc(connectorTestResult.executedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(connectorTestResult).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
