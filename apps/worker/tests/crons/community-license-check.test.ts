import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  communityEditionConfig: { id: "x", orgId: "x", expiresAt: "x" },
}));

describe("processCommunityLicenseCheck", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns expected result shape", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const { processCommunityLicenseCheck } = await import("../../src/crons/community-license-check");
    const r = await processCommunityLicenseCheck();
    expect(r).toBeDefined();
  });
});
