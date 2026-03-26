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
import { registerModuleCrons } from "./lib/module-aware-cron";

const app = new Hono();

// ──────────────────────────────────────────────────────────────
// Register module-aware background processes on startup
// ──────────────────────────────────────────────────────────────

const moduleCrons = registerModuleCrons();

// ──────────────────────────────────────────────────────────────
// Middleware: CRON_SECRET verification for /crons/* routes
// ──────────────────────────────────────────────────────────────

app.use("/crons/*", async (c, next) => {
  const secret = c.req.header("X-Cron-Secret");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return c.json({ error: "CRON_SECRET not configured on server" }, 500);
  }

  if (secret !== expected) {
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

export default { port: 3001, fetch: app.fetch };
