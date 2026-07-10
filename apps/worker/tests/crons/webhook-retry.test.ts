// Test for the webhook-retry cron job (Sprint 22).
// 2026-07-10 (fan-out wiring): the job now also drains 'pending' outbox
// rows via processWebhookDispatch before processing retries.

import { describe, it, expect, beforeEach, vi } from "vitest";

const processWebhookRetriesMock = vi.fn().mockResolvedValue({ processed: 0 });
const processWebhookDispatchMock = vi
  .fn()
  .mockResolvedValue({ dispatched: 0 });

vi.mock("../../src/webhooks/webhook-delivery", () => ({
  get processWebhookRetries() {
    return processWebhookRetriesMock;
  },
  get processWebhookDispatch() {
    return processWebhookDispatchMock;
  },
}));

describe("processWebhookRetryJob", () => {
  beforeEach(() => {
    processWebhookRetriesMock.mockReset();
    processWebhookRetriesMock.mockResolvedValue({ processed: 0 });
    processWebhookDispatchMock.mockReset();
    processWebhookDispatchMock.mockResolvedValue({ dispatched: 0 });
  });

  it("delegates to processWebhookDispatch and processWebhookRetries", async () => {
    const { processWebhookRetryJob } =
      await import("../../src/crons/webhook-retry");
    await processWebhookRetryJob();
    expect(processWebhookDispatchMock).toHaveBeenCalledOnce();
    expect(processWebhookRetriesMock).toHaveBeenCalledOnce();
  });

  it("returns the number of processed retries and dispatched deliveries", async () => {
    processWebhookRetriesMock.mockResolvedValue({ processed: 7 });
    processWebhookDispatchMock.mockResolvedValue({ dispatched: 3 });
    const { processWebhookRetryJob } =
      await import("../../src/crons/webhook-retry");
    const r = await processWebhookRetryJob();
    expect(r.processed).toBe(7);
    expect(r.dispatched).toBe(3);
  });
});
