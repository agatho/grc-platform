import { describe, it, expect } from "vitest";
import {
  BCP_ALLOWED_TRANSITIONS,
  validateBcpGate3Review,
  validateBcpGate5Approval,
  validateBcpGate6Publish,
  validateBcpTransition,
  type BcpSnapshot,
  type PublishContext,
} from "../src/state-machines/bcms-bcp";

const LONG_SCOPE = "x".repeat(80);
const LONG_ACTIVATION = "y".repeat(50);

const validSnapshot: BcpSnapshot = {
  status: "draft",
  title: "BCP-Finance-2026",
  scope: LONG_SCOPE,
  activationCriteria: LONG_ACTIVATION,
  bcManagerId: "00000000-0000-0000-0000-000000000001",
  processIds: ["00000000-0000-0000-0000-000000000002"],
  procedureCount: 5,
  resourceCount: 3,
  approvedBy: null,
  approvedAt: null,
  publishedAt: null,
};

const approvedSnapshot: BcpSnapshot = {
  ...validSnapshot,
  status: "approved",
  approvedBy: "00000000-0000-0000-0000-000000000009",
  approvedAt: new Date(),
};

const validPublishCtx: PublishContext = {
  reportDocumentId: "00000000-0000-0000-0000-000000000aaa",
  physicalStorageLocation: "Hauptverwaltung Raum 3.14, Safe A",
};

describe("BCP_ALLOWED_TRANSITIONS", () => {
  it("draft -> in_review", () => {
    expect(BCP_ALLOWED_TRANSITIONS.draft).toContain("in_review");
  });
  it("in_review -> approved", () => {
    expect(BCP_ALLOWED_TRANSITIONS.in_review).toContain("approved");
  });
  it("approved -> published", () => {
    expect(BCP_ALLOWED_TRANSITIONS.approved).toContain("published");
  });
  it("published -> superseded", () => {
    expect(BCP_ALLOWED_TRANSITIONS.published).toContain("superseded");
  });
  it("archived terminal", () => {
    expect(BCP_ALLOWED_TRANSITIONS.archived).toEqual([]);
  });
});

describe("validateBcpGate3Review", () => {
  it("passes with valid snapshot", () => {
    const blockers = validateBcpGate3Review(validSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks if procedure count < 3", () => {
    const blockers = validateBcpGate3Review({
      ...validSnapshot,
      procedureCount: 2,
    });
    expect(blockers.some((b) => b.code === "too_few_procedures")).toBe(true);
  });
  it("blocks if scope too short", () => {
    const blockers = validateBcpGate3Review({
      ...validSnapshot,
      scope: "short",
    });
    expect(blockers.some((b) => b.code === "scope_too_short")).toBe(true);
  });
  it("blocks if activationCriteria too short", () => {
    const blockers = validateBcpGate3Review({
      ...validSnapshot,
      activationCriteria: "short",
    });
    expect(blockers.some((b) => b.code === "missing_activation_criteria")).toBe(
      true,
    );
  });
  it("blocks if bcManager missing", () => {
    const blockers = validateBcpGate3Review({
      ...validSnapshot,
      bcManagerId: null,
    });
    expect(blockers.some((b) => b.code === "missing_bc_manager")).toBe(true);
  });
  it("warns if no resources", () => {
    const blockers = validateBcpGate3Review({
      ...validSnapshot,
      resourceCount: 0,
    });
    const warn = blockers.find((b) => b.code === "no_resources");
    expect(warn?.severity).toBe("warning");
  });
  it("warns if no processes linked", () => {
    const blockers = validateBcpGate3Review({
      ...validSnapshot,
      processIds: [],
    });
    const warn = blockers.find((b) => b.code === "no_processes_linked");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateBcpGate5Approval", () => {
  it("passes with approver + valid snapshot", () => {
    const blockers = validateBcpGate5Approval(validSnapshot, "approver-uuid");
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks without approver", () => {
    const blockers = validateBcpGate5Approval(validSnapshot, null);
    expect(blockers.some((b) => b.code === "missing_approver")).toBe(true);
  });
  it("inherits B3-hardchecks", () => {
    const blockers = validateBcpGate5Approval(
      { ...validSnapshot, procedureCount: 1 },
      "approver-uuid",
    );
    expect(blockers.some((b) => b.code === "too_few_procedures")).toBe(true);
  });
});

describe("validateBcpGate6Publish", () => {
  it("passes when approved + pdf + storage", () => {
    const blockers = validateBcpGate6Publish(approvedSnapshot, validPublishCtx);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks if not approved", () => {
    const blockers = validateBcpGate6Publish(validSnapshot, validPublishCtx);
    expect(blockers.some((b) => b.code === "not_approved")).toBe(true);
  });
  it("blocks if no pdf export", () => {
    const blockers = validateBcpGate6Publish(approvedSnapshot, {
      reportDocumentId: null,
      physicalStorageLocation: validPublishCtx.physicalStorageLocation,
    });
    expect(blockers.some((b) => b.code === "missing_pdf_export")).toBe(true);
  });
  it("warns if no physical storage", () => {
    const blockers = validateBcpGate6Publish(approvedSnapshot, {
      reportDocumentId: validPublishCtx.reportDocumentId,
      physicalStorageLocation: null,
    });
    const warn = blockers.find((b) => b.code === "missing_physical_storage");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateBcpTransition", () => {
  it("blocks invalid transitions (draft -> approved)", () => {
    const result = validateBcpTransition({
      currentStatus: "draft",
      targetStatus: "approved",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers[0].code).toBe("invalid_transition");
  });
  it("runs B3 on draft -> in_review", () => {
    const result = validateBcpTransition({
      currentStatus: "draft",
      targetStatus: "in_review",
      snapshot: { ...validSnapshot, procedureCount: 1 },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "B3")).toBe(true);
  });
  it("allows draft -> in_review when B3 passes", () => {
    const result = validateBcpTransition({
      currentStatus: "draft",
      targetStatus: "in_review",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
  it("runs B5 on in_review -> approved", () => {
    const result = validateBcpTransition({
      currentStatus: "in_review",
      targetStatus: "approved",
      snapshot: validSnapshot,
      approverUserId: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "B5")).toBe(true);
  });
  it("runs B6 on approved -> published", () => {
    const result = validateBcpTransition({
      currentStatus: "approved",
      targetStatus: "published",
      snapshot: approvedSnapshot,
      publishCtx: { reportDocumentId: null, physicalStorageLocation: null },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "B6")).toBe(true);
  });
  it("allows approved -> published with valid publishCtx", () => {
    const result = validateBcpTransition({
      currentStatus: "approved",
      targetStatus: "published",
      snapshot: approvedSnapshot,
      publishCtx: validPublishCtx,
    });
    expect(result.allowed).toBe(true);
  });
});
