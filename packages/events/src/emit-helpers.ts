// Sprint 22: Helper functions for emitting events from API routes
// Usage: import { emitEntityCreated } from "@grc/events";

import { eventBus } from "./event-bus";
import type { GrcEventType } from "@grc/shared";

interface EmitParams {
  orgId: string;
  entityType: string;
  entityId: string;
  userId?: string;
}

/**
 * Emit entity.created event after a successful INSERT.
 */
export function emitEntityCreated(
  params: EmitParams & { data: Record<string, unknown> },
): void {
  // Fire-and-forget: do not await to avoid blocking the response
  eventBus
    .emitEvent({
      orgId: params.orgId,
      eventType: "entity.created",
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      payload: { after: params.data },
      emittedAt: new Date(),
    })
    .catch((err) =>
      console.error("[emitEntityCreated] Error:", err),
    );
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
  const changedFields = Object.keys(params.after).filter(
    (key) =>
      JSON.stringify(params.before[key]) !==
      JSON.stringify(params.after[key]),
  );

  eventBus
    .emitEvent({
      orgId: params.orgId,
      eventType: "entity.updated",
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      payload: {
        before: params.before,
        after: params.after,
        changedFields,
      },
      emittedAt: new Date(),
    })
    .catch((err) =>
      console.error("[emitEntityUpdated] Error:", err),
    );
}

/**
 * Emit entity.deleted event after a successful DELETE.
 */
export function emitEntityDeleted(
  params: EmitParams & { data: Record<string, unknown> },
): void {
  eventBus
    .emitEvent({
      orgId: params.orgId,
      eventType: "entity.deleted",
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      payload: { before: params.data },
      emittedAt: new Date(),
    })
    .catch((err) =>
      console.error("[emitEntityDeleted] Error:", err),
    );
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
  eventBus
    .emitEvent({
      orgId: params.orgId,
      eventType: "entity.status_changed",
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      payload: {
        before: { status: params.oldStatus },
        after: { status: params.newStatus, ...params.data },
        changedFields: ["status"],
      },
      emittedAt: new Date(),
    })
    .catch((err) =>
      console.error("[emitEntityStatusChanged] Error:", err),
    );
}
