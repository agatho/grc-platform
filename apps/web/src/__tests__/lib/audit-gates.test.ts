// Audit Overhaul Phase 1: gate-blocker unit tests.

import { describe, it, expect } from "vitest";
import { evaluateAuditGates, type AuditStatus } from "@/lib/audit-gates";

function mkTx(scenarios: Record<string, any[]>) {
  let call = 0;
  const order = ["audit", "stats"];
  return {
    execute: async () => scenarios[order[call++ % order.length]] ?? [],
  };
}

describe("evaluateAuditGates", () => {
  it("planned → preparation: requires lead auditor", async () => {
    const tx = mkTx({
      audit: [
        { id: "a1", status: "planned", lead_auditor_id: null, scope_description: "x".repeat(30) },
      ],
      stats: [{ checklist_count: 0, item_count: 0, unrated_items: 0, evidence_count: 0, open_finding_count: 0 }],
    });
    const blockers = await evaluateAuditGates({
      tx: tx as any,
      auditId: "a1",
      orgId: "o1",
      target: "preparation" as AuditStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("missing_lead_auditor");
  });

  it("preparation → fieldwork: requires checklist + items", async () => {
    const tx = mkTx({
      audit: [
        { id: "a1", status: "preparation", lead_auditor_id: "u1", scope_description: "x".repeat(30) },
      ],
      stats: [{ checklist_count: 0, item_count: 0, unrated_items: 0, evidence_count: 0, open_finding_count: 0 }],
    });
    const blockers = await evaluateAuditGates({
      tx: tx as any,
      auditId: "a1",
      orgId: "o1",
      target: "fieldwork" as AuditStatus,
    });
    const codes = blockers.map((b) => b.code);
    expect(codes).toContain("no_checklist");
    expect(codes).toContain("empty_checklist");
  });

  it("fieldwork → reporting: requires all items rated", async () => {
    const tx = mkTx({
      audit: [
        { id: "a1", status: "fieldwork", lead_auditor_id: "u1", scope_description: "x".repeat(30) },
      ],
      stats: [{ checklist_count: 1, item_count: 10, unrated_items: 3, evidence_count: 0, open_finding_count: 0 }],
    });
    const blockers = await evaluateAuditGates({
      tx: tx as any,
      auditId: "a1",
      orgId: "o1",
      target: "reporting" as AuditStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("unrated_items");
  });

  it("reporting → review: requires conclusion", async () => {
    const tx = mkTx({
      audit: [
        { id: "a1", status: "reporting", lead_auditor_id: "u1", scope_description: "x".repeat(30), conclusion: null },
      ],
      stats: [{ checklist_count: 1, item_count: 10, unrated_items: 0, evidence_count: 5, open_finding_count: 0 }],
    });
    const blockers = await evaluateAuditGates({
      tx: tx as any,
      auditId: "a1",
      orgId: "o1",
      target: "review" as AuditStatus,
    });
    expect(blockers.map((b) => b.code)).toContain("missing_conclusion");
  });

  it("review → completed: warns on open findings + missing report doc", async () => {
    const tx = mkTx({
      audit: [
        {
          id: "a1",
          status: "review",
          lead_auditor_id: "u1",
          scope_description: "x".repeat(30),
          conclusion: "minor_nonconformity",
          report_document_id: null,
        },
      ],
      stats: [{ checklist_count: 1, item_count: 10, unrated_items: 0, evidence_count: 5, open_finding_count: 3 }],
    });
    const blockers = await evaluateAuditGates({
      tx: tx as any,
      auditId: "a1",
      orgId: "o1",
      target: "completed" as AuditStatus,
    });
    const codes = blockers.map((b) => b.code);
    expect(codes).toContain("open_findings");
    expect(codes).toContain("missing_report_document");
    // These are warnings only — completion can still proceed.
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
});
