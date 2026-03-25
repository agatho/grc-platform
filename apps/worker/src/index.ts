import { Hono } from "hono";

const app = new Hono();

// Health check
app.get("/health", (c) =>
  c.json({ status: "ok", service: "worker", timestamp: new Date().toISOString() }),
);

// Auth.js event processing (placeholder for future implementation)
// Will handle: user.created, user.updated, user.deleted, session.created
// via Auth.js event callbacks forwarded from the web app
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

export default { port: 3001, fetch: app.fetch };
