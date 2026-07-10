// DMS Overhaul (D1–D3): unit tests for the pure document-control
// helpers in @grc/shared — major/minor versioning + effective dating,
// point-in-time resolution, four-eyes check, review-reminder staging
// and retention-purge selection logic.

import { describe, it, expect } from "vitest";
import {
  computeNextVersion,
  formatVersionLabel,
  resolveVersionAt,
  checkFourEyes,
  reviewReminderStage,
  shouldSendReviewReminder,
  computeRetentionUntil,
  isRetentionPurgeEligible,
} from "@grc/shared";

describe("computeNextVersion", () => {
  it("minor bump increments minor and keeps major (2.1 → 2.2)", () => {
    const next = computeNextVersion(
      { versionNumber: 5, versionMajor: 2, versionMinor: 1 },
      "minor",
    );
    expect(next).toEqual({
      versionNumber: 6,
      versionMajor: 2,
      versionMinor: 2,
      versionLabel: "2.2",
    });
  });

  it("major bump increments major and resets minor (2.2 → 3.0)", () => {
    const next = computeNextVersion(
      { versionNumber: 6, versionMajor: 2, versionMinor: 2 },
      "major",
    );
    expect(next).toEqual({
      versionNumber: 7,
      versionMajor: 3,
      versionMinor: 0,
      versionLabel: "3.0",
    });
  });

  it("falls back to versionNumber as major for legacy rows", () => {
    const next = computeNextVersion(
      { versionNumber: 4, versionMajor: null, versionMinor: null },
      "minor",
    );
    expect(next.versionMajor).toBe(4);
    expect(next.versionMinor).toBe(1);
    expect(next.versionLabel).toBe("4.1");
    expect(next.versionNumber).toBe(5);
  });

  it("starts at 1.0 on major bump from the zero seed", () => {
    const next = computeNextVersion(
      { versionNumber: 0, versionMajor: 0, versionMinor: 0 },
      "major",
    );
    expect(next.versionLabel).toBe("1.0");
    expect(next.versionNumber).toBe(1);
  });
});

describe("formatVersionLabel", () => {
  it("formats major.minor", () => {
    expect(formatVersionLabel(3, 12)).toBe("3.12");
  });
});

describe("resolveVersionAt (point-in-time)", () => {
  const v1 = {
    id: "v1",
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: "2026-02-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
  };
  const v2 = {
    id: "v2",
    validFrom: "2026-02-01T00:00:00Z",
    validUntil: "2026-03-01T00:00:00Z",
    createdAt: "2026-02-01T00:00:00Z",
  };
  const v3 = {
    id: "v3",
    validFrom: "2026-03-01T00:00:00Z",
    validUntil: null,
    createdAt: "2026-03-01T00:00:00Z",
  };

  it("resolves the version whose window contains the date", () => {
    const hit = resolveVersionAt(
      [v3, v1, v2],
      new Date("2026-02-15T12:00:00Z"),
    );
    expect(hit?.id).toBe("v2");
  });

  it("treats validUntil as exclusive (boundary belongs to successor)", () => {
    const hit = resolveVersionAt(
      [v1, v2, v3],
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(hit?.id).toBe("v2");
  });

  it("resolves the open-ended current window", () => {
    const hit = resolveVersionAt(
      [v1, v2, v3],
      new Date("2027-01-01T00:00:00Z"),
    );
    expect(hit?.id).toBe("v3");
  });

  it("returns null before the first window", () => {
    const hit = resolveVersionAt(
      [v1, v2, v3],
      new Date("2025-12-31T00:00:00Z"),
    );
    expect(hit).toBeNull();
  });

  it("falls back to createdAt windows for legacy rows without validFrom", () => {
    const legacy1 = {
      id: "l1",
      validFrom: null,
      validUntil: null,
      createdAt: "2026-01-01T00:00:00Z",
    };
    const legacy2 = {
      id: "l2",
      validFrom: null,
      validUntil: null,
      createdAt: "2026-02-01T00:00:00Z",
    };
    const hit = resolveVersionAt(
      [legacy1, legacy2],
      new Date("2026-01-20T00:00:00Z"),
    );
    expect(hit?.id).toBe("l1");
    const hit2 = resolveVersionAt(
      [legacy1, legacy2],
      new Date("2026-05-01T00:00:00Z"),
    );
    expect(hit2?.id).toBe("l2");
  });
});

describe("checkFourEyes", () => {
  const base = {
    currentStatus: "in_review",
    targetStatus: "approved",
    actorId: "user-a",
  };

  it("blocks the last content editor from approving", () => {
    const res = checkFourEyes({ ...base, currentVersionCreatedBy: "user-a" });
    expect(res.violation).toBe(true);
    expect(res.guardedTransition).toBe("approve");
  });

  it("blocks the last content editor from publishing", () => {
    const res = checkFourEyes({
      currentStatus: "approved",
      targetStatus: "published",
      actorId: "user-a",
      currentVersionCreatedBy: "user-a",
    });
    expect(res.violation).toBe(true);
    expect(res.guardedTransition).toBe("publish");
  });

  it("allows a different user to approve", () => {
    const res = checkFourEyes({ ...base, currentVersionCreatedBy: "user-b" });
    expect(res.violation).toBe(false);
  });

  it("falls back to document.updatedBy when no version creator exists", () => {
    const res = checkFourEyes({
      ...base,
      currentVersionCreatedBy: null,
      documentUpdatedBy: "user-a",
    });
    expect(res.violation).toBe(true);
  });

  it("falls back to document.createdBy last", () => {
    const res = checkFourEyes({
      ...base,
      currentVersionCreatedBy: null,
      documentUpdatedBy: null,
      documentCreatedBy: "user-a",
    });
    expect(res.violation).toBe(true);
  });

  it("does not guard unrelated transitions (draft → in_review)", () => {
    const res = checkFourEyes({
      currentStatus: "draft",
      targetStatus: "in_review",
      actorId: "user-a",
      currentVersionCreatedBy: "user-a",
    });
    expect(res.violation).toBe(false);
  });

  it("passes when no editor information is available at all", () => {
    const res = checkFourEyes({
      ...base,
      currentVersionCreatedBy: null,
      documentUpdatedBy: null,
      documentCreatedBy: null,
    });
    expect(res.violation).toBe(false);
  });
});

describe("reviewReminderStage", () => {
  it("maps days-until-review to the 30/14/7/0 stages", () => {
    expect(reviewReminderStage(45)).toBeNull();
    expect(reviewReminderStage(30)).toBe(30);
    expect(reviewReminderStage(15)).toBe(30);
    expect(reviewReminderStage(14)).toBe(14);
    expect(reviewReminderStage(8)).toBe(14);
    expect(reviewReminderStage(7)).toBe(7);
    expect(reviewReminderStage(1)).toBe(7);
    expect(reviewReminderStage(0)).toBe(0);
    expect(reviewReminderStage(-10)).toBe(0);
  });
});

describe("shouldSendReviewReminder", () => {
  const reviewDate = new Date("2026-08-01T00:00:00Z");

  it("does not fire more than 30 days out", () => {
    expect(
      shouldSendReviewReminder({
        reviewDate,
        lastReminderSentAt: null,
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe(false);
  });

  it("fires on first entry into a stage", () => {
    expect(
      shouldSendReviewReminder({
        reviewDate,
        lastReminderSentAt: null,
        now: new Date("2026-07-10T00:00:00Z"), // 22 days out → stage 30
      }),
    ).toBe(true);
  });

  it("does not fire twice within the same stage", () => {
    expect(
      shouldSendReviewReminder({
        reviewDate,
        lastReminderSentAt: new Date("2026-07-05T00:00:00Z"), // stage 30
        now: new Date("2026-07-10T00:00:00Z"), // still stage 30
      }),
    ).toBe(false);
  });

  it("fires again when the document enters a closer stage", () => {
    expect(
      shouldSendReviewReminder({
        reviewDate,
        lastReminderSentAt: new Date("2026-07-05T00:00:00Z"), // stage 30
        now: new Date("2026-07-20T00:00:00Z"), // 12 days out → stage 14
      }),
    ).toBe(true);
  });

  it("fires on the due date after a stage-7 reminder", () => {
    expect(
      shouldSendReviewReminder({
        reviewDate,
        lastReminderSentAt: new Date("2026-07-28T00:00:00Z"), // stage 7
        now: new Date("2026-08-01T00:00:00Z"), // stage 0
      }),
    ).toBe(true);
  });
});

describe("computeRetentionUntil", () => {
  it("adds retentionYears to the basis date", () => {
    const until = computeRetentionUntil({
      basis: "created",
      retentionYears: 10,
      createdAt: "2026-01-15T00:00:00Z",
    });
    expect(until?.toISOString()).toBe("2036-01-15T00:00:00.000Z");
  });

  it("uses publishedAt for basis 'published'", () => {
    const until = computeRetentionUntil({
      basis: "published",
      retentionYears: 2,
      createdAt: "2026-01-01T00:00:00Z",
      publishedAt: "2026-03-01T00:00:00Z",
    });
    expect(until?.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });

  it("returns null when the basis date is missing", () => {
    expect(
      computeRetentionUntil({
        basis: "expired",
        retentionYears: 5,
        createdAt: "2026-01-01T00:00:00Z",
        expiresAt: null,
      }),
    ).toBeNull();
  });
});

describe("isRetentionPurgeEligible", () => {
  const now = new Date("2026-07-01T00:00:00Z");

  it("selects archived documents past their retention deadline", () => {
    expect(
      isRetentionPurgeEligible(
        {
          retentionUntil: "2026-06-30T00:00:00Z",
          legalHold: false,
          status: "archived",
        },
        now,
      ),
    ).toBe(true);
  });

  it("selects expired documents past their retention deadline", () => {
    expect(
      isRetentionPurgeEligible(
        {
          retentionUntil: "2026-01-01T00:00:00Z",
          legalHold: false,
          status: "expired",
        },
        now,
      ),
    ).toBe(true);
  });

  it("never purges documents under legal hold", () => {
    expect(
      isRetentionPurgeEligible(
        {
          retentionUntil: "2020-01-01T00:00:00Z",
          legalHold: true,
          status: "archived",
        },
        now,
      ),
    ).toBe(false);
  });

  it("never purges before the retention deadline", () => {
    expect(
      isRetentionPurgeEligible(
        {
          retentionUntil: "2026-12-31T00:00:00Z",
          legalHold: false,
          status: "archived",
        },
        now,
      ),
    ).toBe(false);
  });

  it("never purges active lifecycle statuses (published/draft)", () => {
    expect(
      isRetentionPurgeEligible(
        {
          retentionUntil: "2020-01-01T00:00:00Z",
          legalHold: false,
          status: "published",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isRetentionPurgeEligible(
        {
          retentionUntil: "2020-01-01T00:00:00Z",
          legalHold: false,
          status: "draft",
        },
        now,
      ),
    ).toBe(false);
  });

  it("skips documents without a retention deadline", () => {
    expect(
      isRetentionPurgeEligible(
        { retentionUntil: null, legalHold: false, status: "archived" },
        now,
      ),
    ).toBe(false);
  });
});
