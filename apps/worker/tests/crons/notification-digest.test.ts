// Test for Daily-Notification-Digest cron.

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
    readAt: "x",
    createdAt: "x",
    title: "x",
  },
  user: {
    id: "x",
    email: "x",
    name: "x",
    notificationSettings: "x",
  },
}));

vi.mock("@grc/email", () => ({
  emailService: {
    send: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

describe("processNotificationDigest", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected stats with no users opted in", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processNotificationDigest } = await import(
      "../../src/crons/notification-digest"
    );
    const r = await processNotificationDigest();
    expect(r).toEqual(
      expect.objectContaining({
        usersProcessed: expect.any(Number),
        emailsSent: expect.any(Number),
      }),
    );
  });
});
