// Test for the webhook-retry cron job (Sprint 22).

import { describe, it, expect, beforeEach, vi } from "vitest";

const processWebhookRetriesMock = vi.fn().mockResolvedValue({ processed: 0 });

vi.mock("../../src/webhooks/webhook-delivery", () => ({
  get processWebhookRetries() {
    return processWebhookRetriesMock;
  },
}));

describe("processWebhookRetryJob", () => {
  beforeEach(() => {
    processWebhookRetriesMock.mockReset();
    processWebhookRetriesMock.mockResolvedValue({ processed: 0 });
  });

  it("delegates to processWebhookRetries", async () => {
    const { processWebhookRetryJob } = await import(
      "../../src/crons/webhook-retry"
    );
    await processWebhookRetryJob();
    expect(processWebhookRetriesMock).toHaveBeenCalledOnce();
  });

  it("returns the number of processed retries", async () => {
    processWebhookRetriesMock.mockResolvedValue({ processed: 7 });
    const { processWebhookRetryJob } = await import(
      "../../src/crons/webhook-retry"
    );
    const r = await processWebhookRetryJob();
    expect(r.processed).toBe(7);
  });
});
