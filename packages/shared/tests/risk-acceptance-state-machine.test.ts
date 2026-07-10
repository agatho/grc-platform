// Risk-Acceptance State Machine + Governance-Regeln (ISO 27005 Clause 10)
//
// Covers: status transitions (active → expired/revoked, terminal states),
// four-eyes principle (risk owner must not accept their own risk) and
// authority-matrix band resolution incl. admin fallback.

import { describe, it, expect } from "vitest";
import {
  RISK_ACCEPTANCE_STATUSES,
  RISK_ACCEPTANCE_ALLOWED_TRANSITIONS,
  isRiskAcceptanceStatus,
  validateRiskAcceptanceTransition,
  validateAcceptanceFourEyes,
  resolveAcceptanceAuthority,
  canAcceptWithRoles,
  riskLevelFromScore,
  type AcceptanceAuthorityBand,
} from "../src/state-machines/risk-acceptance";

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

describe("risk-acceptance status machine", () => {
  it("knows exactly three statuses", () => {
    expect(RISK_ACCEPTANCE_STATUSES).toEqual(["active", "expired", "revoked"]);
  });

  it("allows active → expired and active → revoked", () => {
    expect(
      validateRiskAcceptanceTransition({ from: "active", to: "expired" }).ok,
    ).toBe(true);
    expect(
      validateRiskAcceptanceTransition({ from: "active", to: "revoked" }).ok,
    ).toBe(true);
  });

  it("treats expired and revoked as terminal", () => {
    for (const from of ["expired", "revoked"] as const) {
      for (const to of ["active", "expired", "revoked"] as const) {
        if (from === to) continue;
        const result = validateRiskAcceptanceTransition({ from, to });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain("not allowed");
      }
      expect(RISK_ACCEPTANCE_ALLOWED_TRANSITIONS[from]).toEqual([]);
    }
  });

  it("accepts self-transitions as no-ops", () => {
    expect(
      validateRiskAcceptanceTransition({ from: "active", to: "active" }).ok,
    ).toBe(true);
  });

  it("type-guards status strings", () => {
    expect(isRiskAcceptanceStatus("active")).toBe(true);
    expect(isRiskAcceptanceStatus("requested")).toBe(false);
    expect(isRiskAcceptanceStatus(42)).toBe(false);
    expect(isRiskAcceptanceStatus(null)).toBe(false);
  });
});

describe("four-eyes principle", () => {
  it("rejects the risk owner accepting their own risk", () => {
    const result = validateAcceptanceFourEyes({
      riskOwnerId: USER_A,
      acceptedBy: USER_A,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/four-eyes/i);
  });

  it("allows an independent user to accept", () => {
    expect(
      validateAcceptanceFourEyes({ riskOwnerId: USER_A, acceptedBy: USER_B })
        .ok,
    ).toBe(true);
  });

  it("allows acceptance when the risk has no owner", () => {
    expect(
      validateAcceptanceFourEyes({ riskOwnerId: null, acceptedBy: USER_A }).ok,
    ).toBe(true);
    expect(
      validateAcceptanceFourEyes({ riskOwnerId: undefined, acceptedBy: USER_A })
        .ok,
    ).toBe(true);
  });
});

describe("authority-matrix resolution", () => {
  const matrix: AcceptanceAuthorityBand[] = [
    { minScore: 15, maxScore: 25, requiredRole: "admin", isActive: true },
    { minScore: 1, maxScore: 8, requiredRole: "control_owner", isActive: true },
    { minScore: 9, maxScore: 14, requiredRole: "risk_manager", isActive: true },
  ];

  it("resolves the matching band regardless of input order", () => {
    expect(resolveAcceptanceAuthority(matrix, 6).requiredRole).toBe(
      "control_owner",
    );
    expect(resolveAcceptanceAuthority(matrix, 9).requiredRole).toBe(
      "risk_manager",
    );
    expect(resolveAcceptanceAuthority(matrix, 14).requiredRole).toBe(
      "risk_manager",
    );
    expect(resolveAcceptanceAuthority(matrix, 25).requiredRole).toBe("admin");
  });

  it("ignores inactive bands", () => {
    const withInactive: AcceptanceAuthorityBand[] = [
      { minScore: 1, maxScore: 25, requiredRole: "viewer", isActive: false },
      ...matrix,
    ];
    expect(resolveAcceptanceAuthority(withInactive, 5).requiredRole).toBe(
      "control_owner",
    );
  });

  it("falls back to admin when no band covers the score", () => {
    const resolved = resolveAcceptanceAuthority(matrix, 0);
    expect(resolved.requiredRole).toBe("admin");
    expect(resolved.band).toBeNull();
    expect(resolveAcceptanceAuthority([], 12).requiredRole).toBe("admin");
  });

  it("lets admin accept any band (escape hatch)", () => {
    expect(canAcceptWithRoles(["admin"], "risk_manager")).toBe(true);
    expect(canAcceptWithRoles(["risk_manager"], "risk_manager")).toBe(true);
    expect(canAcceptWithRoles(["control_owner"], "risk_manager")).toBe(false);
    expect(canAcceptWithRoles([], "control_owner")).toBe(false);
  });
});

describe("riskLevelFromScore", () => {
  it("maps score bands to heatmap levels", () => {
    expect(riskLevelFromScore(1)).toBe("low");
    expect(riskLevelFromScore(3)).toBe("low");
    expect(riskLevelFromScore(4)).toBe("medium");
    expect(riskLevelFromScore(9)).toBe("medium");
    expect(riskLevelFromScore(10)).toBe("high");
    expect(riskLevelFromScore(15)).toBe("high");
    expect(riskLevelFromScore(16)).toBe("critical");
    expect(riskLevelFromScore(25)).toBe("critical");
    expect(riskLevelFromScore(null)).toBe("unknown");
    expect(riskLevelFromScore(undefined)).toBe("unknown");
  });
});
