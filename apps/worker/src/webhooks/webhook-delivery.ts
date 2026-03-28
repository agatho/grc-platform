// Sprint 22: Webhook delivery worker
// Processes webhook deliveries with retry logic (3 attempts, exponential backoff)
// HMAC-SHA256 signing via X-Arctos-Signature header

import { db, webhookRegistration, webhookDeliveryLog } from "@grc/db";
import { formatWebhookPayload, signPayload } from "@grc/events";
import { eq } from "drizzle-orm";
import type { GrcEvent } from "@grc/events";

// Retry backoff intervals in milliseconds: 60s, 300s, 1800s
const RETRY_DELAYS = [60_000, 300_000, 1_800_000];
const MAX_RETRIES = 3;
const DELIVERY_TIMEOUT = 10_000; // 10s

interface WebhookDeliveryJob {
  webhookId: string;
  event: GrcEvent;
  deliveryLogId?: string;
  retryCount?: number;
}

/**
 * Process a single webhook delivery.
 * Called by the worker cron or BullMQ job processor.
 */
export async function processWebhookDelivery(
  job: WebhookDeliveryJob,
): Promise<void> {
  const { webhookId, event, retryCount = 0 } = job;

  // Fetch webhook config
  const [webhook] = await db
    .select()
    .from(webhookRegistration)
    .where(eq(webhookRegistration.id, webhookId));

  if (!webhook || !webhook.isActive) {
    return; // Webhook deleted or deactivated, skip
  }

  // Format payload based on template type
  const formatted = formatWebhookPayload(webhook.templateType, {
    ...event,
    emittedAt: new Date(event.emittedAt),
  });

  // Sign the payload
  const signature = signPayload(formatted.body, webhook.secretHash);

  // Create or update delivery log entry
  let deliveryLogId = job.deliveryLogId;
  if (!deliveryLogId) {
    const [log] = await db
      .insert(webhookDeliveryLog)
      .values({
        webhookId,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: JSON.parse(formatted.body),
        status: "pending",
        retryCount: 0,
      })
      .returning({ id: webhookDeliveryLog.id });
    deliveryLogId = log.id;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        ...formatted.headers,
        ...(webhook.headers as Record<string, string> ?? {}),
        "X-Arctos-Signature": signature,
        "X-Arctos-Event": event.eventType,
        "X-Arctos-Entity-Type": event.entityType,
        "User-Agent": "ARCTOS-Webhook/1.0",
      },
      body: formatted.body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      // Success
      await db
        .update(webhookDeliveryLog)
        .set({
          status: "delivered",
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 5000),
          deliveredAt: new Date(),
          retryCount,
        })
        .where(eq(webhookDeliveryLog.id, deliveryLogId));
    } else {
      // HTTP error — schedule retry or mark as failed
      await handleDeliveryFailure(
        deliveryLogId,
        retryCount,
        response.status,
        responseBody.slice(0, 5000),
        `HTTP ${response.status}`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await handleDeliveryFailure(
      deliveryLogId,
      retryCount,
      null,
      null,
      message,
    );
  }
}

async function handleDeliveryFailure(
  deliveryLogId: string,
  retryCount: number,
  responseStatus: number | null,
  responseBody: string | null,
  errorMessage: string,
): Promise<void> {
  if (retryCount < MAX_RETRIES) {
    // Schedule retry with exponential backoff
    const nextRetryAt = new Date(
      Date.now() + (RETRY_DELAYS[retryCount] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]),
    );
    await db
      .update(webhookDeliveryLog)
      .set({
        status: "retrying",
        responseStatus,
        responseBody,
        errorMessage,
        retryCount: retryCount + 1,
        nextRetryAt,
      })
      .where(eq(webhookDeliveryLog.id, deliveryLogId));
  } else {
    // Max retries exceeded — mark as failed
    await db
      .update(webhookDeliveryLog)
      .set({
        status: "failed",
        responseStatus,
        responseBody,
        errorMessage: `${errorMessage} (max retries exceeded)`,
        retryCount,
        nextRetryAt: null,
      })
      .where(eq(webhookDeliveryLog.id, deliveryLogId));
  }
}

/**
 * Process pending retries — called by cron job.
 * Finds deliveries in 'retrying' status where next_retry_at has passed.
 */
export async function processWebhookRetries(): Promise<{
  processed: number;
}> {
  const pendingRetries = await db
    .select()
    .from(webhookDeliveryLog)
    .where(eq(webhookDeliveryLog.status, "retrying"))
    .limit(50);

  let processed = 0;
  const now = new Date();

  for (const delivery of pendingRetries) {
    if (delivery.nextRetryAt && new Date(delivery.nextRetryAt) <= now) {
      const payload = delivery.payload as Record<string, unknown>;
      await processWebhookDelivery({
        webhookId: delivery.webhookId,
        event: {
          orgId: (payload.orgId as string) ?? "",
          eventType: delivery.eventType as GrcEvent["eventType"],
          entityType: delivery.entityType,
          entityId: delivery.entityId,
          payload: (payload.payload as GrcEvent["payload"]) ?? {},
          emittedAt: new Date(delivery.createdAt),
        },
        deliveryLogId: delivery.id,
        retryCount: delivery.retryCount,
      });
      processed++;
    }
  }

  return { processed };
}
