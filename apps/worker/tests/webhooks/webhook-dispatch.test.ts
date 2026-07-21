// Tests for processWebhookDispatch — the outbox drain that completes the
// webhook fan-out wiring (2026-07-10). Pending rows enqueued by the
// @grc/events bus are delivered through the hardened path and closed.

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("../helpers/db-proxy");
  return dbMockFactory();
});

// Layer-2 DNS check mocked for determinism (no real DNS).
const { dnsCheckMock } = vi.hoisted(() => ({ dnsCheckMock: vi.fn() }));
vi.mock("@grc/shared/lib/url-safety-server", () => ({
  checkResolvedHostIsPublic: dnsCheckMock,
}));

import { resetMockDb } from "../helpers/db-proxy";
import { chainable } from "../helpers/mock-db";
import { processWebhookDispatch } from "../../src/webhooks/webhook-delivery";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const WEBHOOK_ID = "11111111-1111-1111-1111-111111111111";
const ORG_ID = "22222222-2222-2222-2222-222222222222";
const ENTITY_ID = "33333333-3333-3333-3333-333333333333";
const LOG_ID = "44444444-4444-4444-4444-444444444444";

function makePendingRow() {
  return {
    id: LOG_ID,
    webhookId: WEBHOOK_ID,
    eventType: "entity.created",
    entityType: "risk",
    entityId: ENTITY_ID,
    // Generic envelope shape as persisted by the enqueue handler.
    payload: {
      event: "entity.created",
      entityType: "risk",
      entityId: ENTITY_ID,
      orgId: ORG_ID,
      userId: "55555555-5555-5555-5555-555555555555",
      payload: { after: { title: "Queued risk" } },
      timestamp: "2026-07-10T12:00:00.000Z",
    },
    status: "pending",
    retryCount: 0,
    createdAt: new Date("2026-07-10T12:00:00.000Z"),
    nextRetryAt: null,
  };
}

function makeWebhookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WEBHOOK_ID,
    orgId: ORG_ID,
    url: "https://hooks.example.com/incoming",
    isActive: true,
    templateType: "generic",
    secretHash: "a".repeat(64),
    headers: {},
    ...overrides,
  };
}

describe("processWebhookDispatch", () => {
  beforeEach(() => {
    delete process.env.WEBHOOK_ALLOW_HTTP;
    delete process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS;
    fetchMock.mockReset();
    dnsCheckMock.mockReset();
    dnsCheckMock.mockResolvedValue({
      ok: true,
      url: new URL("https://hooks.example.com"),
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("returns dispatched=0 when the outbox is empty", async () => {
    const m = resetMockDb();
    m.select.mockReturnValue(chainable([]));

    const result = await processWebhookDispatch();

    expect(result.dispatched).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("delivers a pending row via the hardened path and marks it delivered", async () => {
    const m = resetMockDb();
    // 1st select: pending outbox rows; 2nd select: webhook config.
    m.select
      .mockReturnValueOnce(chainable([makePendingRow()]))
      .mockReturnValueOnce(chainable([makeWebhookRow()]));
    const updateChain = chainable([]);
    m.update.mockReturnValue(updateChain);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("ok"),
    });

    const result = await processWebhookDispatch();

    expect(result.dispatched).toBe(1);
    // Delivered through the hardened path with signature headers.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(init.headers["X-Arctos-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(init.headers["X-Arctos-Event"]).toBe("entity.created");
    // Envelope reconstructed from the outbox row.
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.orgId).toBe(ORG_ID);
    expect(body.entityId).toBe(ENTITY_ID);

    // The existing row is updated (no second insert) to delivered.
    expect(m.insert).not.toHaveBeenCalled();
    const setCalls = (updateChain.set as Mock).mock.calls;
    expect(setCalls.length).toBeGreaterThan(0);
    const lastSet = setCalls[setCalls.length - 1][0] as Record<string, unknown>;
    expect(lastSet.status).toBe("delivered");
    expect(lastSet.responseStatus).toBe(200);
  });

  it("closes the outbox row as failed when the webhook was deactivated", async () => {
    const m = resetMockDb();
    m.select
      .mockReturnValueOnce(chainable([makePendingRow()]))
      .mockReturnValueOnce(chainable([makeWebhookRow({ isActive: false })]));
    const updateChain = chainable([]);
    m.update.mockReturnValue(updateChain);

    const result = await processWebhookDispatch();

    expect(result.dispatched).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    const setCalls = (updateChain.set as Mock).mock.calls;
    expect(setCalls.length).toBeGreaterThan(0);
    const lastSet = setCalls[setCalls.length - 1][0] as Record<string, unknown>;
    expect(lastSet.status).toBe("failed");
    expect(String(lastSet.errorMessage)).toMatch(/deactivated/i);
  });
});
