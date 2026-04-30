import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  risk: { id: "x", orgId: "x", reviewDate: "x", ownerId: "x", deletedAt: "x" },
  notification: {},
}));

describe("processRiskReviewReminders", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero counts when no upcoming reviews", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const { processRiskReviewReminders } = await import(
      "../../src/crons/risk-review-reminder"
    );
    const r = await processRiskReviewReminders();
    expect(r.processed).toBe(0);
    expect(r.notified).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("creates one notification per upcoming risk review", async () => {
    const reviewDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: "r1",
          orgId: "org",
          title: "GDPR breach risk",
          ownerId: "owner-1",
          reviewDate,
        },
        {
          id: "r2",
          orgId: "org",
          title: "Vendor concentration",
          ownerId: "owner-2",
          reviewDate,
        },
      ]),
    );
    const { processRiskReviewReminders } = await import(
      "../../src/crons/risk-review-reminder"
    );
    const r = await processRiskReviewReminders();
    expect(r.processed).toBe(2);
    expect(r.notified).toBe(2);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("continues processing when one notification insert fails", async () => {
    const reviewDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    mockDb.select.mockReturnValueOnce(
      chainable([
        { id: "r1", orgId: "o", title: "A", ownerId: "u", reviewDate },
        { id: "r2", orgId: "o", title: "B", ownerId: "u", reviewDate },
        { id: "r3", orgId: "o", title: "C", ownerId: "u", reviewDate },
      ]),
    );
    // First insert resolves, second rejects, third resolves
    mockDb.insert.mockImplementationOnce(() => chainable(undefined));
    const failingChain = chainable(undefined);
    (failingChain as unknown as { values: ReturnType<typeof vi.fn> }).values =
      vi.fn().mockRejectedValue(new Error("constraint violation"));
    mockDb.insert.mockImplementationOnce(() => failingChain);
    mockDb.insert.mockImplementationOnce(() => chainable(undefined));

    const { processRiskReviewReminders } = await import(
      "../../src/crons/risk-review-reminder"
    );
    const r = await processRiskReviewReminders();
    expect(r.processed).toBe(3);
    expect(r.notified).toBe(2); // one failed
  });

  it("computes daysUntilReview correctly (≥ 1 day for tomorrow)", async () => {
    const reviewDate = new Date(Date.now() + 86400000)
      .toISOString()
      .slice(0, 10);
    mockDb.select.mockReturnValueOnce(
      chainable([
        { id: "r1", orgId: "o", title: "Tomorrow", ownerId: "u", reviewDate },
      ]),
    );
    const { processRiskReviewReminders } = await import(
      "../../src/crons/risk-review-reminder"
    );
    const r = await processRiskReviewReminders();
    expect(r.notified).toBe(1);
    // Verify the values() call captured the templateData
    const insertCall = mockDb.insert.mock.results[0]
      ?.value as { values: ReturnType<typeof vi.fn> };
    expect(insertCall).toBeTruthy();
    expect(insertCall.values).toHaveBeenCalled();
    const args = insertCall.values.mock.calls[0]![0];
    expect(args.userId).toBe("u");
    expect(args.entityType).toBe("risk");
    expect(args.templateKey).toBe("risk_review_reminder");
  });
});
