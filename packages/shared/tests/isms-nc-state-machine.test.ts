// Tests für ISMS NC + Corrective Action State Machines
// Bezug: REQ-ISMS-031, REQ-ISMS-032 — siehe docs/isms-bcms/05-requirements-catalog.md

import { describe, it, expect } from "vitest";
import {
  NC_STATUSES,
  NC_ALLOWED_TRANSITIONS,
  CA_STATUSES,
  CA_ALLOWED_TRANSITIONS,
  isNcStatus,
  isCaStatus,
  validateNcTransition,
  validateCaTransition,
  assertCanCloseNc,
  assertCanCloseMajorNc,
  type CorrectiveActionSnapshot,
} from "../src/state-machines/isms-nc";

describe("NC status enum", () => {
  it("contains exactly the ISO 27001 §10.1 status values", () => {
    expect(NC_STATUSES).toEqual([
      "open",
      "analysis",
      "action_planned",
      "in_progress",
      "verification",
      "closed",
      "reopened",
    ]);
  });

  it("isNcStatus correctly classifies known and unknown values", () => {
    expect(isNcStatus("open")).toBe(true);
    expect(isNcStatus("verification")).toBe(true);
    expect(isNcStatus("invalid")).toBe(false);
    expect(isNcStatus(undefined)).toBe(false);
    expect(isNcStatus(42)).toBe(false);
  });
});

describe("validateNcTransition — happy path", () => {
  it.each([
    ["open", "analysis"],
    ["analysis", "action_planned"],
    ["action_planned", "in_progress"],
    ["in_progress", "verification"],
    ["verification", "closed"],
    ["closed", "reopened"],
    ["reopened", "analysis"],
  ] as const)("allows %s → %s", (from, to) => {
    expect(validateNcTransition({ from, to })).toEqual({ ok: true });
  });

  it("permits no-op transition (same status)", () => {
    expect(validateNcTransition({ from: "open", to: "open" })).toEqual({
      ok: true,
    });
  });

  it("permits backward transition analysis → open", () => {
    expect(validateNcTransition({ from: "analysis", to: "open" })).toEqual({
      ok: true,
    });
  });

  it("permits backward transition action_planned → analysis", () => {
    expect(
      validateNcTransition({ from: "action_planned", to: "analysis" }),
    ).toEqual({ ok: true });
  });
});

describe("validateNcTransition — forbidden transitions", () => {
  it.each([
    ["open", "closed"],
    ["open", "verification"],
    ["analysis", "closed"],
    ["closed", "open"],
    ["verification", "open"],
  ] as const)("rejects %s → %s", (from, to) => {
    const result = validateNcTransition({ from, to });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain(`${from} → ${to}`);
    expect(result.reason).toContain("not allowed");
  });

  it("describes allowed targets in error message", () => {
    const result = validateNcTransition({ from: "open", to: "closed" });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Allowed targets: analysis");
  });
});

describe("CA status enum", () => {
  it("contains exactly the documented values", () => {
    expect(CA_STATUSES).toEqual([
      "planned",
      "in_progress",
      "completed",
      "verified",
      "closed",
      "failed",
    ]);
  });

  it("isCaStatus classifies values correctly", () => {
    expect(isCaStatus("planned")).toBe(true);
    expect(isCaStatus("verified")).toBe(true);
    expect(isCaStatus("xyz")).toBe(false);
  });
});

describe("validateCaTransition", () => {
  it.each([
    ["planned", "in_progress"],
    ["in_progress", "completed"],
    ["completed", "verified"],
    ["verified", "closed"],
    ["completed", "failed"],
    ["failed", "in_progress"],
  ] as const)("allows %s → %s", (from, to) => {
    expect(validateCaTransition({ from, to })).toEqual({ ok: true });
  });

  it("rejects closed → anything (terminal state)", () => {
    expect(
      validateCaTransition({ from: "closed", to: "in_progress" }).ok,
    ).toBe(false);
  });

  it("rejects planned → completed (skipping in_progress)", () => {
    expect(validateCaTransition({ from: "planned", to: "completed" }).ok).toBe(
      false,
    );
  });
});

describe("assertCanCloseNc — REQ-ISMS-032 closure pre-conditions", () => {
  it("rejects closure when no corrective actions exist", () => {
    const result = assertCanCloseNc([]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("at least one corrective action");
    expect(result.reason).toContain("ISO 27001 §10.1 d");
  });

  it("rejects closure when CAs exist but none are verified-effective", () => {
    const actions: CorrectiveActionSnapshot[] = [
      {
        status: "in_progress",
        verificationResult: null,
        verifiedAt: null,
        effectivenessReviewDate: null,
        effectivenessRating: null,
      },
    ];
    const result = assertCanCloseNc(actions);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("verification_result='effective'");
  });

  it("rejects closure when CA verified but result not effective", () => {
    const actions: CorrectiveActionSnapshot[] = [
      {
        status: "verified",
        verificationResult: "not_effective",
        verifiedAt: "2026-04-15T00:00:00Z",
        effectivenessReviewDate: null,
        effectivenessRating: null,
      },
    ];
    expect(assertCanCloseNc(actions).ok).toBe(false);
  });

  it("accepts closure when at least one CA is verified-effective", () => {
    const actions: CorrectiveActionSnapshot[] = [
      {
        status: "in_progress",
        verificationResult: null,
        verifiedAt: null,
        effectivenessReviewDate: null,
        effectivenessRating: null,
      },
      {
        status: "verified",
        verificationResult: "effective",
        verifiedAt: "2026-04-15T00:00:00Z",
        effectivenessReviewDate: null,
        effectivenessRating: null,
      },
    ];
    expect(assertCanCloseNc(actions)).toEqual({ ok: true });
  });

  it("accepts when CA already closed with effective result", () => {
    const actions: CorrectiveActionSnapshot[] = [
      {
        status: "closed",
        verificationResult: "effective",
        verifiedAt: "2026-04-10T00:00:00Z",
        effectivenessReviewDate: "2026-05-01",
        effectivenessRating: "effective",
      },
    ];
    expect(assertCanCloseNc(actions).ok).toBe(true);
  });
});

describe("assertCanCloseMajorNc — strict variant", () => {
  it("inherits all base checks", () => {
    expect(assertCanCloseMajorNc([]).ok).toBe(false);
  });

  it("rejects when verified-effective but no effectiveness review", () => {
    const actions: CorrectiveActionSnapshot[] = [
      {
        status: "verified",
        verificationResult: "effective",
        verifiedAt: "2026-04-15T00:00:00Z",
        effectivenessReviewDate: null,
        effectivenessRating: null,
      },
    ];
    const result = assertCanCloseMajorNc(actions);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("effectiveness review");
  });

  it("accepts when verified + effectiveness review present and rating effective", () => {
    const actions: CorrectiveActionSnapshot[] = [
      {
        status: "verified",
        verificationResult: "effective",
        verifiedAt: "2026-04-15T00:00:00Z",
        effectivenessReviewDate: "2026-05-15",
        effectivenessRating: "effective",
      },
    ];
    expect(assertCanCloseMajorNc(actions).ok).toBe(true);
  });

  it("rejects when effectiveness rating is partial/ineffective", () => {
    const actions: CorrectiveActionSnapshot[] = [
      {
        status: "verified",
        verificationResult: "effective",
        verifiedAt: "2026-04-15T00:00:00Z",
        effectivenessReviewDate: "2026-05-15",
        effectivenessRating: "partial",
      },
    ];
    expect(assertCanCloseMajorNc(actions).ok).toBe(false);
  });
});

describe("transition graph integrity", () => {
  it("every NC status appears as a key in NC_ALLOWED_TRANSITIONS", () => {
    for (const s of NC_STATUSES) {
      expect(s in NC_ALLOWED_TRANSITIONS).toBe(true);
    }
  });

  it("every NC transition target is itself a known status", () => {
    for (const targets of Object.values(NC_ALLOWED_TRANSITIONS)) {
      for (const t of targets) {
        expect((NC_STATUSES as readonly string[]).includes(t)).toBe(true);
      }
    }
  });

  it("every CA status appears as a key in CA_ALLOWED_TRANSITIONS", () => {
    for (const s of CA_STATUSES) {
      expect(s in CA_ALLOWED_TRANSITIONS).toBe(true);
    }
  });

  it("every CA transition target is itself a known status", () => {
    for (const targets of Object.values(CA_ALLOWED_TRANSITIONS)) {
      for (const t of targets) {
        expect((CA_STATUSES as readonly string[]).includes(t)).toBe(true);
      }
    }
  });
});
