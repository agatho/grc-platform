// Entity lifecycle event emission for API routes (webhook fan-out).
//
// 2026-07-10: wires the previously dormant fan-out. Mutation routes call
// these helpers after a successful commit; the @grc/events bus persists
// the event to event_log and enqueues matching org webhooks as 'pending'
// rows in webhook_delivery_log (outbox). The worker cron
// (webhook-dispatch / webhook-retry) performs the actual hardened HTTP
// delivery — routes never fetch outbound URLs.
//
// Guarantees: emission is strictly best-effort and can NEVER fail the
// request. The @grc/events module is loaded lazily inside a try/catch so
// even a module-load failure (or a partially mocked @grc/db in tests)
// only logs an error. Same signatures as @grc/events emitEntity*.

type EventsModule = typeof import("@grc/events");

async function withEventsModule(
  apply: (mod: EventsModule) => void,
): Promise<void> {
  try {
    const mod: EventsModule = await import("@grc/events");
    // Bus bootstrap (idempotent): ensure the webhook enqueue handler is
    // registered on this process's bus singleton before emitting.
    if (typeof mod.registerWebhookEnqueueHandler === "function") {
      mod.registerWebhookEnqueueHandler();
    }
    apply(mod);
  } catch (err) {
    console.error("[entity-events] event emission skipped:", err);
  }
}

export interface EntityEventParams {
  orgId: string;
  entityType: string;
  entityId: string;
  userId?: string;
}

/** Emit entity.created after a successful INSERT (fire-and-forget). */
export function emitEntityCreated(
  params: EntityEventParams & { data: Record<string, unknown> },
): void {
  void withEventsModule((mod) => mod.emitEntityCreated(params));
}

/** Emit entity.updated after a successful UPDATE (fire-and-forget). */
export function emitEntityUpdated(
  params: EntityEventParams & {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
): void {
  void withEventsModule((mod) => mod.emitEntityUpdated(params));
}

/** Emit entity.deleted after a successful DELETE (fire-and-forget). */
export function emitEntityDeleted(
  params: EntityEventParams & { data: Record<string, unknown> },
): void {
  void withEventsModule((mod) => mod.emitEntityDeleted(params));
}

/** Emit entity.status_changed after a status transition (fire-and-forget). */
export function emitEntityStatusChanged(
  params: EntityEventParams & {
    oldStatus: string;
    newStatus: string;
    data?: Record<string, unknown>;
  },
): void {
  void withEventsModule((mod) => mod.emitEntityStatusChanged(params));
}
