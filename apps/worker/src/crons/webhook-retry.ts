// Sprint 22: Webhook retry cron — processes retrying deliveries
import { processWebhookRetries } from "../webhooks/webhook-delivery";

export async function processWebhookRetryJob(): Promise<{
  processed: number;
}> {
  return processWebhookRetries();
}
