// Sprint 22: Webhook retry cron — processes retrying deliveries.
//
// 2026-07-10 (fan-out wiring): also drains freshly enqueued 'pending'
// outbox rows first, so deployments whose scheduler only knows the
// long-standing webhook-retry endpoint deliver fan-out events without
// any infra change. The dedicated /crons/webhook-dispatch endpoint
// exists for schedulers that want a tighter dispatch interval.
import {
  processWebhookDispatch,
  processWebhookRetries,
} from "../webhooks/webhook-delivery";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processWebhookRetryJob = withCronInstrumentation(
  "webhook-retry",
  async (): Promise<{ processed: number; dispatched: number }> => {
    const { dispatched } = await processWebhookDispatch();
    const { processed } = await processWebhookRetries();
    return { processed, dispatched };
  },
);
