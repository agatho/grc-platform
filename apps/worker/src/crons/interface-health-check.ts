// Sprint 37: Interface Health Check Worker
// Runs every 15 minutes — checks health_check_url for all interfaces

import { db, applicationInterface } from "@grc/db";
import { isNotNull, eq } from "drizzle-orm";

export async function processInterfaceHealthCheck(): Promise<{
  checked: number;
  active: number;
  degraded: number;
  down: number;
}> {
  console.log("[interface-health-check] Starting health checks");

  const interfaces = await db
    .select()
    .from(applicationInterface)
    .where(isNotNull(applicationInterface.healthCheckUrl));

  let active = 0;
  let degraded = 0;
  let down = 0;

  // Execute checks in parallel with 5-second timeout
  const results = await Promise.allSettled(
    interfaces.map(async (iface) => {
      const url = iface.healthCheckUrl!;

      // Validate URL (reject private IPs)
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") {
          return { id: iface.id, status: "down" as const, previousStatus: iface.healthStatus };
        }
        const hostname = parsed.hostname;
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|localhost|0\.)/.test(hostname)) {
          return { id: iface.id, status: "down" as const, previousStatus: iface.healthStatus };
        }
      } catch {
        return { id: iface.id, status: "down" as const, previousStatus: iface.healthStatus };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const status = response.status;
        if (status >= 200 && status < 300) {
          return { id: iface.id, status: "active" as const, previousStatus: iface.healthStatus };
        } else if (status >= 500) {
          return { id: iface.id, status: "degraded" as const, previousStatus: iface.healthStatus };
        }
        return { id: iface.id, status: "active" as const, previousStatus: iface.healthStatus };
      } catch {
        return { id: iface.id, status: "down" as const, previousStatus: iface.healthStatus };
      }
    }),
  );

  // Update statuses
  for (const result of results) {
    if (result.status === "fulfilled") {
      const { id, status, previousStatus } = result.value;
      await db
        .update(applicationInterface)
        .set({ healthStatus: status, lastHealthCheck: new Date() })
        .where(eq(applicationInterface.id, id));

      if (status === "active") active++;
      else if (status === "degraded") degraded++;
      else down++;

      // Detect status change for notification
      if (previousStatus !== status && previousStatus !== "unknown") {
        console.log(`[interface-health-check] Status changed: ${previousStatus} -> ${status} for interface ${id}`);
      }
    }
  }

  console.log(`[interface-health-check] Checked ${interfaces.length}: ${active} active, ${degraded} degraded, ${down} down`);
  return { checked: interfaces.length, active, degraded, down };
}
