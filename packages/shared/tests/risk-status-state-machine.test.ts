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
//   2. validateRiskStatusTransition() returns ok=false with a
//      human-readable reason for forbidden jumps, and ok=true for
//      no-op transitions where from === to.

import { describe, it, expect } from "vitest";
import {
  RISK_STATUSES,
  RISK_ALLOWED_TRANSITIONS,
  isRiskStatus,
  validateRiskStatusTransition,
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

  it("always allows reopening into 'identified' from later states", () => {
    // Reopening forces the user back through the full assessment cycle
    // rather than letting them jump straight to a treated/accepted state.
    const reopenable: RiskStatus[] = [
      "assessed",
      "treated",
      "accepted",
      "closed",
    ];
    for (const status of reopenable) {
      expect(RISK_ALLOWED_TRANSITIONS[status]).toContain("identified");
    }
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
    ["accepted", "identified"], // reopen
    ["closed", "identified"], // reopen
  ] as Array<[RiskStatus, RiskStatus]>)(
    "allows %s → %s",
    (from, to) => {
      const result = validateRiskStatusTransition({ from, to });
      expect(result.ok).toBe(true);
    },
  );

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
    // assessed cannot jump straight to closed (must go via accepted/treated first)
    ["assessed", "closed"],
  ] as Array<[RiskStatus, RiskStatus]>)(
    "rejects %s → %s",
    (from, to) => {
      const result = validateRiskStatusTransition({ from, to });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain(`${from} → ${to} not allowed`);
    },
  );

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
