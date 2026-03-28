import { db, evidenceConnector, connectorTestResult, evidenceArtifact } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, sql, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/connectors/dashboard — Connector health dashboard
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const connectors = await db
    .select()
    .from(evidenceConnector)
    .where(and(eq(evidenceConnector.orgId, ctx.orgId), isNull(evidenceConnector.deletedAt)));

  const totalConnectors = connectors.length;
  const activeConnectors = connectors.filter((c) => c.status === "active").length;
  const healthyConnectors = connectors.filter((c) => c.healthStatus === "healthy").length;
  const degradedConnectors = connectors.filter((c) => c.healthStatus === "degraded").length;
  const unhealthyConnectors = connectors.filter((c) => c.healthStatus === "unhealthy").length;

  const [testsResult] = await db
    .select({ value: count() })
    .from(connectorTestResult)
    .where(and(eq(connectorTestResult.orgId, ctx.orgId), gte(connectorTestResult.executedAt, twentyFourHoursAgo)));

  const [passResult] = await db
    .select({ value: count() })
    .from(connectorTestResult)
    .where(and(eq(connectorTestResult.orgId, ctx.orgId), gte(connectorTestResult.executedAt, twentyFourHoursAgo), eq(connectorTestResult.status, "pass")));

  const totalTestsRun24h = Number(testsResult.value);
  const passRate24h = totalTestsRun24h > 0 ? Math.round((Number(passResult.value) / totalTestsRun24h) * 100) : 0;

  const [artifactCount] = await db
    .select({ value: count() })
    .from(evidenceArtifact)
    .where(eq(evidenceArtifact.orgId, ctx.orgId));

  return Response.json({
    data: {
      totalConnectors,
      activeConnectors,
      healthyConnectors,
      degradedConnectors,
      unhealthyConnectors,
      totalTestsRun24h,
      passRate24h,
      totalArtifacts: Number(artifactCount.value),
      staleEvidence: 0,
    },
  });
}
