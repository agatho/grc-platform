// Sprint 22: GRC Event Bus — central nervous system for entity mutations
// Every entity CRUD emits an event here. Listeners: event_log, webhook delivery, future automation.

import { EventEmitter } from "events";
import { db, eventLog, webhookRegistration } from "@grc/db";
import { eq, and } from "drizzle-orm";
import type { GrcEventType, EventFilter } from "@grc/shared";

export interface GrcEvent {
  orgId: string;
  eventType: GrcEventType;
  entityType: string;
  entityId: string;
  userId?: string;
  payload: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    changedFields?: string[];
  };
  emittedAt: Date;
}

type EventHandler = (event: GrcEvent) => void | Promise<void>;

class GrcEventBus extends EventEmitter {
  private webhookHandler?: (
    webhookId: string,
    event: GrcEvent,
  ) => Promise<void>;

  /**
   * Register a handler for webhook delivery queue integration.
   * Called by worker setup to inject BullMQ add logic.
   */
  registerWebhookHandler(
    handler: (webhookId: string, event: GrcEvent) => Promise<void>,
  ) {
    this.webhookHandler = handler;
  }

  /**
   * Emit a GRC event: logs to event_log, emits internally, queues webhooks.
   */
  async emitEvent(event: GrcEvent): Promise<void> {
    // 1. Persist to event_log table
    try {
      await db.insert(eventLog).values({
        orgId: event.orgId,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        userId: event.userId,
        payload: event.payload,
        emittedAt: event.emittedAt,
      });
    } catch (err) {
      // Non-blocking: event log write failure should not break mutations
      console.error("[EventBus] Failed to persist event_log:", err);
    }

    // 2. Emit on internal EventEmitter (for in-process listeners)
    this.emit(event.eventType, event);
    this.emit(`${event.entityType}.${event.eventType}`, event);

    // 3. Queue webhook deliveries
    await this.queueWebhookDeliveries(event);
  }

  /**
   * Find matching webhooks and queue deliveries.
   */
  private async queueWebhookDeliveries(event: GrcEvent): Promise<void> {
    if (!this.webhookHandler) return;

    try {
      const webhooks = await db
        .select()
        .from(webhookRegistration)
        .where(
          and(
            eq(webhookRegistration.orgId, event.orgId),
            eq(webhookRegistration.isActive, true),
          ),
        );

      for (const webhook of webhooks) {
        const filter = webhook.eventFilter as EventFilter;
        if (this.matchesFilter(event, filter)) {
          try {
            await this.webhookHandler(webhook.id, event);
          } catch (err) {
            console.error(
              `[EventBus] Failed to queue webhook ${webhook.id}:`,
              err,
            );
          }
        }
      }
    } catch (err) {
      console.error("[EventBus] Failed to query webhooks:", err);
    }
  }

  /**
   * Check if an event matches a webhook's filter configuration.
   */
  private matchesFilter(event: GrcEvent, filter: EventFilter): boolean {
    // If filter has entityTypes, event's entityType must be in the list
    if (
      filter.entityTypes &&
      filter.entityTypes.length > 0 &&
      !filter.entityTypes.includes(event.entityType)
    ) {
      return false;
    }
    // If filter has events, event's eventType must be in the list
    if (
      filter.events &&
      filter.events.length > 0 &&
      !filter.events.includes(event.eventType)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Subscribe to a specific event type or entity.event pattern.
   */
  onEvent(pattern: string, handler: EventHandler): void {
    this.on(pattern, handler as (...args: unknown[]) => void);
  }

  /**
   * Unsubscribe from events.
   */
  offEvent(pattern: string, handler: EventHandler): void {
    this.off(pattern, handler as (...args: unknown[]) => void);
  }
}

/** Singleton event bus instance */
export const eventBus = new GrcEventBus();
