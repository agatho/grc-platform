// Sprint 22: Webhook retry cron — processes retrying deliveries
import { processWebhookRetries } from "../webhooks/webhook-delivery";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processWebhookRetryJob = withCronInstrumentation(
  "webhook-retry",
  async (): Promise<{ processed: number }> => processWebhookRetries(),
);
