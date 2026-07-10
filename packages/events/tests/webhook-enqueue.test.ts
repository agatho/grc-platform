// Tests for the webhook fan-out enqueue handler (2026-07-10 wiring).
//
// Covers:
//   - event-type + entity-type filter matching (bus-side EventFilter)
//   - org scoping of the webhook lookup (eq(webhookRegistration.orgId, …))
//   - outbox enqueue shape (status 'pending', generic envelope payload)
//   - sensitive-field sanitization before persistence
//   - emitEvent never throws even when the DB insert fails

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock @grc/db ────────────────────────────────────────────────
const { dbMock, tables } = vi.hoisted(() => {
  const chainable = <T>(value: T) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "where", "values", "returning", "set"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    (chain as { then?: unknown }).then = (resolve: (v: T) => void) =>
      resolve(value);
    return chain;
  };
  return {
    dbMock: {
      chainable,
      select: vi.fn(() => chainable([])),
      insert: vi.fn(() => chainable([])),
      update: vi.fn(() => chainable([])),
    },
    tables: {
      webhookRegistration: {
        id: "wr.id",
        orgId: "wr.orgId",
        isActive: "wr.isActive",
      },
      webhookDeliveryLog: { id: "wdl.id" },
      eventLog: { id: "el.id" },
    },
  };
});

vi.mock("@grc/db", () => ({
  get db() {
    return dbMock;
  },
  webhookRegistration: tables.webhookRegistration,
  webhookDeliveryLog: tables.webhookDeliveryLog,
  eventLog: tables.eventLog,
}));

// Spy on drizzle's eq so we can assert the org scoping of the lookup.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => args),
    and: vi.fn((...args: unknown[]) => args),
  };
});

import { eq } from "drizzle-orm";
import { eventBus, type GrcEvent } from "../src/event-bus";
import {
  registerWebhookEnqueueHandler,
  sanitizeWebhookData,
} from "../src/webhook-enqueue";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ENTITY_ID = "33333333-3333-3333-3333-333333333333";

function makeWebhookRow(eventFilter: Record<string, unknown>) {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    orgId: ORG_A,
    isActive: true,
    eventFilter,
  };
}

function makeEvent(overrides: Partial<GrcEvent> = {}): GrcEvent {
  return {
    orgId: ORG_A,
    eventType: "entity.created",
    entityType: "risk",
    entityId: ENTITY_ID,
    userId: "44444444-4444-4444-4444-444444444444",
    payload: { after: { title: "Server room risk" } },
    emittedAt: new Date("2026-07-10T12:00:00.000Z"),
    ...overrides,
  };
}

/** Configure db.select to return webhook rows and capture inserts. */
function setupDb(webhooks: Array<Record<string, unknown>>) {
  const insertedValues: Array<Record<string, unknown>> = [];
  const insertedTables: unknown[] = [];
  dbMock.select.mockImplementation(() => dbMock.chainable(webhooks));
  dbMock.insert.mockImplementation((table: unknown) => {
    insertedTables.push(table);
    const chain = dbMock.chainable([{ id: "log-1" }]);
    (chain.values as ReturnType<typeof vi.fn>).mockImplementation(
      (v: Record<string, unknown>) => {
        insertedValues.push(v);
        return chain;
      },
    );
    return chain;
  });
  return { insertedValues, insertedTables };
}

/** Inserted rows targeting the webhook_delivery_log table only. */
function deliveryInserts(setup: ReturnType<typeof setupDb>) {
  return setup.insertedValues.filter(
    (_, i) => setup.insertedTables[i] === tables.webhookDeliveryLog,
  );
}

describe("webhook enqueue handler (fan-out)", () => {
  beforeEach(() => {
    dbMock.select.mockReset();
    dbMock.insert.mockReset();
    dbMock.select.mockImplementation(() => dbMock.chainable([]));
    dbMock.insert.mockImplementation(() => dbMock.chainable([]));
    (eq as unknown as ReturnType<typeof vi.fn>).mockClear();
    registerWebhookEnqueueHandler();
  });

  it("enqueues a pending outbox row with the generic envelope shape", async () => {
    const setup = setupDb([makeWebhookRow({})]);

    await eventBus.emitEvent(makeEvent());

    const rows = deliveryInserts(setup);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.webhookId).toBe("22222222-2222-2222-2222-222222222222");
    expect(row.status).toBe("pending");
    expect(row.retryCount).toBe(0);
    expect(row.eventType).toBe("entity.created");
    expect(row.entityType).toBe("risk");
    expect(row.entityId).toBe(ENTITY_ID);

    // Envelope shape matches formatGenericPayload (what the worker's
    // dispatch/retry reconstruction expects).
    const envelope = row.payload as Record<string, unknown>;
    expect(envelope.event).toBe("entity.created");
    expect(envelope.entityType).toBe("risk");
    expect(envelope.entityId).toBe(ENTITY_ID);
    expect(envelope.orgId).toBe(ORG_A);
    expect(envelope.timestamp).toBe("2026-07-10T12:00:00.000Z");
    expect(
      (envelope.payload as { after: { title: string } }).after.title,
    ).toBe("Server room risk");
  });

  it("scopes the webhook lookup to the emitting org and active hooks", async () => {
    setupDb([makeWebhookRow({})]);

    await eventBus.emitEvent(makeEvent());

    const eqCalls = (eq as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls).toContainEqual([tables.webhookRegistration.orgId, ORG_A]);
    expect(eqCalls).toContainEqual([tables.webhookRegistration.isActive, true]);
  });

  it("skips webhooks whose event filter does not match the event type", async () => {
    const setup = setupDb([
      makeWebhookRow({ events: ["entity.deleted"] }),
    ]);

    await eventBus.emitEvent(makeEvent({ eventType: "entity.created" }));

    expect(deliveryInserts(setup)).toHaveLength(0);
  });

  it("skips webhooks whose entityTypes filter does not match", async () => {
    const setup = setupDb([
      makeWebhookRow({ entityTypes: ["control", "finding"] }),
    ]);

    await eventBus.emitEvent(makeEvent({ entityType: "risk" }));

    expect(deliveryInserts(setup)).toHaveLength(0);
  });

  it("enqueues when both entityTypes and events filters match", async () => {
    const setup = setupDb([
      makeWebhookRow({
        entityTypes: ["risk"],
        events: ["entity.created", "entity.status_changed"],
      }),
    ]);

    await eventBus.emitEvent(makeEvent());

    expect(deliveryInserts(setup)).toHaveLength(1);
  });

  it("strips sensitive keys from the persisted payload", async () => {
    const setup = setupDb([makeWebhookRow({})]);

    await eventBus.emitEvent(
      makeEvent({
        payload: {
          after: {
            title: "Doc",
            fileSha256: "deadbeef",
            apiKey: "sk-123",
            secretHash: "abc",
            nested: { accessToken: "t", ok: "yes" },
          },
        },
      }),
    );

    const rows = deliveryInserts(setup);
    expect(rows).toHaveLength(1);
    const after = (
      rows[0].payload as { payload: { after: Record<string, unknown> } }
    ).payload.after;
    expect(after.title).toBe("Doc");
    expect(after).not.toHaveProperty("fileSha256");
    expect(after).not.toHaveProperty("apiKey");
    expect(after).not.toHaveProperty("secretHash");
    expect((after.nested as Record<string, unknown>).ok).toBe("yes");
    expect(after.nested).not.toHaveProperty("accessToken");
  });

  it("does not throw when the outbox insert fails", async () => {
    dbMock.select.mockImplementation(() =>
      dbMock.chainable([makeWebhookRow({})]),
    );
    dbMock.insert.mockImplementation(() => {
      throw new Error("db down");
    });

    await expect(eventBus.emitEvent(makeEvent())).resolves.toBeUndefined();
  });
});

describe("sanitizeWebhookData", () => {
  it("passes primitives and arrays through", () => {
    expect(sanitizeWebhookData("x")).toBe("x");
    expect(sanitizeWebhookData(3)).toBe(3);
    expect(sanitizeWebhookData(null)).toBe(null);
    expect(sanitizeWebhookData([{ token: "a", id: 1 }])).toEqual([{ id: 1 }]);
  });

  it("preserves Date instances", () => {
    const d = new Date("2026-07-10T00:00:00Z");
    expect(sanitizeWebhookData({ createdAt: d })).toEqual({ createdAt: d });
  });
});
