// Tests für Stakeholder-Register Pure-Funktionen (REQ-ISMS-005)
// Bezug: ISO 27001:2022 §4.2 — interessierte Parteien

import { describe, it, expect } from "vitest";
import {
  recommendEngagementStrategy,
  STAKEHOLDER_EXPECTATION_STATUSES,
  STAKEHOLDER_EXPECTATION_TRANSITIONS,
} from "@grc/db";

describe("recommendEngagementStrategy — Power/Interest Matrix", () => {
  it("manage_closely for high influence + high interest", () => {
    expect(recommendEngagementStrategy("high", "high")).toBe("manage_closely");
    expect(recommendEngagementStrategy("critical", "critical")).toBe(
      "manage_closely",
    );
    expect(recommendEngagementStrategy("critical", "high")).toBe(
      "manage_closely",
    );
    expect(recommendEngagementStrategy("high", "critical")).toBe(
      "manage_closely",
    );
  });

  it("keep_satisfied for high influence + low interest", () => {
    expect(recommendEngagementStrategy("high", "low")).toBe("keep_satisfied");
    expect(recommendEngagementStrategy("critical", "medium")).toBe(
      "keep_satisfied",
    );
    expect(recommendEngagementStrategy("high", "medium")).toBe("keep_satisfied");
  });

  it("keep_informed for low influence + high interest", () => {
    expect(recommendEngagementStrategy("low", "high")).toBe("keep_informed");
    expect(recommendEngagementStrategy("medium", "critical")).toBe(
      "keep_informed",
    );
    expect(recommendEngagementStrategy("medium", "high")).toBe("keep_informed");
  });

  it("monitor for low influence + low interest", () => {
    expect(recommendEngagementStrategy("low", "low")).toBe("monitor");
    expect(recommendEngagementStrategy("medium", "medium")).toBe("monitor");
    expect(recommendEngagementStrategy("low", "medium")).toBe("monitor");
    expect(recommendEngagementStrategy("medium", "low")).toBe("monitor");
  });
});

describe("STAKEHOLDER_EXPECTATION_STATUSES", () => {
  it("contains the documented set", () => {
    expect(STAKEHOLDER_EXPECTATION_STATUSES).toEqual([
      "open",
      "acknowledged",
      "in_progress",
      "met",
      "unmet",
      "obsolete",
    ]);
  });
});

describe("STAKEHOLDER_EXPECTATION_TRANSITIONS — graph integrity", () => {
  it("every status appears as a key", () => {
    for (const s of STAKEHOLDER_EXPECTATION_STATUSES) {
      expect(s in STAKEHOLDER_EXPECTATION_TRANSITIONS).toBe(true);
    }
  });

  it("every transition target is itself a known status", () => {
    for (const targets of Object.values(STAKEHOLDER_EXPECTATION_TRANSITIONS)) {
      for (const t of targets) {
        expect(
          (STAKEHOLDER_EXPECTATION_STATUSES as readonly string[]).includes(t),
        ).toBe(true);
      }
    }
  });

  it("obsolete is terminal", () => {
    expect(STAKEHOLDER_EXPECTATION_TRANSITIONS.obsolete).toEqual([]);
  });

  it("met can only become obsolete", () => {
    expect(STAKEHOLDER_EXPECTATION_TRANSITIONS.met).toEqual(["obsolete"]);
  });

  it("unmet can re-enter in_progress (re-attempt)", () => {
    expect(STAKEHOLDER_EXPECTATION_TRANSITIONS.unmet).toContain("in_progress");
  });

  it("open does not directly become met (must go through workflow)", () => {
    expect(STAKEHOLDER_EXPECTATION_TRANSITIONS.open).not.toContain("met");
  });
});
