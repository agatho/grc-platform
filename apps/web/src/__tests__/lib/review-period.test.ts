// Unit-Tests für die Zeitraum-Logik des Management-Review-Cockpits
// (seit letztem completed Review bzw. konfigurierbares von/bis).

import { describe, it, expect } from "vitest";
import {
  resolveReviewPeriod,
  parseIsoDate,
} from "../../lib/isms/review-period";

const REVIEW = {
  reviewDate: "2026-06-30",
  periodStart: null,
  periodEnd: null,
};

describe("parseIsoDate", () => {
  it("parses a valid YYYY-MM-DD string to UTC midnight", () => {
    const d = parseIsoDate("2026-06-30");
    expect(d?.toISOString()).toBe("2026-06-30T00:00:00.000Z");
  });

  it("rejects invalid formats and garbage", () => {
    expect(parseIsoDate("30.06.2026")).toBeNull();
    expect(parseIsoDate("2026-6-3")).toBeNull();
    expect(parseIsoDate("not-a-date")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
  });

  it("rejects syntactically valid but impossible dates", () => {
    expect(parseIsoDate("2026-13-45")).toBeNull();
  });
});

describe("resolveReviewPeriod", () => {
  it("uses the last completed review date when nothing else is set", () => {
    const p = resolveReviewPeriod({
      review: REVIEW,
      lastCompletedReviewDate: "2025-12-15",
    });
    expect(p.source).toBe("last_completed");
    expect(p.from.toISOString().slice(0, 10)).toBe("2025-12-15");
    expect(p.to.toISOString().slice(0, 10)).toBe("2026-06-30");
  });

  it("falls back to 12 months before the review date without a previous review", () => {
    const p = resolveReviewPeriod({
      review: REVIEW,
      lastCompletedReviewDate: null,
    });
    expect(p.source).toBe("fallback_12m");
    expect(p.from.toISOString().slice(0, 10)).toBe("2025-06-30");
    expect(p.to.toISOString().slice(0, 10)).toBe("2026-06-30");
  });

  it("prefers the period configured on the review over the last completed review", () => {
    const p = resolveReviewPeriod({
      review: {
        reviewDate: "2026-06-30",
        periodStart: "2026-01-01",
        periodEnd: "2026-05-31",
      },
      lastCompletedReviewDate: "2025-12-15",
    });
    expect(p.source).toBe("review_period");
    expect(p.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(p.to.toISOString().slice(0, 10)).toBe("2026-05-31");
  });

  it("prefers query overrides over everything else", () => {
    const p = resolveReviewPeriod({
      review: {
        reviewDate: "2026-06-30",
        periodStart: "2026-01-01",
        periodEnd: "2026-05-31",
      },
      lastCompletedReviewDate: "2025-12-15",
      overrideFrom: "2026-03-01",
      overrideTo: "2026-04-30",
    });
    expect(p.source).toBe("override");
    expect(p.from.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(p.to.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("ignores malformed overrides and falls through the priority chain", () => {
    const p = resolveReviewPeriod({
      review: REVIEW,
      lastCompletedReviewDate: "2025-12-15",
      overrideFrom: "garbage",
      overrideTo: "31.12.2026",
    });
    expect(p.source).toBe("last_completed");
    expect(p.from.toISOString().slice(0, 10)).toBe("2025-12-15");
    expect(p.to.toISOString().slice(0, 10)).toBe("2026-06-30");
  });

  it("uses review_date as period end when only period_start is set", () => {
    const p = resolveReviewPeriod({
      review: {
        reviewDate: "2026-06-30",
        periodStart: "2026-01-01",
        periodEnd: null,
      },
      lastCompletedReviewDate: null,
    });
    expect(p.source).toBe("review_period");
    expect(p.to.toISOString().slice(0, 10)).toBe("2026-06-30");
  });
});
