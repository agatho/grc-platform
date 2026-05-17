// TPRM Overhaul: vendor gate-blocker unit tests.

import { describe, it, expect } from "vitest";
import { evaluateVendorGates, type VendorStatus } from "@/lib/vendor-gates";

function mkTx(rows: any[]) {
  return { execute: async () => rows };
}

const base = {
  id: "v1",
  name: "Acme",
  status: "prospect",
  tier: "standard",
  owner_id: "u1",
  country: "DE",
  dora_critical_ict: false,
  lksg_tier_1: false,
  completed_dd: 0,
  in_progress_dd: 0,
  active_contracts: 0,
  lksg_assessments: 0,
  exit_plans: 0,
};

describe("evaluateVendorGates", () => {
  it("prospect → onboarding: requires owner", async () => {
    const blockers = await evaluateVendorGates({
      tx: mkTx([{ ...base, owner_id: null }]) as any,
      vendorId: "v1",
      orgId: "o1",
      target: "onboarding" as VendorStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("missing_owner");
  });

  it("onboarding → active: requires completed DD", async () => {
    const blockers = await evaluateVendorGates({
      tx: mkTx([{ ...base, completed_dd: 0 }]) as any,
      vendorId: "v1",
      orgId: "o1",
      target: "active" as VendorStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("no_dd_completed");
  });

  it("LkSG-tier-1 vendor cannot go active without LkSG assessment", async () => {
    const blockers = await evaluateVendorGates({
      tx: mkTx([{ ...base, completed_dd: 1, lksg_tier_1: true, lksg_assessments: 0 }]) as any,
      vendorId: "v1",
      orgId: "o1",
      target: "active" as VendorStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("lksg_assessment_required");
  });

  it("DORA-critical vendor cannot go active without exit plan", async () => {
    const blockers = await evaluateVendorGates({
      tx: mkTx([{ ...base, completed_dd: 1, dora_critical_ict: true, exit_plans: 0 }]) as any,
      vendorId: "v1",
      orgId: "o1",
      target: "active" as VendorStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("dora_exit_plan_required");
  });

  it("active → terminated: blocks while active contracts remain", async () => {
    const blockers = await evaluateVendorGates({
      tx: mkTx([{ ...base, active_contracts: 2 }]) as any,
      vendorId: "v1",
      orgId: "o1",
      target: "terminated" as VendorStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("active_contracts_remain");
  });

  it("happy path: all green for prospect → onboarding", async () => {
    const blockers = await evaluateVendorGates({
      tx: mkTx([base]) as any,
      vendorId: "v1",
      orgId: "o1",
      target: "onboarding" as VendorStatus,
    });
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
});
