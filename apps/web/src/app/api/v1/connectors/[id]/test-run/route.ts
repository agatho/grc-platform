import { db, connectorTestResult, connectorTestDefinition, evidenceConnector } from "@grc/db";
import { triggerTestRunSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/connectors/:id/test-run — Trigger manual test run
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [connector] = await db
    .select()
    .from(evidenceConnector)
    .where(and(eq(evidenceConnector.id, id), eq(evidenceConnector.orgId, ctx.orgId), isNull(evidenceConnector.deletedAt)));

  if (!connector) {
    return Response.json({ error: "Connector not found" }, { status: 404 });
  }

  const body = triggerTestRunSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Get applicable test definitions
  let testDefs = await db
    .select()
    .from(connectorTestDefinition)
    .where(
      and(
        eq(connectorTestDefinition.connectorType, connector.connectorType),
        eq(connectorTestDefinition.isActive, true),
        body.data.testKeys
          ? inArray(connectorTestDefinition.testKey, body.data.testKeys)
          : undefined,
      ),
    );

  if (testDefs.length === 0) {
    return Response.json({ error: "No test definitions found for this connector type" }, { status: 404 });
  }

  // Execute tests (simulated — real implementation would call provider APIs)
  const results = await withAuditContext(ctx, async (tx) => {
    const testResults = [];
    for (const testDef of testDefs) {
      const [result] = await tx
        .insert(connectorTestResult)
        .values({
          orgId: ctx.orgId,
          connectorId: id,
          testDefinitionId: testDef.id,
          status: "pass", // placeholder — real execution would evaluate
          result: { simulated: true },
          findings: [],
          resourcesScanned: 1,
          resourcesFailed: 0,
          durationMs: Math.floor(Math.random() * 500) + 100,
        })
        .returning();
      testResults.push(result);
    }
    return testResults;
  });

  return Response.json({ data: { testsRun: results.length, results } }, { status: 201 });
}
