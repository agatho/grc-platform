// Tests für Programme Journey State Machine + Health Evaluator
// Bezug: docs/isms-bcms/10-programme-cockpit-implementation-plan.md §3.1

import { describe, it, expect } from "vitest";
import {
  PROGRAMME_JOURNEY_STATUSES,
  PROGRAMME_JOURNEY_TRANSITIONS,
  isProgrammeJourneyStatus,
  validateJourneyTransition,
  evaluateJourneyHealth,
  computeJourneyProgress,
} from "../src/state-machines/programme-journey";

describe("PROGRAMME_JOURNEY_STATUSES", () => {
  it("contains the documented values", () => {
    expect(PROGRAMME_JOURNEY_STATUSES).toEqual([
      "planned",
      "active",
      "on_track",
      "at_risk",
      "blocked",
      "completed",
      "archived",
    ]);
  });

  it("isProgrammeJourneyStatus type guard", () => {
    expect(isProgrammeJourneyStatus("active")).toBe(true);
    expect(isProgrammeJourneyStatus("nope")).toBe(false);
    expect(isProgrammeJourneyStatus(undefined)).toBe(false);
    expect(isProgrammeJourneyStatus(null)).toBe(false);
  });
});

describe("validateJourneyTransition", () => {
  it.each([
    ["planned", "active"],
    ["active", "on_track"],
    ["active", "blocked"],
    ["on_track", "at_risk"],
    ["at_risk", "on_track"],
    ["blocked", "active"],
    ["on_track", "completed"],
    ["completed", "archived"],
  ] as const)("allows %s → %s", (from, to) => {
    expect(validateJourneyTransition({ from, to })).toEqual({ ok: true });
  });

  it.each([
    ["archived", "active"],
    ["completed", "active"],
    ["planned", "completed"],
    ["planned", "on_track"],
  ] as const)("rejects %s → %s", (from, to) => {
    const result = validateJourneyTransition({ from, to });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain(`${from} → ${to}`);
  });

  it("permits no-op transition", () => {
    expect(validateJourneyTransition({ from: "active", to: "active" })).toEqual(
      { ok: true },
    );
  });
});

describe("PROGRAMME_JOURNEY_TRANSITIONS — graph integrity", () => {
  it("every status appears as a key", () => {
    for (const s of PROGRAMME_JOURNEY_STATUSES) {
      expect(s in PROGRAMME_JOURNEY_TRANSITIONS).toBe(true);
    }
  });

  it("every transition target is itself a known status", () => {
    for (const targets of Object.values(PROGRAMME_JOURNEY_TRANSITIONS)) {
      for (const t of targets) {
        expect(
          (PROGRAMME_JOURNEY_STATUSES as readonly string[]).includes(t),
        ).toBe(true);
      }
    }
  });

  it("archived is terminal", () => {
    expect(PROGRAMME_JOURNEY_TRANSITIONS.archived).toEqual([]);
  });
});

describe("evaluateJourneyHealth", () => {
  it("returns at_risk when no steps configured", () => {
    const r = evaluateJourneyHealth({
      totalSteps: 0,
      completedSteps: 0,
      inProgressSteps: 0,
      blockedSteps: 0,
      overdueSteps: 0,
      unassignedMandatorySteps: 0,
    });
    expect(r.derivedStatus).toBe("at_risk");
    expect(r.healthScore).toBe(0);
  });

  it("returns completed when all steps done", () => {
    const r = evaluateJourneyHealth({
      totalSteps: 10,
      completedSteps: 10,
      inProgressSteps: 0,
      blockedSteps: 0,
      overdueSteps: 0,
      unassignedMandatorySteps: 0,
    });
    expect(r.derivedStatus).toBe("completed");
    expect(r.healthScore).toBe(100);
    expect(r.signals[0].code).toBe("all_completed");
  });

  it("returns blocked when ≥ 20 % overdue", () => {
    const r = evaluateJourneyHealth({
      totalSteps: 10,
      completedSteps: 5,
      inProgressSteps: 3,
      blockedSteps: 0,
      overdueSteps: 2,
      unassignedMandatorySteps: 0,
    });
    expect(r.derivedStatus).toBe("blocked");
    expect(r.signals.some((s) => s.code === "overdue_steps")).toBe(true);
  });

  it("returns blocked when at least one step blocked", () => {
    const r = evaluateJourneyHealth({
      totalSteps: 10,
      completedSteps: 6,
      inProgressSteps: 3,
      blockedSteps: 1,
      overdueSteps: 0,
      unassignedMandatorySteps: 0,
    });
    expect(r.derivedStatus).toBe("blocked");
    expect(r.signals.some((s) => s.code === "blocked_steps")).toBe(true);
  });

  it("returns at_risk when steps overdue but < 20 %", () => {
    const r = evaluateJourneyHealth({
      totalSteps: 20,
      completedSteps: 5,
      inProgressSteps: 14,
      blockedSteps: 0,
      overdueSteps: 1,
      unassignedMandatorySteps: 0,
    });
    expect(r.derivedStatus).toBe("at_risk");
  });

  it("returns at_risk when mandatory steps unassigned", () => {
    const r = evaluateJourneyHealth({
      totalSteps: 10,
      completedSteps: 5,
      inProgressSteps: 4,
      blockedSteps: 0,
      overdueSteps: 0,
      unassignedMandatorySteps: 3,
    });
    expect(r.derivedStatus).toBe("at_risk");
    expect(r.signals.some((s) => s.code === "unassigned_steps")).toBe(true);
  });

  it("returns on_track when no warnings", () => {
    const r = evaluateJourneyHealth({
      totalSteps: 10,
      completedSteps: 4,
      inProgressSteps: 6,
      blockedSteps: 0,
      overdueSteps: 0,
      unassignedMandatorySteps: 0,
    });
    expect(r.derivedStatus).toBe("on_track");
    expect(r.healthScore).toBeGreaterThan(0);
  });

  it("health score is bounded 0-100", () => {
    for (let blocked = 0; blocked <= 5; blocked++) {
      const r = evaluateJourneyHealth({
        totalSteps: 10,
        completedSteps: 0,
        inProgressSteps: 0,
        blockedSteps: blocked,
        overdueSteps: 0,
        unassignedMandatorySteps: 0,
      });
      expect(r.healthScore).toBeGreaterThanOrEqual(0);
      expect(r.healthScore).toBeLessThanOrEqual(100);
    }
  });
});

describe("computeJourneyProgress", () => {
  it("returns 0 for empty journey", () => {
    expect(
      computeJourneyProgress({
        totalSteps: 0,
        completedSteps: 0,
        skippedSteps: 0,
        inProgressSteps: 0,
        reviewSteps: 0,
      }),
    ).toBe(0);
  });

  it("returns 100 for fully completed journey", () => {
    expect(
      computeJourneyProgress({
        totalSteps: 10,
        completedSteps: 10,
        skippedSteps: 0,
        inProgressSteps: 0,
        reviewSteps: 0,
      }),
    ).toBe(100);
  });

  it("counts skipped same as completed", () => {
    expect(
      computeJourneyProgress({
        totalSteps: 10,
        completedSteps: 5,
        skippedSteps: 5,
        inProgressSteps: 0,
        reviewSteps: 0,
      }),
    ).toBe(100);
  });

  it("weights in_progress as 0.5", () => {
    expect(
      computeJourneyProgress({
        totalSteps: 10,
        completedSteps: 0,
        skippedSteps: 0,
        inProgressSteps: 10,
        reviewSteps: 0,
      }),
    ).toBe(50);
  });

  it("weights review as 0.85", () => {
    expect(
      computeJourneyProgress({
        totalSteps: 10,
        completedSteps: 0,
        skippedSteps: 0,
        inProgressSteps: 0,
        reviewSteps: 10,
      }),
    ).toBe(85);
  });

  it("returns rounded percentage", () => {
    const v = computeJourneyProgress({
      totalSteps: 7,
      completedSteps: 1,
      skippedSteps: 0,
      inProgressSteps: 0,
      reviewSteps: 0,
    });
    expect(v).toBeCloseTo(14.29, 1);
  });
});
