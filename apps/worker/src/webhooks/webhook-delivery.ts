// Sprint 22: Webhook delivery worker
// Processes webhook deliveries with retry logic (3 attempts, exponential backoff)
// HMAC-SHA256 signing via X-Arctos-Signature header

import { db, webhookRegistration, webhookDeliveryLog } from "@grc/db";
import { formatWebhookPayload, signPayload } from "@grc/events";
import { asc, eq } from "drizzle-orm";
import type { GrcEvent } from "@grc/events";
import { checkWebhookUrl } from "@grc/shared";
import { checkResolvedHostIsPublic } from "@grc/shared/lib/url-safety-server";

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
    // Webhook deleted or deactivated. If this delivery came from the
    // outbox (fan-out enqueue / retry), close the row so the dispatch
    // cron does not re-scan it forever.
    if (job.deliveryLogId) {
      await db
        .update(webhookDeliveryLog)
        .set({
          status: "failed",
          errorMessage: "Webhook deleted or deactivated",
          deliveredAt: new Date(),
          nextRetryAt: null,
        })
        .where(eq(webhookDeliveryLog.id, job.deliveryLogId));
    }
    return;
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

  // #SEC-HIGH-SSRF (layer 1, sync): literal URL check — protocol
  // allow-list (http/https, https-only unless WEBHOOK_ALLOW_HTTP=1),
  // forbidden hostnames (localhost, metadata aliases, .local/.internal)
  // and literal private/reserved IPs. Registration-time Zod validation
  // runs the same check, but legacy rows created before the SSRF guard
  // (PR #200) could still hold http:// or private-host URLs. Also
  // handles unparseable URLs. Parity with the automation-engine
  // triggerWebhook path in crons/automation-engine-init.ts.
  const literalCheck = checkWebhookUrl(webhook.url);
  if (!literalCheck.ok) {
    await db
      .update(webhookDeliveryLog)
      .set({
        status: "failed",
        errorMessage: `Refused delivery: ${literalCheck.reason}`,
        deliveredAt: new Date(),
      })
      .where(eq(webhookDeliveryLog.id, deliveryLogId!));
    return;
  }

  // #SEC-HIGH-SSRF (layer 2, async): re-resolve and check the URL's
  // host before EVERY delivery, not just at webhook registration time.
  // DNS rebinding attacks pivot in the time between registration and
  // delivery: a hostname that resolved to a public IP at registration
  // can later resolve to 127.0.0.1 / 169.254.169.254 / 10.0.0.0/8 by
  // the time the worker fires the cron-scheduled delivery. Refusing the
  // delivery is preferable to leaking the request to a private host.
  const safetyCheck = await checkResolvedHostIsPublic(
    literalCheck.url.hostname,
  );
  if (!safetyCheck.ok) {
    await db
      .update(webhookDeliveryLog)
      .set({
        status: "failed",
        errorMessage: `Refused delivery: ${safetyCheck.reason}`,
        deliveredAt: new Date(),
      })
      .where(eq(webhookDeliveryLog.id, deliveryLogId!));
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        ...formatted.headers,
        ...((webhook.headers as Record<string, string>) ?? {}),
        "X-Arctos-Signature": signature,
        "X-Arctos-Timestamp": new Date().toISOString(),
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
    await handleDeliveryFailure(deliveryLogId, retryCount, null, null, message);
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
      Date.now() +
        (RETRY_DELAYS[retryCount] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]),
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
 * Process queued (pending) outbox deliveries — called by cron job.
 *
 * Fan-out wiring (2026-07-10): API routes emit entity events via the
 * @grc/events bus, whose enqueue handler inserts matching webhook
 * deliveries as 'pending' rows into webhook_delivery_log. This function
 * drains that outbox through the hardened delivery path (SSRF guards,
 * HMAC signature, timeout, retry scheduling).
 *
 * Rows are reconstructed the same way processWebhookRetries does: the
 * stored payload is the generic envelope { event, entityType, entityId,
 * orgId, userId, payload, timestamp }. At-least-once semantics: a crash
 * mid-delivery leaves the row 'pending' and it is retried on the next
 * run — consumers must deduplicate on their side (standard webhook
 * contract).
 */
export async function processWebhookDispatch(): Promise<{
  dispatched: number;
}> {
  const pending = await db
    .select()
    .from(webhookDeliveryLog)
    .where(eq(webhookDeliveryLog.status, "pending"))
    .orderBy(asc(webhookDeliveryLog.createdAt))
    .limit(50);

  let dispatched = 0;

  for (const delivery of pending) {
    const payload = delivery.payload as Record<string, unknown>;
    await processWebhookDelivery({
      webhookId: delivery.webhookId,
      event: {
        orgId: (payload.orgId as string) ?? "",
        eventType: delivery.eventType as GrcEvent["eventType"],
        entityType: delivery.entityType,
        entityId: delivery.entityId,
        userId: (payload.userId as string | undefined) ?? undefined,
        payload: (payload.payload as GrcEvent["payload"]) ?? {},
        emittedAt: new Date(delivery.createdAt),
      },
      deliveryLogId: delivery.id,
      retryCount: delivery.retryCount,
    });
    dispatched++;
  }

  return { dispatched };
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
