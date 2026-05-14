// Risk-Status State-Machine tests
//
// Companion to risk-status-transition.test.ts (which covers the schema
// layer). These tests cover the actual transition matrix used by the
// /api/v1/risks/[id]/status endpoint to gate state changes (QA-012).
//
// Two contracts:
//   1. The matrix follows the documented ISO 31000 lifecycle —
//      identified → assessed → treated → accepted → closed,
//      plus reverse-jumps from later states back to "assessed" so
//      auditors can re-evaluate risks that were previously closed.
//      `closed` itself only transitions to the explicit `reopened`
//      state (#WAVE14-STATE-02) — not directly back into the lifecycle.
//   2. validateRiskStatusTransition() returns ok=false with a
//      human-readable reason for forbidden jumps, and ok=true for
//      no-op transitions where from === to.

import { describe, it, expect } from "vitest";
import {
  RISK_STATUSES,
  RISK_ALLOWED_TRANSITIONS,
  isRiskStatus,
  validateRiskStatusTransition,
  transitionRequiresReason,
  type RiskStatus,
} from "../src/state-machines/risk-status";

describe("RISK_ALLOWED_TRANSITIONS — matrix shape", () => {
  it("covers every documented status as a source", () => {
    for (const status of RISK_STATUSES) {
      expect(RISK_ALLOWED_TRANSITIONS[status]).toBeDefined();
    }
  });

  it("only lists known statuses as targets", () => {
    const known = new Set<string>(RISK_STATUSES);
    for (const status of RISK_STATUSES) {
      for (const target of RISK_ALLOWED_TRANSITIONS[status]) {
        expect(known.has(target)).toBe(true);
      }
    }
  });

  it("never lists self-transitions in the matrix (handled by no-op shortcut)", () => {
    for (const status of RISK_STATUSES) {
      expect(RISK_ALLOWED_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it("allows in-flight reopens (assessed/treated/accepted → identified)", () => {
    // In-flight reopens are normal lifecycle backtracks; they don't go
    // through `reopened`. closed is excluded (it has its own edge below).
    const reopenable: RiskStatus[] = ["assessed", "treated", "accepted"];
    for (const status of reopenable) {
      expect(RISK_ALLOWED_TRANSITIONS[status]).toContain("identified");
    }
  });

  it("routes closed → reopened only (#WAVE14-STATE-02)", () => {
    // The only legal exit from closed is into the explicit reopened
    // state; the handler additionally enforces a non-empty reason.
    expect(RISK_ALLOWED_TRANSITIONS.closed).toEqual(["reopened"]);
    expect(transitionRequiresReason("closed", "reopened")).toBe(true);
  });

  it("reopened lands back in identified or assessed", () => {
    expect(RISK_ALLOWED_TRANSITIONS.reopened).toEqual(
      expect.arrayContaining(["identified", "assessed"]),
    );
  });
});

describe("validateRiskStatusTransition — happy paths", () => {
  it.each([
    ["identified", "assessed"],
    ["identified", "accepted"], // direct-acceptance shortcut
    ["assessed", "treated"],
    ["assessed", "accepted"],
    ["treated", "accepted"],
    ["treated", "closed"],
    ["treated", "assessed"], // step back if treatment plan changes
    ["accepted", "closed"],
    ["accepted", "identified"], // in-flight reopen
    ["closed", "reopened"], // explicit reopen edge
    ["reopened", "identified"], // landed back in triage
    ["reopened", "assessed"], // landed back in assessment
  ] as Array<[RiskStatus, RiskStatus]>)("allows %s → %s", (from, to) => {
    const result = validateRiskStatusTransition({ from, to });
    expect(result.ok).toBe(true);
  });

  it("treats from === to as a no-op (idempotent PUT)", () => {
    const result = validateRiskStatusTransition({
      from: "assessed",
      to: "assessed",
    });
    expect(result.ok).toBe(true);
  });
});

describe("validateRiskStatusTransition — forbidden jumps", () => {
  it.each([
    // Cannot skip assessment to land on treated
    ["identified", "treated"],
    ["identified", "closed"],
    // Cannot regress from accepted/closed back to treated
    ["accepted", "treated"],
    ["accepted", "assessed"],
    ["closed", "treated"],
    ["closed", "accepted"],
    ["closed", "assessed"],
    // #WAVE14-STATE-02: closed → identified is no longer allowed; you go
    // through the explicit `reopened` state and land somewhere from there.
    ["closed", "identified"],
    // assessed cannot jump straight to closed (must go via accepted/treated first)
    ["assessed", "closed"],
  ] as Array<[RiskStatus, RiskStatus]>)("rejects %s → %s", (from, to) => {
    const result = validateRiskStatusTransition({ from, to });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain(`${from} → ${to} not allowed`);
  });

  it("returns the list of allowed targets in the error reason", () => {
    const result = validateRiskStatusTransition({
      from: "identified",
      to: "closed",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Allowed targets:");
  });
});

describe("isRiskStatus — type guard", () => {
  it.each(RISK_STATUSES)("recognises %s", (status) => {
    expect(isRiskStatus(status)).toBe(true);
  });

  it.each([
    "open",
    "Identified",
    "mitigated",
    "",
    "fake-status",
    null,
    undefined,
    42,
    {},
  ])("rejects %p", (value) => {
    expect(isRiskStatus(value)).toBe(false);
  });
});
