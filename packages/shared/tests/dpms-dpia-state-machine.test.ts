import { describe, it, expect } from "vitest";
import {
  DPIA_ALLOWED_TRANSITIONS,
  validateDpiaGate3Start,
  validateDpiaGate3Complete,
  validateDpiaGate3Approve,
  validateDpiaTransition,
  type DpiaSnapshot,
} from "../src/state-machines/dpms-dpia";

const LONG_TEXT = "x".repeat(150);

const startSnapshot: DpiaSnapshot = {
  status: "draft",
  title: "DPIA Video-Surveillance",
  processingDescription:
    "Kamera-Ueberwachung der Eingaenge mit Gesichtserkennung",
  necessityAssessment: null,
  systematicDescription: null,
  dataCategories: null,
  dataSubjectCategories: null,
  riskCount: 0,
  measureCount: 0,
  mitigatedRiskCount: 0,
  dpoOpinion: null,
  consultationDate: null,
  residualRiskSignOffId: null,
  priorConsultationRequired: false,
};

const completeSnapshot: DpiaSnapshot = {
  ...startSnapshot,
  status: "in_progress",
  systematicDescription: LONG_TEXT,
  necessityAssessment:
    "Rechtmaessig gemaess Art. 6(1)(f) -- Sicherheits-Interesse",
  dataCategories: ["Video", "Biometrisch"],
  dataSubjectCategories: ["Besucher", "Mitarbeiter"],
  riskCount: 3,
  measureCount: 3,
  mitigatedRiskCount: 3,
};

const approveSnapshot: DpiaSnapshot = {
  ...completeSnapshot,
  status: "pending_dpo_review",
  dpoOpinion: "DPO: Massnahmen angemessen, Residualrisiko akzeptabel",
  residualRiskSignOffId: "signoff-uuid",
  consultationDate: "2026-04-18",
};

describe("DPIA_ALLOWED_TRANSITIONS", () => {
  it("draft -> in_progress", () => {
    expect(DPIA_ALLOWED_TRANSITIONS.draft).toEqual(["in_progress"]);
  });
  it("approved allows re-open", () => {
    expect(DPIA_ALLOWED_TRANSITIONS.approved).toContain("in_progress");
  });
  it("rejected allows re-open", () => {
    expect(DPIA_ALLOWED_TRANSITIONS.rejected).toContain("in_progress");
  });
});

describe("validateDpiaGate3Start", () => {
  it("passes with title + description", () => {
    const blockers = validateDpiaGate3Start(startSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks missing title", () => {
    const blockers = validateDpiaGate3Start({ ...startSnapshot, title: null });
    expect(blockers.some((b) => b.code === "missing_title")).toBe(true);
  });
  it("blocks description too short", () => {
    const blockers = validateDpiaGate3Start({
      ...startSnapshot,
      processingDescription: "short",
    });
    expect(
      blockers.some((b) => b.code === "processing_description_too_short"),
    ).toBe(true);
  });
});

describe("validateDpiaGate3Complete", () => {
  it("passes with full snapshot", () => {
    const blockers = validateDpiaGate3Complete(completeSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks no risks", () => {
    const blockers = validateDpiaGate3Complete({
      ...completeSnapshot,
      riskCount: 0,
    });
    expect(blockers.some((b) => b.code === "no_risks")).toBe(true);
  });
  it("blocks no measures", () => {
    const blockers = validateDpiaGate3Complete({
      ...completeSnapshot,
      measureCount: 0,
    });
    expect(blockers.some((b) => b.code === "no_measures")).toBe(true);
  });
  it("blocks no data categories", () => {
    const blockers = validateDpiaGate3Complete({
      ...completeSnapshot,
      dataCategories: [],
    });
    expect(blockers.some((b) => b.code === "missing_data_categories")).toBe(
      true,
    );
  });
  it("warns insufficient mitigation", () => {
    const blockers = validateDpiaGate3Complete({
      ...completeSnapshot,
      riskCount: 10,
      measureCount: 5,
      mitigatedRiskCount: 5,
    });
    const warn = blockers.find((b) => b.code === "insufficient_mitigation");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateDpiaGate3Approve", () => {
  it("passes with opinion + sign-off", () => {
    const blockers = validateDpiaGate3Approve(approveSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks without DPO opinion", () => {
    const blockers = validateDpiaGate3Approve({
      ...approveSnapshot,
      dpoOpinion: null,
    });
    expect(blockers.some((b) => b.code === "missing_dpo_opinion")).toBe(true);
  });
  it("blocks without sign-off", () => {
    const blockers = validateDpiaGate3Approve({
      ...approveSnapshot,
      residualRiskSignOffId: null,
    });
    expect(blockers.some((b) => b.code === "missing_sign_off")).toBe(true);
  });
  it("blocks when prior consultation required but not done", () => {
    const blockers = validateDpiaGate3Approve({
      ...approveSnapshot,
      priorConsultationRequired: true,
      consultationDate: null,
    });
    expect(blockers.some((b) => b.code === "prior_consultation_overdue")).toBe(
      true,
    );
  });
});

describe("validateDpiaTransition", () => {
  it("blocks direct draft -> completed", () => {
    const result = validateDpiaTransition({
      currentStatus: "draft",
      targetStatus: "completed",
      snapshot: startSnapshot,
    });
    expect(result.allowed).toBe(false);
  });
  it("allows draft -> in_progress", () => {
    const result = validateDpiaTransition({
      currentStatus: "draft",
      targetStatus: "in_progress",
      snapshot: startSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
  it("allows in_progress -> completed with full snapshot", () => {
    const result = validateDpiaTransition({
      currentStatus: "in_progress",
      targetStatus: "completed",
      snapshot: completeSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
  it("allows pending_dpo_review -> approved", () => {
    const result = validateDpiaTransition({
      currentStatus: "pending_dpo_review",
      targetStatus: "approved",
      snapshot: approveSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
});
