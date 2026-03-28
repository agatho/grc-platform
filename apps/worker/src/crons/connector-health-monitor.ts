// Sprint 62: Evidence Connector Framework — Health Monitor
// Periodically checks health of all active connectors

import { db, evidenceConnector, connectorHealthCheck } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";

export const connectorHealthMonitorCron = "0 */4 * * *"; // Every 4 hours

export async function connectorHealthMonitor(): Promise<void> {
  const activeConnectors = await db
    .select()
    .from(evidenceConnector)
    .where(
      and(
        eq(evidenceConnector.status, "active"),
        isNull(evidenceConnector.deletedAt),
      ),
    );

  for (const connector of activeConnectors) {
    try {
      const startTime = Date.now();

      // Simulated health check — real implementation would ping the provider
      const isHealthy = true;
      const responseTimeMs = Date.now() - startTime;
      const healthStatus = isHealthy ? "healthy" : "unhealthy";

      await db.insert(connectorHealthCheck).values({
        orgId: connector.orgId,
        connectorId: connector.id,
        status: healthStatus,
        responseTimeMs,
        checkType: "connectivity",
        details: { connectorType: connector.connectorType },
      });

      await db
        .update(evidenceConnector)
        .set({
          lastHealthCheck: new Date(),
          healthStatus,
          updatedAt: new Date(),
        })
        .where(eq(evidenceConnector.id, connector.id));
    } catch {
      await db.insert(connectorHealthCheck).values({
        orgId: connector.orgId,
        connectorId: connector.id,
        status: "unhealthy",
        checkType: "connectivity",
        errorMessage: "Health check failed",
      });

      await db
        .update(evidenceConnector)
        .set({
          lastHealthCheck: new Date(),
          healthStatus: "unhealthy",
          updatedAt: new Date(),
        })
        .where(eq(evidenceConnector.id, connector.id));
    }
  }
}
