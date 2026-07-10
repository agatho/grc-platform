// Sprint 22: Helper functions for emitting events from API routes
// Usage: import { emitEntityCreated } from "@grc/events";
//
// 2026-07-10 (webhook fan-out wiring): every helper now
//   1. lazily registers the webhook enqueue handler on the bus so that
//      matching webhooks are queued in webhook_delivery_log (outbox,
//      status 'pending') for the worker to deliver, and
//   2. is guaranteed non-throwing — emission is best-effort and must
//      NEVER fail the surrounding request (sync body wrapped in
//      try/catch, async path already .catch()ed).

import { eventBus } from "./event-bus";
import { registerWebhookEnqueueHandler } from "./webhook-enqueue";
import type { GrcEventType } from "@grc/shared";

interface EmitParams {
  orgId: string;
  entityType: string;
  entityId: string;
  userId?: string;
}

function safeEmit(
  eventType: GrcEventType,
  params: EmitParams,
  payload: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    changedFields?: string[];
  },
): void {
  try {
    // Bus bootstrap: idempotent, wires webhook fan-out in whichever
    // process (web / worker) performs the emission.
    registerWebhookEnqueueHandler();

    // Fire-and-forget: do not await to avoid blocking the response
    eventBus
      .emitEvent({
        orgId: params.orgId,
        eventType,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        payload,
        emittedAt: new Date(),
      })
      .catch((err) => console.error(`[safeEmit] ${eventType} error:`, err));
  } catch (err) {
    // Absolute guard: an entity mutation must never fail because event
    // emission failed (e.g. non-serialisable payload).
    console.error(`[safeEmit] ${eventType} sync error:`, err);
  }
}

/**
 * Emit entity.created event after a successful INSERT.
 */
export function emitEntityCreated(
  params: EmitParams & { data: Record<string, unknown> },
): void {
  safeEmit("entity.created", params, { after: params.data });
}

/**
 * Emit entity.updated event after a successful UPDATE.
 * Include before/after + changed fields for webhook consumers.
 */
export function emitEntityUpdated(
  params: EmitParams & {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
): void {
  try {
    const changedFields = Object.keys(params.after).filter(
      (key) =>
        JSON.stringify(params.before[key]) !==
        JSON.stringify(params.after[key]),
    );

    safeEmit("entity.updated", params, {
      before: params.before,
      after: params.after,
      changedFields,
    });
  } catch (err) {
    console.error("[emitEntityUpdated] Error:", err);
  }
}

/**
 * Emit entity.deleted event after a successful DELETE.
 */
export function emitEntityDeleted(
  params: EmitParams & { data: Record<string, unknown> },
): void {
  safeEmit("entity.deleted", params, { before: params.data });
}

/**
 * Emit entity.status_changed event after a status field changes.
 */
export function emitEntityStatusChanged(
  params: EmitParams & {
    oldStatus: string;
    newStatus: string;
    data?: Record<string, unknown>;
  },
): void {
  safeEmit("entity.status_changed", params, {
    before: { status: params.oldStatus },
    after: { status: params.newStatus, ...params.data },
    changedFields: ["status"],
  });
}
