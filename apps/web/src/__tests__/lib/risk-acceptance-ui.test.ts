// Unit tests for the Risk-Acceptance cockpit helpers — the pure
// filter / expiry-highlight / query-building / error-mapping logic
// backing apps/web/src/app/(dashboard)/risk-acceptances/page.tsx and
// the risk-detail acceptance panel.

import { describe, it, expect } from "vitest";
import {
  ACCEPTANCE_EXPIRY_WARNING_DAYS,
  acceptanceExpiryState,
  buildAcceptanceListQuery,
  daysUntil,
  isoDateInDays,
  mapAcceptanceApiError,
  truncateText,
} from "@/lib/risk-acceptance-ui";

// Fixed clock: 2026-07-10 12:00 local.
const NOW = new Date(2026, 6, 10, 12, 0, 0);

describe("daysUntil", () => {
  it("returns null for missing or invalid dates", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil(undefined, NOW)).toBeNull();
    expect(daysUntil("", NOW)).toBeNull();
    expect(daysUntil("not-a-date", NOW)).toBeNull();
  });

  it("returns 0 for today, positive for future, negative for past", () => {
    expect(daysUntil("2026-07-10", NOW)).toBe(0);
    expect(daysUntil("2026-07-11", NOW)).toBe(1);
    expect(daysUntil("2026-08-09", NOW)).toBe(30);
    expect(daysUntil("2026-07-09", NOW)).toBe(-1);
  });

  it("ignores the time-of-day of `now` (whole-day semantics)", () => {
    const lateEvening = new Date(2026, 6, 10, 23, 59, 0);
    expect(daysUntil("2026-07-11", lateEvening)).toBe(1);
  });
});

describe("acceptanceExpiryState", () => {
  it("is 'none' without a validUntil date", () => {
    expect(acceptanceExpiryState(null, NOW)).toBe("none");
    expect(acceptanceExpiryState(undefined, NOW)).toBe("none");
  });

  it("flags dates in the past as 'expired'", () => {
    expect(acceptanceExpiryState("2026-07-09", NOW)).toBe("expired");
    expect(acceptanceExpiryState("2025-01-01", NOW)).toBe("expired");
  });

  it("flags dates within the 30-day window as 'expiringSoon'", () => {
    expect(acceptanceExpiryState("2026-07-10", NOW)).toBe("expiringSoon"); // today
    expect(acceptanceExpiryState("2026-08-09", NOW)).toBe("expiringSoon"); // day 30
  });

  it("is 'ok' beyond the warning window", () => {
    expect(acceptanceExpiryState("2026-08-10", NOW)).toBe("ok"); // day 31
    expect(acceptanceExpiryState("2027-01-01", NOW)).toBe("ok");
  });

  it("honours a custom warning window", () => {
    expect(acceptanceExpiryState("2026-07-17", NOW, 7)).toBe("expiringSoon");
    expect(acceptanceExpiryState("2026-07-18", NOW, 7)).toBe("ok");
  });
});

describe("truncateText", () => {
  it("returns empty string for null/undefined", () => {
    expect(truncateText(null)).toBe("");
    expect(truncateText(undefined)).toBe("");
  });

  it("keeps short text unchanged (trimmed)", () => {
    expect(truncateText("  kurz  ", 10)).toBe("kurz");
  });

  it("cuts long text and appends an ellipsis within the limit", () => {
    const out = truncateText("a".repeat(200), 80);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("isoDateInDays", () => {
  it("formats the local date offset by n days", () => {
    expect(isoDateInDays(0, NOW)).toBe("2026-07-10");
    expect(isoDateInDays(30, NOW)).toBe("2026-08-09");
    // Month/year rollover
    expect(isoDateInDays(200, NOW)).toBe("2027-01-26");
  });
});

describe("buildAcceptanceListQuery", () => {
  it("emits page/limit with default sort (acceptedAt desc)", () => {
    const qs = new URLSearchParams(
      buildAcceptanceListQuery({ page: 2, limit: 20 }),
    );
    expect(qs.get("page")).toBe("2");
    expect(qs.get("limit")).toBe("20");
    expect(qs.get("sort")).toBe("acceptedAt");
    expect(qs.get("sortDir")).toBe("desc");
    expect(qs.get("status")).toBeNull();
    expect(qs.get("expiringBefore")).toBeNull();
  });

  it("omits the status param for 'all'", () => {
    const qs = new URLSearchParams(
      buildAcceptanceListQuery({ page: 1, limit: 20, status: "all" }),
    );
    expect(qs.get("status")).toBeNull();
  });

  it("passes an explicit status filter through", () => {
    const qs = new URLSearchParams(
      buildAcceptanceListQuery({ page: 1, limit: 20, status: "revoked" }),
    );
    expect(qs.get("status")).toBe("revoked");
  });

  it("expiringOnly adds expiringBefore = today + warning window and sorts by expiry", () => {
    const qs = new URLSearchParams(
      buildAcceptanceListQuery({
        page: 1,
        limit: 20,
        expiringOnly: true,
        now: NOW,
      }),
    );
    expect(qs.get("expiringBefore")).toBe(
      isoDateInDays(ACCEPTANCE_EXPIRY_WARNING_DAYS, NOW),
    );
    expect(qs.get("sort")).toBe("validUntil");
    expect(qs.get("sortDir")).toBe("asc");
  });

  it("supports riskId scoping (risk-detail panel)", () => {
    const qs = new URLSearchParams(
      buildAcceptanceListQuery({
        page: 1,
        limit: 100,
        riskId: "0b6f5c1e-0000-0000-0000-000000000001",
      }),
    );
    expect(qs.get("riskId")).toBe("0b6f5c1e-0000-0000-0000-000000000001");
  });
});

describe("mapAcceptanceApiError", () => {
  it("maps the four-eyes 422 to the fourEyes key", () => {
    const info = mapAcceptanceApiError(422, {
      error:
        "Four-eyes principle: the risk owner cannot formally accept their own risk. An independent role per the acceptance-authority matrix must decide.",
    });
    expect(info.key).toBe("fourEyes");
  });

  it("maps the authority 403 with requiredRole/score params", () => {
    const info = mapAcceptanceApiError(403, {
      error: "Insufficient authority",
      detail:
        "Accepting a risk with score 20 requires the role 'admin' (or admin).",
      score: 20,
      requiredRole: "admin",
      riskLevel: "critical",
    });
    expect(info.key).toBe("insufficientAuthority");
    expect(info.params).toEqual({ requiredRole: "admin", score: 20 });
  });

  it("maps 409 to alreadyAccepted", () => {
    const info = mapAcceptanceApiError(409, {
      error: "Risk is already accepted",
      acceptanceId: "x",
    });
    expect(info.key).toBe("alreadyAccepted");
  });

  it("maps the unscored 422 to notScored", () => {
    const info = mapAcceptanceApiError(422, {
      error:
        "Cannot accept an unscored risk. Set residual likelihood + impact (or inherent) first.",
    });
    expect(info.key).toBe("notScored");
  });

  it("maps Zod validation 422 to validation", () => {
    const info = mapAcceptanceApiError(422, {
      error: "Validation failed",
      details: {},
    });
    expect(info.key).toBe("validation");
  });

  it("falls back to generic with the server message preserved", () => {
    const info = mapAcceptanceApiError(500, { error: "boom" });
    expect(info.key).toBe("generic");
    expect(info.serverMessage).toBe("boom");
    expect(mapAcceptanceApiError(418, "not-an-object").key).toBe("generic");
  });
});
