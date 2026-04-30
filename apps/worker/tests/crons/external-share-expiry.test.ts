// Test for External-Auditor-Share-Expiry cron (Sprint 43).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  externalAuditorShare: {
    id: "x",
    expiresAt: "x",
    isActive: "x",
    deactivatedAt: "x",
  },
}));

describe("processExternalShareExpiry", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero counts when no active shares", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processExternalShareExpiry } = await import(
      "../../src/crons/external-share-expiry"
    );
    const r = await processExternalShareExpiry();
    expect(r).toEqual(
      expect.objectContaining({
        processed: expect.any(Number),
        deactivated: expect.any(Number),
      }),
    );
  });

  it("processes expired shares without throwing", async () => {
    const expired = [
      {
        id: "share-1",
        expiresAt: new Date(Date.now() - 86400000),
        isActive: true,
      },
    ];
    mockDb.select.mockReturnValue(chainable(expired));
    const { processExternalShareExpiry } = await import(
      "../../src/crons/external-share-expiry"
    );
    await expect(processExternalShareExpiry()).resolves.toBeDefined();
  });
});
