// Risk-Status-Transition-Schema + Cross-Field-Validation tests.
//
// Three contracts under test:
//
// 1. riskStatusTransitionSchema only accepts the 5 documented status values.
//    These map to the ISO 31000 lifecycle: identified → assessed → treated
//    → accepted → closed. The Zod schema is the FIRST line of defense before
//    any DB write; broken validation here means rogue statuses can land in
//    audit history.
//
// 2. createRiskSchema/updateRiskSchema cross-field refine: financialImpactMax
//    must be ≥ financialImpactMin. A logic error here corrupts every Monte
//    Carlo simulation downstream.
//
// 3. Status enum is case-sensitive — common bug source if a frontend sends
//    "Identified" instead of "identified".

import { describe, it, expect } from "vitest";
import {
  riskStatusTransitionSchema,
  createRiskSchema,
  updateRiskSchema,
} from "../src/schemas/risk";

describe("riskStatusTransitionSchema — accepted lifecycle states", () => {
  const validStatuses = [
    "identified",
    "assessed",
    "treated",
    "accepted",
    "closed",
  ] as const;

  for (const status of validStatuses) {
    it(`accepts the documented status "${status}"`, () => {
      const result = riskStatusTransitionSchema.safeParse({ status });
      expect(result.success).toBe(true);
    });
  }

  it("rejects an undocumented status (e.g. open)", () => {
    const result = riskStatusTransitionSchema.safeParse({ status: "open" });
    expect(result.success).toBe(false);
  });

  it("rejects an undocumented status (e.g. mitigated)", () => {
    // ai-act uses "mitigated" but risk does NOT — important not to confuse domains
    const result = riskStatusTransitionSchema.safeParse({
      status: "mitigated",
    });
    expect(result.success).toBe(false);
  });

  it("is case-sensitive: rejects 'Identified' (capital I)", () => {
    const result = riskStatusTransitionSchema.safeParse({
      status: "Identified",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty status", () => {
    const result = riskStatusTransitionSchema.safeParse({ status: "" });
    expect(result.success).toBe(false);
  });

  it("rejects when status is missing", () => {
    const result = riskStatusTransitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects extra payload fields gracefully (Zod default is strip)", () => {
    // Default behavior: extra fields are stripped, parse succeeds with valid status
    const result = riskStatusTransitionSchema.safeParse({
      status: "treated",
      forced: true, // should be silently dropped
    });
    expect(result.success).toBe(true);
  });
});

describe("createRiskSchema — financial impact refine", () => {
  const baseValid = {
    title: "Test Risk",
    riskCategory: "operational" as const,
    riskSource: "erm" as const,
  };

  it("accepts when min == max", () => {
    const result = createRiskSchema.safeParse({
      ...baseValid,
      financialImpactMin: 1000,
      financialImpactMax: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts when max > min", () => {
    const result = createRiskSchema.safeParse({
      ...baseValid,
      financialImpactMin: 1000,
      financialImpactMax: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("REJECTS when max < min (financial inversion bug)", () => {
    const result = createRiskSchema.safeParse({
      ...baseValid,
      financialImpactMin: 5000,
      financialImpactMax: 1000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error must be attached to financialImpactMax (the offending field)
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.financialImpactMax).toBeDefined();
    }
  });

  it("accepts when only min is provided (no comparison possible)", () => {
    const result = createRiskSchema.safeParse({
      ...baseValid,
      financialImpactMin: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts when neither is provided", () => {
    const result = createRiskSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("rejects negative financial impact (nonnegative constraint)", () => {
    const result = createRiskSchema.safeParse({
      ...baseValid,
      financialImpactMin: -100,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateRiskSchema — financial impact refine on partial updates", () => {
  it("REJECTS inversion even on update (max < min)", () => {
    const result = updateRiskSchema.safeParse({
      financialImpactMin: 9000,
      financialImpactMax: 100,
    });
    expect(result.success).toBe(false);
  });

  it("accepts setting only one bound (no pair to compare)", () => {
    const result = updateRiskSchema.safeParse({
      financialImpactMax: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts nulling financial fields (clearing values)", () => {
    const result = updateRiskSchema.safeParse({
      financialImpactMin: null,
      financialImpactMax: null,
    });
    expect(result.success).toBe(true);
  });
});
