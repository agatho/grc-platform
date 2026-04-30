// Test for Scheduled-Notification-Email cron.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  notification: {
    id: "x",
    userId: "x",
    orgId: "x",
    channel: "x",
    sentAt: "x",
    sendAttempts: "x",
    title: "x",
    message: "x",
    templateKey: "x",
    templateData: "x",
  },
  user: { id: "x", email: "x", name: "x" },
}));

vi.mock("@grc/email", () => ({
  emailService: {
    send: vi.fn().mockResolvedValue({ ok: true, messageId: "msg-1" }),
  },
}));

describe("processScheduledNotifications", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected stats with empty queue", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processScheduledNotifications } = await import(
      "../../src/crons/scheduled-notifications"
    );
    const r = await processScheduledNotifications();
    expect(r).toBeDefined();
  });
});
