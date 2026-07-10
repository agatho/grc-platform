// Webhook fan-out enqueue handler (2026-07-10).
//
// Bridges the in-process event bus to the worker's hardened delivery
// pipeline. The bus (event-bus.ts) already matches active webhooks of the
// emitting org against their event filter; this handler ONLY persists an
// outbox row in webhook_delivery_log with status 'pending'. The actual
// HTTP delivery (HMAC signing, SSRF guards, timeout, retries) is done by
// the worker cron (apps/worker/src/webhooks/webhook-delivery.ts →
// processWebhookDispatch / processWebhookRetries). API routes therefore
// never fetch outbound URLs and never block on webhook consumers.
//
// Crash safety: if the process dies after the entity mutation but before
// the insert, the event is lost (fire-and-forget, documented trade-off —
// same as event_log). Once the row exists, delivery is at-least-once:
// rows stay 'pending' until the worker marks them delivered/failed.

import { db, webhookDeliveryLog } from "@grc/db";
import { eventBus, type GrcEvent } from "./event-bus";
import { formatGenericPayload } from "./webhook-formatter";

// Keys that must never leave the platform via webhook payloads.
// Matched case-insensitively against object keys at any nesting depth.
const SENSITIVE_KEY_PATTERN =
  /secret|token|password|credential|api[_-]?key|private[_-]?key|salt|hash|sha(1|256|512)/i;

/**
 * Recursively strip sensitive keys (tokens, secrets, hashes, …) from a
 * payload object before it is persisted for external delivery.
 * Arrays are traversed; primitives pass through unchanged.
 */
export function sanitizeWebhookData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeWebhookData(item));
  }
  if (value !== null && typeof value === "object") {
    if (value instanceof Date) return value;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) continue;
      out[key] = sanitizeWebhookData(val);
    }
    return out;
  }
  return value;
}

/**
 * Enqueue one webhook delivery as a pending outbox row.
 * Payload is stored in the generic envelope shape (same as the worker
 * writes for direct deliveries) so processWebhookRetries /
 * processWebhookDispatch can reconstruct the event from the row.
 */
export async function enqueueWebhookDelivery(
  webhookId: string,
  event: GrcEvent,
): Promise<void> {
  const sanitized: GrcEvent = {
    ...event,
    payload: sanitizeWebhookData(event.payload) as GrcEvent["payload"],
  };
  const envelope = JSON.parse(formatGenericPayload(sanitized).body) as Record<
    string,
    unknown
  >;

  await db.insert(webhookDeliveryLog).values({
    webhookId,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    payload: envelope,
    status: "pending",
    retryCount: 0,
  });
}

let registered = false;

/**
 * Register the enqueue handler on the event bus (idempotent).
 * Called lazily by the emitEntity* helpers on first emission and
 * explicitly by the worker bootstrap — whichever process emits entity
 * events gets the webhook fan-out wired to the same bus singleton.
 */
export function registerWebhookEnqueueHandler(): void {
  if (registered) return;
  registered = true;
  eventBus.registerWebhookHandler(enqueueWebhookDelivery);
}

/** Test-only: allow re-registration after a bus reset. */
export function __resetWebhookEnqueueRegistration(): void {
  registered = false;
}
