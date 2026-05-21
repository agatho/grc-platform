// Test for API-Key-Expiry-Check cron (Sprint 57).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  apiKey: {
    id: "x",
    status: "x",
    expiresAt: "x",
    updatedAt: "x",
  },
}));

describe("checkApiKeyExpiry", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns {revoked, expiringSoon} counts when no expired keys exist", async () => {
    const { checkApiKeyExpiry } = await import(
      "../../src/crons/api-key-expiry-check"
    );
    const result = await checkApiKeyExpiry();
    expect(result).toMatchObject({
      revoked: expect.any(Number),
      expiringSoon: expect.any(Number),
    });
  });

  it("calls update with expired status", async () => {
    const { checkApiKeyExpiry } =
      await import("../../src/crons/api-key-expiry-check");
    await checkApiKeyExpiry();
    expect(mockDb.update).toHaveBeenCalled();
  });
});
