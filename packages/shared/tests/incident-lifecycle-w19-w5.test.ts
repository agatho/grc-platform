// Incident Lifecycle — NIST 7-state walk + DSGVO Art. 33 72h timer.
//
// #WAVE19-W5: Wave-19 QA spec wants a comprehensive lock-in of the
// incident state machine + DSGVO 72h breach-deadline math. The
// pieces already exist:
//   - `incidentStatusTransitions` (7-state matrix in shared/schemas/isms)
//   - `computeBreachDeadline` (72h math in shared/state-machines/dpms-breach)
//   - `validateBreachGate10NotifyDpa` (issues `72h_deadline_exceeded`
//     warning when detected > 72h ago without dpa-notification)
//
// This test file pins the public contract so a regression that
// silently shrinks the matrix (e.g. removing `closed → detected`
// re-open) or breaks the 72h math (timezone bug, clock-skew) gets
// caught by CI rather than by a real incident-response engineer
// at 02:00.

import { describe, it, expect } from "vitest";
import {
  incidentStatusTransitions,
  isValidIncidentTransition,
} from "../src/schemas/isms";
import {
  computeBreachDeadline,
  validateBreachGate10NotifyDpa,
  validateBreachTransition,
  type BreachSnapshot,
} from "../src/state-machines/dpms-breach";

describe("Incident state-machine — NIST 7-state walk (Wave-19-W5)", () => {
  // The canonical 7-state ARCTOS matrix (mirrors NIST SP 800-61):
  //   detected → triaged → contained → eradicated → recovered →
  //   lessons_learned → closed
  // closed → detected re-opens for late-discovered evidence.

  it("draws the canonical 7-state forward path", () => {
    const path = [
      "detected",
      "triaged",
      "contained",
      "eradicated",
      "recovered",
      "lessons_learned",
      "closed",
    ] as const;

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      expect(
        isValidIncidentTransition(from, to),
        `transition ${from} → ${to} must be valid`,
      ).toBe(true);
    }
  });

  it("supports triaged → eradicated as a fast-path (skip contained)", () => {
    // Some playbooks (e.g. malware on a single endpoint) can jump
    // straight from triage to eradication if containment is implicit
    // in the eradication step. The matrix allows this.
    expect(isValidIncidentTransition("triaged", "eradicated")).toBe(true);
  });

  it("rejects out-of-order skips (detected → eradicated)", () => {
    expect(isValidIncidentTransition("detected", "eradicated")).toBe(false);
    expect(isValidIncidentTransition("detected", "closed")).toBe(false);
    expect(isValidIncidentTransition("recovered", "contained")).toBe(false);
  });

  it("allows closed → detected (re-open for late evidence)", () => {
    // Important for post-mortem flows where new IOCs surface days
    // later — must be re-openable without admin override.
    expect(isValidIncidentTransition("closed", "detected")).toBe(true);
  });

  it("terminal state semantics: closed has only re-open as next", () => {
    expect(incidentStatusTransitions.closed).toEqual(["detected"]);
  });

  it("rejects unknown statuses without throwing", () => {
    expect(isValidIncidentTransition("not_a_status", "triaged")).toBe(false);
    expect(isValidIncidentTransition("triaged", "not_a_status")).toBe(false);
  });
});

describe("DSGVO Art. 33 — 72h breach-deadline math (Wave-19-W5)", () => {
  // Wall-clock fixture: pretend "now" is exactly 1h after detection.
  const detectedAt = new Date("2026-05-15T08:00:00Z");

  it("green urgency at t+1h (71h left)", () => {
    const now = new Date("2026-05-15T09:00:00Z");
    const d = computeBreachDeadline(detectedAt, now);
    expect(d.urgency).toBe("green");
    expect(d.overdue).toBe(false);
    expect(d.hoursRemaining).toBeCloseTo(71, 0);
  });

  it("yellow urgency at t+25h (47h left, < 48h)", () => {
    const now = new Date("2026-05-16T09:00:00Z");
    const d = computeBreachDeadline(detectedAt, now);
    expect(d.urgency).toBe("yellow");
  });

  it("orange urgency at t+49h (23h left, < 24h)", () => {
    const now = new Date("2026-05-17T09:00:00Z");
    const d = computeBreachDeadline(detectedAt, now);
    expect(d.urgency).toBe("orange");
  });

  it("red urgency at t+67h (5h left, < 6h)", () => {
    const now = new Date("2026-05-18T03:00:00Z");
    const d = computeBreachDeadline(detectedAt, now);
    expect(d.urgency).toBe("red");
    expect(d.overdue).toBe(false);
  });

  it("red + overdue at t+73h", () => {
    const now = new Date("2026-05-18T09:00:00Z");
    const d = computeBreachDeadline(detectedAt, now);
    expect(d.urgency).toBe("red");
    expect(d.overdue).toBe(true);
    expect(d.hoursRemaining).toBeLessThan(0);
  });

  it("deadline is exactly detectedAt + 72h", () => {
    const d = computeBreachDeadline(detectedAt);
    expect(d.deadlineAt.toISOString()).toBe("2026-05-18T08:00:00.000Z");
  });
});

describe("Breach Gate-10 — 72h-deadline-exceeded warning (Wave-19-W5)", () => {
  const baseSnapshot: BreachSnapshot = {
    status: "assessing",
    title: "Test breach",
    description:
      "A simulated breach for testing the 72h-overdue warning path. " +
      "Padding to satisfy the 50-character minimum-description gate.",
    severity: "high",
    detectedAt: null, // overridden per test
    dpaNotifiedAt: null,
    individualsNotifiedAt: null,
    isDpaNotificationRequired: true,
    isIndividualNotificationRequired: false,
    dataCategoriesAffected: ["customer-emails"],
    estimatedRecordsAffected: 100,
    containmentMeasures:
      "Account access revoked, leaked credentials rotated, IDS rule deployed.",
    remediationMeasures: null,
  };

  it("issues 72h_deadline_exceeded WARNING when detected > 72h ago", () => {
    // 100 hours ago.
    const detectedAt = new Date(Date.now() - 100 * 60 * 60 * 1000);
    const blockers = validateBreachGate10NotifyDpa({
      ...baseSnapshot,
      detectedAt,
    });
    const overdue = blockers.find((b) => b.code === "72h_deadline_exceeded");
    expect(overdue).toBeDefined();
    expect(overdue?.severity).toBe("warning");
    expect(overdue?.message).toMatch(/72h-Frist ueberschritten/);
  });

  it("does NOT issue 72h_deadline_exceeded when detected within 72h", () => {
    // 24 hours ago.
    const detectedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const blockers = validateBreachGate10NotifyDpa({
      ...baseSnapshot,
      detectedAt,
    });
    const overdue = blockers.find((b) => b.code === "72h_deadline_exceeded");
    expect(overdue).toBeUndefined();
  });

  it("blocks transition assessing → notifying_dpa when Art. 33(3) info missing", () => {
    const result = validateBreachTransition({
      currentStatus: "assessing",
      targetStatus: "notifying_dpa",
      snapshot: {
        ...baseSnapshot,
        detectedAt: new Date(),
        dataCategoriesAffected: [], // <-- the violation
      },
    });
    expect(result.allowed).toBe(false);
    expect(
      result.blockers.some((b) => b.code === "missing_data_categories"),
    ).toBe(true);
  });

  it("allows transition when all Art. 33(3) info is present", () => {
    const result = validateBreachTransition({
      currentStatus: "assessing",
      targetStatus: "notifying_dpa",
      snapshot: { ...baseSnapshot, detectedAt: new Date() },
    });
    expect(result.allowed).toBe(true);
  });
});
