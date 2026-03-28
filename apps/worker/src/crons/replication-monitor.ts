// Sprint 80: Cross-Region Replication Monitor
// Monitors replication lag and alerts on issues

import { db, crossRegionReplication, sovereigntyAuditLog } from "@grc/db";
import { eq } from "drizzle-orm";

interface ReplicationMonitorResult {
  checked: number;
  alerts: number;
  errors: number;
}

export async function processReplicationMonitor(): Promise<ReplicationMonitorResult> {
  const result: ReplicationMonitorResult = { checked: 0, alerts: 0, errors: 0 };

  try {
    const replications = await db
      .select()
      .from(crossRegionReplication)
      .where(eq(crossRegionReplication.status, "active"));

    result.checked = replications.length;

    for (const repl of replications) {
      try {
        // Alert if lag exceeds 300 seconds (5 minutes)
        if (repl.lagSeconds && repl.lagSeconds > 300) {
          await db.insert(sovereigntyAuditLog).values({
            orgId: repl.orgId,
            eventType: "replication_event",
            description: `Replication lag alert: ${repl.lagSeconds}s between regions`,
            metadata: {
              replicationId: repl.id,
              lagSeconds: repl.lagSeconds,
              sourceRegionId: repl.sourceRegionId,
              targetRegionId: repl.targetRegionId,
            },
            isViolation: false,
          });
          result.alerts++;
        }

        // Check if last sync is older than 1 hour
        if (repl.lastSyncAt) {
          const elapsed = Date.now() - new Date(repl.lastSyncAt).getTime();
          if (elapsed > 3600000) {
            await db
              .update(crossRegionReplication)
              .set({ status: "failed" })
              .where(eq(crossRegionReplication.id, repl.id));

            await db.insert(sovereigntyAuditLog).values({
              orgId: repl.orgId,
              eventType: "replication_event",
              description: `Replication stale: last sync > 1 hour ago`,
              metadata: { replicationId: repl.id, lastSyncAt: repl.lastSyncAt },
              isViolation: true,
            });
            result.alerts++;
          }
        }
      } catch (err) {
        result.errors++;
      }
    }
  } catch (err) {
    console.error("[worker] replication-monitor: Failed:", err);
    result.errors++;
  }

  return result;
}
