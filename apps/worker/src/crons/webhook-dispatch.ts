// Webhook dispatch cron — drains the webhook_delivery_log outbox.
//
// Fan-out wiring (2026-07-10): API routes enqueue matching webhook
// deliveries as 'pending' rows via the @grc/events bus; this cron sends
// them through the hardened delivery path (SSRF guards, HMAC-SHA256
// signature, 10s timeout, retry scheduling). Retries of failed attempts
// are handled by the webhook-retry cron.
import { processWebhookDispatch } from "../webhooks/webhook-delivery";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processWebhookDispatchJob = withCronInstrumentation(
  "webhook-dispatch",
  async (): Promise<{ dispatched: number }> => processWebhookDispatch(),
);
