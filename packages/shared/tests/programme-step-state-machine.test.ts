// Tests für Programme Step State Machine + Pre-Conditions + Next-Best-Actions
// Bezug: docs/isms-bcms/10-programme-cockpit-implementation-plan.md §3.2

import { describe, it, expect } from "vitest";
import {
  PROGRAMME_STEP_STATUSES,
  PROGRAMME_STEP_TRANSITIONS,
  isProgrammeStepStatus,
  validateStepTransition,
  assertCanStartStep,
  assertCanReviewStep,
  computeNextBestActions,
  type StepCandidate,
} from "../src/state-machines/programme-step";

describe("PROGRAMME_STEP_STATUSES", () => {
  it("contains all 7 documented values", () => {
    expect(PROGRAMME_STEP_STATUSES).toEqual([
      "pending",
      "blocked",
      "in_progress",
      "review",
      "completed",
      "skipped",
      "cancelled",
    ]);
  });

  it("isProgrammeStepStatus type guard", () => {
    expect(isProgrammeStepStatus("review")).toBe(true);
    expect(isProgrammeStepStatus("done")).toBe(false);
  });
});

describe("validateStepTransition", () => {
  it.each([
    ["pending", "in_progress"],
    ["in_progress", "review"],
    ["review", "completed"],
    ["completed", "in_progress"],
    ["pending", "cancelled"],
    ["in_progress", "pending"],
  ] as const)("allows %s → %s", (from, to) => {
    expect(validateStepTransition({ from, to }).ok).toBe(true);
  });

  it("rejects pending → review (must go through in_progress)", () => {
    const r = validateStepTransition({ from: "pending", to: "review" });
    expect(r.ok).toBe(false);
  });

  it("rejects cancelled → anything (terminal)", () => {
    expect(validateStepTransition({ from: "cancelled", to: "pending" }).ok).toBe(
      false,
    );
  });

  it("requires reason for skipped transition", () => {
    expect(
      validateStepTransition({
        from: "in_progress",
        to: "skipped",
      }).ok,
    ).toBe(false);
    expect(
      validateStepTransition({
        from: "in_progress",
        to: "skipped",
        reason: "abc",
      }).ok,
    ).toBe(false); // too short
    expect(
      validateStepTransition({
        from: "in_progress",
        to: "skipped",
        reason: "Out of scope, validated by CISO 2026-04-30.",
      }).ok,
    ).toBe(true);
  });

  it("requires reason for blocked transition", () => {
    expect(
      validateStepTransition({ from: "in_progress", to: "blocked" }).ok,
    ).toBe(false);
    expect(
      validateStepTransition({
        from: "in_progress",
        to: "blocked",
        reason: "Vendor delivery delayed by 2 weeks.",
      }).ok,
    ).toBe(true);
  });
});

describe("PROGRAMME_STEP_TRANSITIONS — graph integrity", () => {
  it("every status as key", () => {
    for (const s of PROGRAMME_STEP_STATUSES) {
      expect(s in PROGRAMME_STEP_TRANSITIONS).toBe(true);
    }
  });

  it("every transition target is a known status", () => {
    for (const targets of Object.values(PROGRAMME_STEP_TRANSITIONS)) {
      for (const t of targets) {
        expect(
          (PROGRAMME_STEP_STATUSES as readonly string[]).includes(t),
        ).toBe(true);
      }
    }
  });

  it("cancelled is terminal", () => {
    expect(PROGRAMME_STEP_TRANSITIONS.cancelled).toEqual([]);
  });
});

describe("assertCanStartStep", () => {
  it("ok when no prerequisites", () => {
    expect(
      assertCanStartStep({
        prerequisiteStepCodes: [],
        prerequisiteStepStates: {},
      }),
    ).toEqual({ ok: true, unmetPrerequisites: [] });
  });

  it("ok when all prerequisites completed", () => {
    expect(
      assertCanStartStep({
        prerequisiteStepCodes: ["s1", "s2"],
        prerequisiteStepStates: { s1: "completed", s2: "completed" },
      }).ok,
    ).toBe(true);
  });

  it("ok when prerequisites are skipped", () => {
    expect(
      assertCanStartStep({
        prerequisiteStepCodes: ["s1"],
        prerequisiteStepStates: { s1: "skipped" },
      }).ok,
    ).toBe(true);
  });

  it("rejects when prerequisite still pending", () => {
    const r = assertCanStartStep({
      prerequisiteStepCodes: ["s1", "s2"],
      prerequisiteStepStates: { s1: "completed", s2: "pending" },
    });
    expect(r.ok).toBe(false);
    expect(r.unmetPrerequisites).toEqual(["s2"]);
  });

  it("rejects when prerequisite missing entirely", () => {
    const r = assertCanStartStep({
      prerequisiteStepCodes: ["s1"],
      prerequisiteStepStates: {},
    });
    expect(r.ok).toBe(false);
    expect(r.unmetPrerequisites).toEqual(["s1"]);
  });
});

describe("assertCanReviewStep", () => {
  it("ok when no evidence required", () => {
    expect(
      assertCanReviewStep({ requiredEvidenceCount: 0, evidenceLinks: [] }).ok,
    ).toBe(true);
  });

  it("ok when evidence count meets requirement", () => {
    expect(
      assertCanReviewStep({
        requiredEvidenceCount: 2,
        evidenceLinks: [
          { type: "document", id: "a" },
          { type: "soa_entry", id: "b" },
        ],
      }).ok,
    ).toBe(true);
  });

  it("rejects when not enough evidence", () => {
    const r = assertCanReviewStep({
      requiredEvidenceCount: 3,
      evidenceLinks: [{ type: "document", id: "a" }],
    });
    expect(r.ok).toBe(false);
    expect(r.evidenceProvided).toBe(1);
    expect(r.evidenceRequired).toBe(3);
    expect(r.reason).toContain("1/3");
  });

  it("ok when evidence count exceeds requirement", () => {
    expect(
      assertCanReviewStep({
        requiredEvidenceCount: 1,
        evidenceLinks: [
          { type: "document", id: "a" },
          { type: "document", id: "b" },
        ],
      }).ok,
    ).toBe(true);
  });
});

describe("computeNextBestActions", () => {
  const baseStep = (over: Partial<StepCandidate>): StepCandidate => ({
    id: "step-id",
    code: "STEP-001",
    name: "Step",
    phaseSequence: 1,
    sequence: 1,
    status: "pending",
    ownerId: "user-1",
    dueDate: null,
    isMandatory: true,
    prerequisiteStepCodes: [],
    ...over,
  });

  it("returns empty list when all steps completed", () => {
    const r = computeNextBestActions({
      steps: [
        baseStep({ id: "1", code: "S1", status: "completed" }),
        baseStep({ id: "2", code: "S2", status: "completed" }),
      ],
    });
    expect(r).toEqual([]);
  });

  it("prioritises overdue steps with highest score", () => {
    const today = "2026-04-30";
    const r = computeNextBestActions({
      today,
      steps: [
        baseStep({
          id: "1",
          code: "S1",
          status: "in_progress",
          dueDate: "2026-04-25",
        }),
        baseStep({ id: "2", code: "S2", status: "in_progress", dueDate: null }),
      ],
    });
    expect(r[0].reason).toBe("overdue");
    expect(r[0].priority).toBeGreaterThan(100);
  });

  it("flags blocked steps as blocker_resolution", () => {
    const r = computeNextBestActions({
      today: "2026-04-30",
      steps: [baseStep({ id: "1", code: "S1", status: "blocked" })],
    });
    expect(r[0].reason).toBe("blocker_resolution");
  });

  it("flags unassigned in_progress steps", () => {
    const r = computeNextBestActions({
      today: "2026-04-30",
      steps: [
        baseStep({
          id: "1",
          code: "S1",
          status: "in_progress",
          ownerId: null,
        }),
      ],
    });
    expect(r[0].reason).toBe("unassigned");
  });

  it("flags due_soon for steps within 7 days", () => {
    const r = computeNextBestActions({
      today: "2026-04-30",
      steps: [
        baseStep({
          id: "1",
          code: "S1",
          status: "pending",
          dueDate: "2026-05-05",
        }),
      ],
    });
    expect(r[0].reason).toBe("due_soon");
    expect(r[0].dueInDays).toBe(5);
  });

  it("recommends next pending step in sequence when prereqs met", () => {
    const r = computeNextBestActions({
      today: "2026-04-30",
      steps: [
        baseStep({ id: "1", code: "S1", status: "completed" }),
        baseStep({
          id: "2",
          code: "S2",
          status: "pending",
          prerequisiteStepCodes: ["S1"],
        }),
      ],
    });
    expect(r.find((a) => a.code === "S2")?.reason).toBe("next_in_sequence");
  });

  it("excludes pending steps with unmet prerequisites", () => {
    const r = computeNextBestActions({
      today: "2026-04-30",
      steps: [
        baseStep({
          id: "1",
          code: "S1",
          status: "pending",
        }),
        baseStep({
          id: "2",
          code: "S2",
          status: "pending",
          prerequisiteStepCodes: ["S1"],
        }),
      ],
    });
    const codes = r.map((a) => a.code);
    expect(codes).toContain("S1");
    expect(codes).not.toContain("S2");
  });

  it("respects the limit parameter", () => {
    const steps = Array.from({ length: 20 }, (_, i) =>
      baseStep({
        id: `s-${i}`,
        code: `S${i.toString().padStart(2, "0")}`,
        status: "pending",
        sequence: i,
      }),
    );
    const r = computeNextBestActions({ today: "2026-04-30", steps, limit: 3 });
    expect(r).toHaveLength(3);
  });
});
