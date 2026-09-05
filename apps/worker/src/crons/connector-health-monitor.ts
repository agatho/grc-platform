// Sprint 62: Evidence Connector Framework — Health Monitor
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S14-02, S10-15]
//
// This job used to contain:
//
//     // Simulated health check — real implementation would ping the provider
//     const isHealthy = true;
//
// and then wrote `connector_health_check` rows with `status: "healthy"` and
// a response time measured between two adjacent `Date.now()` calls, plus
// `evidence_connector.healthStatus = "healthy"`. Every active connector was
// reported healthy every four hours without a single packet leaving the
// container. The connector dashboard therefore showed a perfect uptime
// history for integrations that may have been broken for months.
//
// There is no provider client in this build. Rather than keep writing
// "healthy", the job now refuses: it persists nothing, the run is recorded
// as failed (`job_run.status = 'failed'`, HTTP 500 on the endpoint), and
// `healthStatus` keeps whatever was last genuinely known. An absent health
// check is a visible gap; a fabricated one is not.

import { db, evidenceConnector } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { NotImplementedEvidenceError } from "../lib/job-runtime";

export const connectorHealthMonitorCron = "0 */4 * * *"; // Every 4 hours

export const connectorHealthMonitor = withCronInstrumentation(
  "connector-health-monitor",
  async (): Promise<{ activeConnectors: number }> => {
    const activeConnectors = await db
      .select({ id: evidenceConnector.id })
      .from(evidenceConnector)
      .where(
        and(
          eq(evidenceConnector.status, "active"),
          isNull(evidenceConnector.deletedAt),
        ),
      );

    if (activeConnectors.length === 0) return { activeConnectors: 0 };

    throw new NotImplementedEvidenceError(
      "evidence connector health check",
      `${activeConnectors.length} active connector(s) would have been probed. ` +
        `No provider client is wired up, so no health check is recorded.`,
    );
  },
);
