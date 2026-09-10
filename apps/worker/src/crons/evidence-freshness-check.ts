// Sprint 62: Evidence Connector Framework — Freshness Check
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S14-03, S10-07, S10-10]
//
// The job computed staleness correctly and then wrote the answer to
// stdout. `createNotification` and `createTask` are documented shared
// services (CLAUDE.md:275-277) and neither was called, so a configured
// `maxAgeDays = 90` had no effect whatsoever: on day 91 a line appeared in
// the worker log, no control owner was told, and the stale evidence stayed
// listed as valid in the control assessment.
//
// It now notifies the organisation's control owners and admins — through
// the shared recipient resolver, so revoked memberships are excluded
// (S10-07), and through the deduplicating notification path, so a
// permanently stale connector produces one notification per stage per day
// rather than an unbounded stream (S10-10).
//
// Scope note: a connector with NO test result at all used to be skipped by
// `if (!latestResult) continue`. "Never tested" is exactly the state an
// evidence-freshness check exists to surface — and with S14-02 and S10-06
// fixed there will be more such connectors, not fewer — so it is now
// reported as its own stage instead of passing silently.

import { db, evidenceFreshnessConfig, connectorTestResult } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { resolveOrgRecipients } from "../lib/recipients";
import { insertNotification } from "../lib/notify";
import { createRunReport } from "../lib/job-runtime";

export const evidenceFreshnessCheckCron = "0 6 * * *"; // Daily at 6 AM

const RECIPIENT_ROLES = ["control_owner", "risk_manager", "admin"];

export const evidenceFreshnessCheck = withCronInstrumentation(
  "evidence-freshness-check",
  async (): Promise<{
    configsChecked: number;
    stale: number;
    warning: number;
    neverTested: number;
    notified: number;
    ok: boolean;
    failed: number;
    errors: string[];
  }> => {
    const report = createRunReport("evidence-freshness-check");
    const configs = await db
      .select()
      .from(evidenceFreshnessConfig)
      .where(eq(evidenceFreshnessConfig.notifyOnStale, true));

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const recipientCache = new Map<string, string[]>();
    let stale = 0;
    let warning = 0;
    let neverTested = 0;
    let notified = 0;

    for (const config of configs) {
      if (!config.connectorId) continue;
      try {
        const [latestResult] = await db
          .select({ executedAt: connectorTestResult.executedAt })
          .from(connectorTestResult)
          .where(
            and(
              eq(connectorTestResult.connectorId, config.connectorId),
              eq(connectorTestResult.orgId, config.orgId),
            ),
          )
          .orderBy(desc(connectorTestResult.executedAt))
          .limit(1);

        let stage: "stale" | "warning" | "never" | null = null;
        let daysSinceLastRun: number | null = null;

        if (!latestResult) {
          stage = "never";
          neverTested++;
        } else {
          daysSinceLastRun = Math.floor(
            (now.getTime() - new Date(latestResult.executedAt).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (daysSinceLastRun >= config.maxAgeDays) {
            stage = "stale";
            stale++;
          } else if (
            daysSinceLastRun >=
            config.maxAgeDays - config.warningDays
          ) {
            stage = "warning";
            warning++;
          }
        }

        if (!stage) continue;

        let recipients = recipientCache.get(config.orgId);
        if (!recipients) {
          recipients = await resolveOrgRecipients(
            config.orgId,
            RECIPIENT_ROLES,
            {
              limit: 25,
            },
          );
          recipientCache.set(config.orgId, recipients);
        }
        if (recipients.length === 0) {
          report.fail(
            `org ${config.orgId}`,
            new Error(
              "evidence is stale but the organisation has no active " +
                "control_owner, risk_manager or admin to notify",
            ),
          );
          continue;
        }

        const title =
          stage === "never"
            ? "Evidence never collected"
            : stage === "stale"
              ? "Evidence is stale"
              : "Evidence is approaching its maximum age";
        const message =
          stage === "never"
            ? `No test result has ever been recorded for this connector. ` +
              `Configured maximum age: ${config.maxAgeDays} days.`
            : `Last evidence is ${daysSinceLastRun} day(s) old; the ` +
              `configured maximum is ${config.maxAgeDays} days.`;

        for (const userId of recipients) {
          const written = await insertNotification(
            {
              orgId: config.orgId,
              userId,
              type: stage === "warning" ? "deadline_approaching" : "escalation",
              entityType: "evidence_connector",
              entityId: config.connectorId,
              title,
              message,
              channel: "both",
              templateKey: "control_status_changed",
              templateData: {
                title,
                message,
                connectorId: config.connectorId,
                maxAgeDays: config.maxAgeDays,
                daysSinceLastRun,
                stage,
              },
              scheduledFor: now,
            },
            {
              job: "evidence-freshness-check",
              // One notification per connector, recipient, stage and day: a
              // connector that stays stale for a month must not generate 30
              // identical escalations (S10-10).
              dedupeKey: `evidence-freshness|${config.connectorId}|${userId}|${stage}|${today}`,
            },
          );
          if (written) notified++;
        }
      } catch (err) {
        report.fail(`config ${config.id}`, err);
      }
    }

    return report.toResult({
      configsChecked: configs.length,
      stale,
      warning,
      neverTested,
      notified,
    });
  },
);
