import { Hono } from "hono";
import { processOverdueTasks } from "./crons/overdue-tasks";
import { processScheduledNotifications } from "./crons/scheduled-notifications";
import { processNotificationDigest } from "./crons/notification-digest";
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
