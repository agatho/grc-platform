import { Hono } from "hono";
import { processOverdueTasks } from "./crons/overdue-tasks";
import { processScheduledNotifications } from "./crons/scheduled-notifications";
import { processNotificationDigest } from "./crons/notification-digest";
import { processKriOverdueAlerts } from "./crons/kri-overdue-alert";
import { processRiskReviewReminders } from "./crons/risk-review-reminder";
import { processTreatmentOverdueReminders } from "./crons/treatment-overdue-reminder";
import { processReviewReminders } from "./crons/process-review-reminder";
import { processDsrSlaMonitor } from "./crons/dsr-sla-monitor";
import { processBreach72hMonitor } from "./crons/breach-72h-monitor";
import { processRopaReviewReminders } from "./crons/ropa-review-reminder";
import { processContractExpiryMonitor } from "./crons/contract-expiry-monitor";
import { processVendorReassessmentMonitor } from "./crons/vendor-reassessment-monitor";
import { processSlaMeasurementReminder } from "./crons/sla-measurement-reminder";
import { processDdReminder } from "./crons/dd-reminder";
import { processDdExpiry } from "./crons/dd-expiry";
import { processEsgCompletenessCheck } from "./crons/esg-completeness-check";
import { processEsgTargetStatus } from "./crons/esg-target-status";
import { processEsgEmissionAggregate } from "./crons/esg-emission-aggregate";
import { processCesRecompute } from "./crons/ces-recompute";
import { processExecutiveKpiSnapshot } from "./crons/executive-kpi-snapshot";
import { processRegulatoryFeedFetcher } from "./crons/regulatory-feed-fetcher";
import { processRegulatoryRelevanceScorer } from "./crons/regulatory-relevance-scorer";
import { processWbDeadlineMonitor } from "./crons/wb-deadline-monitor";
import { processBudgetForecast } from "./crons/budget-forecast";
import { processRoiCalculation } from "./crons/roi-calculation";
import { processMonthlyReportGenerator } from "./crons/monthly-report-generator";
import { processRcsaReminder } from "./crons/rcsa-reminder";
import { processRcsaOverdueCheck } from "./crons/rcsa-overdue-check";
import { processPolicyReminder } from "./crons/policy-reminder";
import { processPolicyOverdueEscalation } from "./crons/policy-overdue-escalation";
import { processPolicyVersionCheck } from "./crons/policy-version-check";
import { processPlaybookPhaseEscalation } from "./crons/playbook-phase-escalation";
import { processPlaybookSuggestion } from "./crons/playbook-suggestion";
import { processCalendarDigest } from "./crons/calendar-digest";
import { processCalendarOverdueCheck } from "./crons/calendar-overdue-check";
import { processDashboardCleanup } from "./crons/dashboard-cleanup";
import { processScheduledExport } from "./crons/scheduled-export";
import { processScimSyncCleanup } from "./crons/scim-sync-cleanup";
import { processScimTokenAudit } from "./crons/scim-token-audit";
import { processWebhookRetryJob } from "./crons/webhook-retry";
import { processRiskAppetiteCheck } from "./crons/risk-appetite-check";
import { processAssuranceSnapshot } from "./crons/assurance-snapshot";
import { processPostureSnapshot } from "./crons/posture-snapshot";
import { processNis2DeadlineMonitor } from "./crons/nis2-deadline-monitor";
import { processCertReadinessSnapshot } from "./crons/cert-readiness-snapshot";
import { processFairAppetiteCheck } from "./crons/fair-appetite-check";
import { processCveFeedSync } from "./crons/cve-feed-sync";
import { processCCIMonthlyAggregation } from "./crons/cci-monthly-aggregation";
import { processQueryCacheWarmer } from "./crons/query-cache-warmer";
import { initAutomationEngine, getAutomationEngine } from "./crons/automation-engine-init";
import { processReportScheduler } from "./crons/report-scheduler";
import { processThreatFeedSync } from "./crons/threat-feed-sync";
import { registerModuleCrons } from "./lib/module-aware-cron";

const app = new Hono();

// ──────────────────────────────────────────────────────────────
// Register module-aware background processes on startup
// ──────────────────────────────────────────────────────────────

const moduleCrons = registerModuleCrons();

// Sprint 28: Initialize Automation Engine (subscribes to Event Bus)
initAutomationEngine();

// ──────────────────────────────────────────────────────────────
// Middleware: CRON_SECRET verification for /crons/* routes
// ──────────────────────────────────────────────────────────────

app.use("/crons/*", async (c, next) => {
  const secret = c.req.header("X-Cron-Secret");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return c.json({ error: "CRON_SECRET not configured on server" }, 500);
  }

  // Constant-time comparison to prevent timing attacks
  const secretBuf = Buffer.from(secret ?? "");
  const expectedBuf = Buffer.from(expected);
  if (secretBuf.length !== expectedBuf.length || !require("crypto").timingSafeEqual(secretBuf, expectedBuf)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

// ──────────────────────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({ status: "ok", service: "worker", timestamp: new Date().toISOString() }),
);

// ──────────────────────────────────────────────────────────────
// Auth.js event processing (placeholder for future implementation)
// ──────────────────────────────────────────────────────────────

app.post("/events/auth", async (c) => {
  const body = await c.req.json();
  const eventType = body.type as string | undefined;

  // TODO: Implement Auth.js event handlers
  // - Sync user data to worker-managed tables
  // - Write access_log entries
  // - Trigger downstream workflows (notifications, audit)
  console.log(`[worker] Received auth event: ${eventType ?? "unknown"}`);

  return c.json({ received: true, event: eventType ?? "unknown" });
});

// ──────────────────────────────────────────────────────────────
// Cron endpoints — triggered by external schedulers
// ──────────────────────────────────────────────────────────────

app.post("/crons/overdue-tasks", async (c) => {
  try {
    const result = await processOverdueTasks();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] overdue-tasks cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/scheduled-notifications", async (c) => {
  try {
    const result = await processScheduledNotifications();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] scheduled-notifications cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/notification-digest", async (c) => {
  try {
    const result = await processNotificationDigest();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] notification-digest cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/kri-overdue-alerts", async (c) => {
  try {
    const result = await processKriOverdueAlerts();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] kri-overdue-alerts cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/risk-review-reminders", async (c) => {
  try {
    const result = await processRiskReviewReminders();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] risk-review-reminders cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/treatment-overdue-reminders", async (c) => {
  try {
    const result = await processTreatmentOverdueReminders();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] treatment-overdue-reminders cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/process-review-reminders", async (c) => {
  try {
    const result = await processReviewReminders();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] process-review-reminders cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// DPMS cron endpoints — Data Protection Management System
// ──────────────────────────────────────────────────────────────

app.post("/crons/dsr-sla-monitor", async (c) => {
  try {
    const result = await processDsrSlaMonitor();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] dsr-sla-monitor cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/breach-72h-monitor", async (c) => {
  try {
    const result = await processBreach72hMonitor();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] breach-72h-monitor cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/ropa-review-reminders", async (c) => {
  try {
    const result = await processRopaReviewReminders();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] ropa-review-reminders cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// TPRM + Contract Management cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/contract-expiry-monitor", async (c) => {
  try {
    const result = await processContractExpiryMonitor();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] contract-expiry-monitor cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/vendor-reassessment-monitor", async (c) => {
  try {
    const result = await processVendorReassessmentMonitor();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] vendor-reassessment-monitor cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/sla-measurement-reminder", async (c) => {
  try {
    const result = await processSlaMeasurementReminder();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] sla-measurement-reminder cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// DD Portal cron endpoints — Supplier Due Diligence
// ──────────────────────────────────────────────────────────────

app.post("/crons/dd-reminder", async (c) => {
  try {
    const result = await processDdReminder();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] dd-reminder cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/dd-expiry", async (c) => {
  try {
    const result = await processDdExpiry();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] dd-expiry cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// ESG/CSRD cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/esg-completeness-check", async (c) => {
  try {
    const result = await processEsgCompletenessCheck();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] esg-completeness-check cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/esg-target-status", async (c) => {
  try {
    const result = await processEsgTargetStatus();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] esg-target-status cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/esg-emission-aggregate", async (c) => {
  try {
    const result = await processEsgEmissionAggregate();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] esg-emission-aggregate cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 11: CCM + AI Intelligence cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/ces-recompute", async (c) => {
  try {
    const result = await processCesRecompute();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] ces-recompute cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/executive-kpi-snapshot", async (c) => {
  try {
    const result = await processExecutiveKpiSnapshot();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] executive-kpi-snapshot cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/regulatory-feed-fetcher", async (c) => {
  try {
    const result = await processRegulatoryFeedFetcher();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] regulatory-feed-fetcher cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/regulatory-relevance-scorer", async (c) => {
  try {
    const result = await processRegulatoryRelevanceScorer();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] regulatory-relevance-scorer cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 12: Whistleblowing cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/wb-deadline-monitor", async (c) => {
  try {
    const result = await processWbDeadlineMonitor();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] wb-deadline-monitor cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 13: GRC Budget cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/budget-forecast", async (c) => {
  try {
    const result = await processBudgetForecast();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] budget-forecast cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/roi-calculation", async (c) => {
  try {
    const result = await processRoiCalculation();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] roi-calculation cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/monthly-report-generator", async (c) => {
  try {
    const result = await processMonthlyReportGenerator();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] monthly-report-generator cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 14: RCSA cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/rcsa-reminder", async (c) => {
  try {
    const result = await processRcsaReminder();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] rcsa-reminder cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/rcsa-overdue-check", async (c) => {
  try {
    const result = await processRcsaOverdueCheck();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] rcsa-overdue-check cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 15: Policy Acknowledgment Portal cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/policy-reminder", async (c) => {
  try {
    const result = await processPolicyReminder();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] policy-reminder cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/policy-overdue-escalation", async (c) => {
  try {
    const result = await processPolicyOverdueEscalation();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] policy-overdue-escalation cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/policy-version-check", async (c) => {
  try {
    const result = await processPolicyVersionCheck();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] policy-version-check cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 16: Playbook Incident Response cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/playbook-phase-escalation", async (c) => {
  try {
    const result = await processPlaybookPhaseEscalation();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] playbook-phase-escalation cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/playbook-suggestion", async (c) => {
  try {
    const result = await processPlaybookSuggestion();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] playbook-suggestion cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 17: Compliance Calendar cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/calendar-digest", async (c) => {
  try {
    const result = await processCalendarDigest();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] calendar-digest cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/calendar-overdue-check", async (c) => {
  try {
    const result = await processCalendarOverdueCheck();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] calendar-overdue-check cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 18: Custom Dashboards cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/dashboard-cleanup", async (c) => {
  try {
    const result = await processDashboardCleanup();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] dashboard-cleanup cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 19: Bulk Import/Export cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/scheduled-export", async (c) => {
  try {
    const result = await processScheduledExport();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] scheduled-export cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 20: Identity / SCIM cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/scim-sync-cleanup", async (c) => {
  try {
    const result = await processScimSyncCleanup();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] scim-sync-cleanup cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/scim-token-audit", async (c) => {
  try {
    const result = await processScimTokenAudit();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] scim-token-audit cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 22: Webhook retry cron endpoint
// ──────────────────────────────────────────────────────────────

app.post("/crons/webhook-retry", async (c) => {
  try {
    const result = await processWebhookRetryJob();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] webhook-retry cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 23: Board KPIs cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/risk-appetite-check", async (c) => {
  try {
    const result = await processRiskAppetiteCheck();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] risk-appetite-check cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/assurance-snapshot", async (c) => {
  try {
    const result = await processAssuranceSnapshot();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] assurance-snapshot cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/posture-snapshot", async (c) => {
  try {
    const result = await processPostureSnapshot();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] posture-snapshot cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 24: NIS2 + Certification Readiness cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/nis2-deadline-monitor", async (c) => {
  try {
    const result = await processNis2DeadlineMonitor();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] nis2-deadline-monitor cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/cert-readiness-snapshot", async (c) => {
  try {
    const result = await processCertReadinessSnapshot();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] cert-readiness-snapshot cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 25: FAIR Monte Carlo appetite check
// ──────────────────────────────────────────────────────────────

app.post("/crons/fair-appetite-check", async (c) => {
  try {
    const result = await processFairAppetiteCheck();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] fair-appetite-check cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 26: ISMS Intelligence cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/cve-feed-sync", async (c) => {
  try {
    const result = await processCveFeedSync();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] cve-feed-sync cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 27: CCI + Performance cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/cci-monthly-aggregation", async (c) => {
  try {
    const result = await processCCIMonthlyAggregation();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] cci-monthly-aggregation cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/query-cache-warmer", async (c) => {
  try {
    const result = await processQueryCacheWarmer();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] query-cache-warmer cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Sprint 30: Report Engine + Threat Landscape cron endpoints
// ──────────────────────────────────────────────────────────────

app.post("/crons/report-scheduler", async (c) => {
  try {
    const result = await processReportScheduler();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] report-scheduler cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

app.post("/crons/threat-feed-sync", async (c) => {
  try {
    const result = await processThreatFeedSync();
    return c.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] threat-feed-sync cron failed:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ──────────────────────────────────────────────────────────────
// Module cron endpoints — one per background process
// These run regardless of ui_status (data pipelines never stop)
// ──────────────────────────────────────────────────────────────

for (const [name, handler] of Object.entries(moduleCrons)) {
  app.post(`/crons/modules/${name}`, async (c) => {
    try {
      const result = await handler();
      return c.json({ success: true, cron: name, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[worker] module cron ${name} failed:`, message);
      return c.json({ success: false, cron: name, error: message }, 500);
    }
  });
}

// ──────────────────────────────────────────────────────────────
// Sprint 28: Automation Engine health check
// ──────────────────────────────────────────────────────────────

app.get("/automation/health", (c) => {
  const engine = getAutomationEngine();
  return c.json({
    status: engine ? "ok" : "not_initialized",
    service: "automation-engine",
    timestamp: new Date().toISOString(),
  });
});

export default { port: 3001, fetch: app.fetch };
