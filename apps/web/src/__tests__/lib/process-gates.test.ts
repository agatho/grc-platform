// BPM Overhaul Phase 3: Unit tests for gate-blocker structure.
//
// We mock the tx.execute interface to assert that the gate evaluator
// produces the expected blocker codes for the canonical scenarios.

import { describe, it, expect } from "vitest";
import {
  evaluateTransitionGates,
  type ProcessStatus,
} from "@/lib/process-gates";

function mkTx(scenarios: Record<string, any[]>) {
  let call = 0;
  const order = ["process", "stats"];
  return {
    execute: async (_q: any) => {
      const key = order[call++ % order.length];
      return scenarios[key] ?? [];
    },
  };
}

describe("evaluateTransitionGates", () => {
  it("draft → in_review: blocks when owner missing and no versions", async () => {
    const tx = mkTx({
      process: [
        {
          id: "p1",
          name: "Test",
          status: "draft",
          process_owner_id: null,
          reviewer_id: null,
          is_critical_process: false,
          description: "x",
        },
      ],
      stats: [
        {
          activities: 0,
          activities_without_desc: 0,
          versions: 0,
          framework_mappings: 0,
          open_findings: 0,
          untreated_risks: 0,
        },
      ],
    });
    const blockers = await evaluateTransitionGates({
      tx: tx as any,
      processId: "p1",
      orgId: "o1",
      target: "in_review" as ProcessStatus,
    });
    const codes = blockers.map((b) => b.code);
    expect(codes).toContain("missing_process_owner");
    expect(codes).toContain("no_activities");
    expect(codes).toContain("no_versions");
  });

  it("in_review → approved: blocks when reviewer missing or descriptions empty", async () => {
    const tx = mkTx({
      process: [
        {
          id: "p1",
          name: "Test",
          status: "in_review",
          process_owner_id: "u1",
          reviewer_id: null,
          is_critical_process: false,
          description: "ok",
        },
      ],
      stats: [
        {
          activities: 5,
          activities_without_desc: 2,
          versions: 1,
          framework_mappings: 0,
          open_findings: 0,
          untreated_risks: 0,
        },
      ],
    });
    const blockers = await evaluateTransitionGates({
      tx: tx as any,
      processId: "p1",
      orgId: "o1",
      target: "approved" as ProcessStatus,
    });
    const codes = blockers.map((b) => b.code);
    expect(codes).toContain("missing_reviewer");
    expect(codes).toContain("activities_missing_description");
  });

  it("approved → published: blocks when open findings or no framework mapping", async () => {
    const tx = mkTx({
      process: [
        {
          id: "p1",
          name: "Test",
          status: "approved",
          process_owner_id: "u1",
          reviewer_id: "u2",
          is_critical_process: false,
          description: "this is a sufficient description for publication",
        },
      ],
      stats: [
        {
          activities: 5,
          activities_without_desc: 0,
          versions: 2,
          framework_mappings: 0,
          open_findings: 3,
          untreated_risks: 0,
          owner_sign_offs: 1,
        },
      ],
    });
    const blockers = await evaluateTransitionGates({
      tx: tx as any,
      processId: "p1",
      orgId: "o1",
      target: "published" as ProcessStatus,
    });
    const codes = blockers.map((b) => b.code);
    expect(codes).toContain("open_findings");
    expect(codes).toContain("no_framework_mapping");
  });

  // B2.2: publication requires a process-owner sign-off on the current version
  it("approved → published: blocks when the process-owner sign-off is missing", async () => {
    const tx = mkTx({
      process: [
        {
          id: "p1",
          name: "Test",
          status: "approved",
          process_owner_id: "u1",
          reviewer_id: "u2",
          is_critical_process: false,
          description: "this is a sufficient description for publication",
        },
      ],
      stats: [
        {
          activities: 5,
          activities_without_desc: 0,
          versions: 2,
          framework_mappings: 2,
          open_findings: 0,
          untreated_risks: 0,
          owner_sign_offs: 0,
        },
      ],
    });
    const blockers = await evaluateTransitionGates({
      tx: tx as any,
      processId: "p1",
      orgId: "o1",
      target: "published" as ProcessStatus,
    });
    const signOffBlocker = blockers.find(
      (b) => b.code === "missing_owner_sign_off",
    );
    expect(signOffBlocker).toBeDefined();
    expect(signOffBlocker?.severity).toBe("error");
  });

  it("approved → published: passes when prerequisites met", async () => {
    const tx = mkTx({
      process: [
        {
          id: "p1",
          name: "Test",
          status: "approved",
          process_owner_id: "u1",
          reviewer_id: "u2",
          is_critical_process: false,
          description: "this is a sufficient description for publication",
        },
      ],
      stats: [
        {
          activities: 5,
          activities_without_desc: 0,
          versions: 2,
          framework_mappings: 2,
          open_findings: 0,
          untreated_risks: 0,
          owner_sign_offs: 1,
        },
      ],
    });
    const blockers = await evaluateTransitionGates({
      tx: tx as any,
      processId: "p1",
      orgId: "o1",
      target: "published" as ProcessStatus,
    });
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
});
