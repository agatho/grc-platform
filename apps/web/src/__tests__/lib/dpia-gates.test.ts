// DPMS Overhaul: DPIA gate-blocker unit tests.

import { describe, it, expect } from "vitest";
import { evaluateDpiaGates, type DpiaStatus } from "@/lib/dpia-gates";

function mkTx(rows: any) {
  return { execute: async () => rows };
}

const baseDpia = {
  id: "d1",
  title: "Test",
  status: "draft",
  processing_description: "x".repeat(40),
  legal_basis: "contract",
  necessity_assessment: null,
  dpo_consultation_required: true,
  dpo_opinion: null,
  consultation_result: null,
  residual_risk_sign_off_id: null,
  risk_count: 0,
  measure_count: 0,
  high_residual_count: 0,
};

describe("evaluateDpiaGates", () => {
  it("draft → in_progress: requires description + legal basis", async () => {
    const blockers = await evaluateDpiaGates({
      tx: mkTx([{ ...baseDpia, processing_description: "short", legal_basis: null }]) as any,
      dpiaId: "d1",
      orgId: "o1",
      target: "in_progress" as DpiaStatus,
    });
    const codes = blockers.map((b) => b.code);
    expect(codes).toContain("weak_processing_description");
    expect(codes).toContain("missing_legal_basis");
  });

  it("in_progress → pending_dpo_review: requires risks + measures", async () => {
    const blockers = await evaluateDpiaGates({
      tx: mkTx([{ ...baseDpia, risk_count: 0, measure_count: 0 }]) as any,
      dpiaId: "d1",
      orgId: "o1",
      target: "pending_dpo_review" as DpiaStatus,
    });
    const codes = blockers.map((b) => b.code);
    expect(codes).toContain("no_risks_identified");
    expect(codes).toContain("no_measures");
  });

  it("pending_dpo_review → approved: requires DPO opinion", async () => {
    const blockers = await evaluateDpiaGates({
      tx: mkTx([{ ...baseDpia, dpo_opinion: null, risk_count: 3, measure_count: 5 }]) as any,
      dpiaId: "d1",
      orgId: "o1",
      target: "approved" as DpiaStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("missing_dpo_opinion");
  });

  it("approved with high residual + no consultation warns about Art. 36", async () => {
    const blockers = await evaluateDpiaGates({
      tx: mkTx([
        {
          ...baseDpia,
          dpo_opinion: "Acceptable",
          high_residual_count: 2,
          consultation_result: null,
        },
      ]) as any,
      dpiaId: "d1",
      orgId: "o1",
      target: "approved" as DpiaStatus,
    });
    const codes = blockers.map((b) => b.code);
    expect(codes).toContain("missing_authority_consultation");
  });

  it("approved → completed: requires residual sign-off", async () => {
    const blockers = await evaluateDpiaGates({
      tx: mkTx([{ ...baseDpia, residual_risk_sign_off_id: null }]) as any,
      dpiaId: "d1",
      orgId: "o1",
      target: "completed" as DpiaStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("missing_residual_signoff");
  });
});
