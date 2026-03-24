import { Hono } from "hono";
import { clerkWebhook } from "./webhooks/clerk";

const app = new Hono();

// Clerk Webhook (S1-05, S1-15)
app.post("/webhooks/clerk", clerkWebhook);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

export default { port: 3001, fetch: app.fetch };
