// SSRF defence-in-depth tests for the Sprint-22 webhook delivery path.
//
// Verifies (2026-07-10 hardening, parity with the automation-engine
// triggerWebhook path):
//   layer 1 — sync literal check via checkWebhookUrl (protocol
//             allow-list, forbidden hostnames, literal private IPs)
//             now runs before EVERY delivery, catching legacy rows
//             that predate registration-time validation (PR #200);
//   layer 2 — async DNS-rebinding check via checkResolvedHostIsPublic;
//   headers — HMAC signature + new X-Arctos-Timestamp header.

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("../helpers/db-proxy");
  return dbMockFactory();
});

// Layer-2 DNS check is mocked so tests are deterministic (no real DNS).
const { dnsCheckMock } = vi.hoisted(() => ({ dnsCheckMock: vi.fn() }));
vi.mock("@grc/shared/lib/url-safety-server", () => ({
  checkResolvedHostIsPublic: dnsCheckMock,
}));

import { resetMockDb } from "../helpers/db-proxy";
import { chainable } from "../helpers/mock-db";
import { processWebhookDelivery } from "../../src/webhooks/webhook-delivery";
import type { GrcEvent } from "@grc/events";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const savedAllowHttp = process.env.WEBHOOK_ALLOW_HTTP;
const savedAllowPrivate = process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS;

function makeWebhookRow(url: string) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    orgId: "22222222-2222-2222-2222-222222222222",
    url,
    isActive: true,
    templateType: "generic",
    secretHash: "a".repeat(64),
    headers: {},
  };
}

const event: GrcEvent = {
  orgId: "22222222-2222-2222-2222-222222222222",
  eventType: "entity.created",
  entityType: "risk",
  entityId: "33333333-3333-3333-3333-333333333333",
  payload: { after: { title: "Test risk" } },
  emittedAt: new Date("2026-07-10T00:00:00.000Z"),
};

function setupDb(url: string): { setMock: Mock } {
  const m = resetMockDb();
  m.select.mockReturnValue(chainable([makeWebhookRow(url)]));
  m.insert.mockReturnValue(
    chainable([{ id: "44444444-4444-4444-4444-444444444444" }]),
  );
  const updateChain = chainable([]);
  m.update.mockReturnValue(updateChain);
  return { setMock: updateChain.set as Mock };
}

function lastSetArg(setMock: Mock): Record<string, unknown> {
  const calls = setMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe("processWebhookDelivery — SSRF guard layers", () => {
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
    if (savedAllowHttp === undefined) delete process.env.WEBHOOK_ALLOW_HTTP;
    else process.env.WEBHOOK_ALLOW_HTTP = savedAllowHttp;
    if (savedAllowPrivate === undefined)
      delete process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS;
    else process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS = savedAllowPrivate;
    vi.unstubAllGlobals();
  });

  it("refuses a legacy plain-http URL without env opt-in (layer 1)", async () => {
    const { setMock } = setupDb("http://hooks.example.com/incoming");

    await processWebhookDelivery({ webhookId: "wh-1", event });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(dnsCheckMock).not.toHaveBeenCalled();
    const set = lastSetArg(setMock);
    expect(set.status).toBe("failed");
    expect(String(set.errorMessage)).toMatch(/http/i);
  });

  it("refuses a file:// URL (layer 1, protocol allow-list)", async () => {
    const { setMock } = setupDb("file:///etc/passwd");

    await processWebhookDelivery({ webhookId: "wh-1", event });

    expect(fetchMock).not.toHaveBeenCalled();
    const set = lastSetArg(setMock);
    expect(set.status).toBe("failed");
    expect(String(set.errorMessage)).toMatch(/only http/i);
  });

  it("refuses a literal private IP before any DNS lookup (layer 1)", async () => {
    const { setMock } = setupDb("https://169.254.169.254/latest/meta-data/");

    await processWebhookDelivery({ webhookId: "wh-1", event });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(dnsCheckMock).not.toHaveBeenCalled();
    const set = lastSetArg(setMock);
    expect(set.status).toBe("failed");
    expect(String(set.errorMessage)).toMatch(/private/i);
  });

  it("refuses an unparseable URL without throwing (layer 1)", async () => {
    const { setMock } = setupDb("not a url at all");

    await processWebhookDelivery({ webhookId: "wh-1", event });

    expect(fetchMock).not.toHaveBeenCalled();
    const set = lastSetArg(setMock);
    expect(set.status).toBe("failed");
    expect(String(set.errorMessage)).toMatch(/invalid url/i);
  });

  it("refuses when the hostname resolves to a private IP (layer 2, DNS rebinding)", async () => {
    const { setMock } = setupDb("https://rebind.example.com/hook");
    dnsCheckMock.mockResolvedValue({
      ok: false,
      reason:
        "'rebind.example.com' resolves to private IPv4 10.0.0.5; refusing.",
    });

    await processWebhookDelivery({ webhookId: "wh-1", event });

    expect(dnsCheckMock).toHaveBeenCalledWith("rebind.example.com");
    expect(fetchMock).not.toHaveBeenCalled();
    const set = lastSetArg(setMock);
    expect(set.status).toBe("failed");
    expect(String(set.errorMessage)).toMatch(/private IPv4 10\.0\.0\.5/);
  });

  it("delivers to a safe URL with HMAC signature + timestamp headers", async () => {
    const { setMock } = setupDb("https://hooks.example.com/incoming");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("ok"),
    });

    await processWebhookDelivery({ webhookId: "wh-1", event });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string> },
    ];
    expect(calledUrl).toBe("https://hooks.example.com/incoming");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Arctos-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    // ISO-8601 timestamp for consumer-side replay detection
    expect(init.headers["X-Arctos-Timestamp"]).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(init.headers["X-Arctos-Event"]).toBe("entity.created");

    const set = lastSetArg(setMock);
    expect(set.status).toBe("delivered");
    expect(set.responseStatus).toBe(200);
  });
});
