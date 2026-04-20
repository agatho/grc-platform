import { describe, it, expect } from "vitest";
import {
  AVV_ALLOWED_TRANSITIONS,
  validateAvvGateActivate,
  validateAvvTransition,
  checkAvvReviewStatus,
  type AvvSnapshot,
} from "../src/state-machines/dpms-avv";

const activateSnapshot: AvvSnapshot = {
  agreementStatus: "signed",
  processorName: "AWS Inc.",
  processorDpoContact: "dpo@aws.example.com",
  processingActivities: ["Hosting", "Backup-Storage"],
  agreementDocumentId: "doc-uuid",
  effectiveDate: "2026-01-01",
  expiryDate: "2027-12-31",
  reviewDate: "2026-06-01",
  overallComplianceStatus: "compliant",
};

describe("AVV_ALLOWED_TRANSITIONS", () => {
  it("pending -> negotiated", () => {
    expect(AVV_ALLOWED_TRANSITIONS.pending).toContain("negotiated");
  });
  it("signed -> active", () => {
    expect(AVV_ALLOWED_TRANSITIONS.signed).toContain("active");
  });
  it("expired allows re-activation", () => {
    expect(AVV_ALLOWED_TRANSITIONS.expired).toContain("active");
  });
  it("terminated terminal", () => {
    expect(AVV_ALLOWED_TRANSITIONS.terminated).toEqual([]);
  });
});

describe("validateAvvGateActivate", () => {
  it("passes with full snapshot", () => {
    const blockers = validateAvvGateActivate(activateSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks missing DPO contact", () => {
    const blockers = validateAvvGateActivate({
      ...activateSnapshot,
      processorDpoContact: null,
    });
    expect(blockers.some((b) => b.code === "missing_dpo_contact")).toBe(true);
  });
  it("blocks empty processing activities", () => {
    const blockers = validateAvvGateActivate({
      ...activateSnapshot,
      processingActivities: [],
    });
    expect(
      blockers.some((b) => b.code === "missing_processing_activities"),
    ).toBe(true);
  });
  it("blocks no signed document", () => {
    const blockers = validateAvvGateActivate({
      ...activateSnapshot,
      agreementDocumentId: null,
    });
    expect(blockers.some((b) => b.code === "missing_agreement_document")).toBe(
      true,
    );
  });
  it("warns missing expiry", () => {
    const blockers = validateAvvGateActivate({
      ...activateSnapshot,
      expiryDate: null,
    });
    const warn = blockers.find((b) => b.code === "missing_expiry_date");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateAvvTransition", () => {
  it("blocks pending -> active directly", () => {
    const result = validateAvvTransition({
      currentStatus: "pending",
      targetStatus: "active",
      snapshot: activateSnapshot,
    });
    expect(result.allowed).toBe(false);
  });
  it("allows signed -> active when gate passes", () => {
    const result = validateAvvTransition({
      currentStatus: "signed",
      targetStatus: "active",
      snapshot: activateSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("checkAvvReviewStatus", () => {
  it("not overdue if < 365d", () => {
    const rev = new Date();
    rev.setDate(rev.getDate() - 100);
    const s = checkAvvReviewStatus(rev, null);
    expect(s.overdueForReview).toBe(false);
  });
  it("overdue after 400d", () => {
    const rev = new Date();
    rev.setDate(rev.getDate() - 400);
    const s = checkAvvReviewStatus(rev, null);
    expect(s.overdueForReview).toBe(true);
  });
  it("flags expiring soon < 90d", () => {
    const exp = new Date();
    exp.setDate(exp.getDate() + 60);
    const s = checkAvvReviewStatus(null, exp);
    expect(s.expiringSoon).toBe(true);
  });
  it("not expiring soon > 90d", () => {
    const exp = new Date();
    exp.setDate(exp.getDate() + 200);
    const s = checkAvvReviewStatus(null, exp);
    expect(s.expiringSoon).toBe(false);
  });
});
