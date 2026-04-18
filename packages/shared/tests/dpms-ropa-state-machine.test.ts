import { describe, it, expect } from "vitest";
import {
  ROPA_ALLOWED_TRANSITIONS,
  validateRopaGate1Activate,
  validateRopaTransition,
  countDpiaFlags,
  isDpiaRequired,
  type RopaSnapshot,
  type DpiaCriteriaFlags,
} from "../src/state-machines/dpms-ropa";

const LONG_PURPOSE = "Verarbeitung personenbezogener Daten im Rahmen der Kunden-Akquise und Vertragsabwicklung.";

const validSnapshot: RopaSnapshot = {
  status: "draft",
  purposeTitle: "Kundenverwaltung CRM",
  purposeDescription: LONG_PURPOSE,
  legalBasis: "contract",
  dataCategoryCount: 3,
  dataSubjectCount: 1,
  recipientCount: 2,
  hasDpiaRequired: false,
  dpiaId: null,
  hasCrossBorderTransfer: false,
  hasTiaLinked: false,
  reviewedBy: "dpo-uuid",
  reviewedAt: new Date(),
};

describe("ROPA_ALLOWED_TRANSITIONS", () => {
  it("draft -> active", () => {
    expect(ROPA_ALLOWED_TRANSITIONS.draft).toContain("active");
  });
  it("active -> under_review + archived", () => {
    expect(ROPA_ALLOWED_TRANSITIONS.active).toContain("under_review");
    expect(ROPA_ALLOWED_TRANSITIONS.active).toContain("archived");
  });
  it("archived terminal", () => {
    expect(ROPA_ALLOWED_TRANSITIONS.archived).toEqual([]);
  });
});

describe("validateRopaGate1Activate", () => {
  it("passes with valid snapshot", () => {
    const blockers = validateRopaGate1Activate(validSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks missing purpose title", () => {
    const blockers = validateRopaGate1Activate({ ...validSnapshot, purposeTitle: null });
    expect(blockers.some((b) => b.code === "missing_purpose_title")).toBe(true);
  });
  it("blocks purpose description < 50 chars", () => {
    const blockers = validateRopaGate1Activate({
      ...validSnapshot,
      purposeDescription: "too short",
    });
    expect(blockers.some((b) => b.code === "purpose_description_too_short")).toBe(true);
  });
  it("blocks no data categories", () => {
    const blockers = validateRopaGate1Activate({ ...validSnapshot, dataCategoryCount: 0 });
    expect(blockers.some((b) => b.code === "no_data_categories")).toBe(true);
  });
  it("blocks dpia_required without dpiaId", () => {
    const blockers = validateRopaGate1Activate({
      ...validSnapshot,
      hasDpiaRequired: true,
      dpiaId: null,
    });
    expect(blockers.some((b) => b.code === "dpia_required_not_linked")).toBe(true);
  });
  it("blocks cross-border without TIA", () => {
    const blockers = validateRopaGate1Activate({
      ...validSnapshot,
      hasCrossBorderTransfer: true,
      hasTiaLinked: false,
    });
    expect(blockers.some((b) => b.code === "cross_border_without_tia")).toBe(true);
  });
  it("blocks missing DPO review", () => {
    const blockers = validateRopaGate1Activate({
      ...validSnapshot,
      reviewedBy: null,
      reviewedAt: null,
    });
    expect(blockers.some((b) => b.code === "missing_dpo_review")).toBe(true);
  });
  it("warns no recipients", () => {
    const blockers = validateRopaGate1Activate({ ...validSnapshot, recipientCount: 0 });
    const warn = blockers.find((b) => b.code === "no_recipients");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateRopaTransition", () => {
  it("blocks draft -> under_review directly", () => {
    const result = validateRopaTransition({
      currentStatus: "draft",
      targetStatus: "under_review",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(false);
  });
  it("allows draft -> active when G1 passes", () => {
    const result = validateRopaTransition({
      currentStatus: "draft",
      targetStatus: "active",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
  it("blocks draft -> active when G1 fails", () => {
    const result = validateRopaTransition({
      currentStatus: "draft",
      targetStatus: "active",
      snapshot: { ...validSnapshot, reviewedBy: null, reviewedAt: null },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "G1")).toBe(true);
  });
});

describe("DPIA Flags", () => {
  const allFalse: DpiaCriteriaFlags = {
    systematicMonitoring: false,
    specialCategories: false,
    largeScale: false,
    dataMatching: false,
    vulnerableSubjects: false,
    innovativeTech: false,
    denyRightExercise: false,
    automatedDecisionLegal: false,
    biometricGenetic: false,
  };

  it("counts correctly", () => {
    expect(countDpiaFlags(allFalse)).toBe(0);
    expect(
      countDpiaFlags({
        ...allFalse,
        systematicMonitoring: true,
        largeScale: true,
        vulnerableSubjects: true,
      }),
    ).toBe(3);
  });

  it("isDpiaRequired: 0 flags = false", () => {
    expect(isDpiaRequired(allFalse)).toBe(false);
  });

  it("isDpiaRequired: 1 flag = false", () => {
    expect(isDpiaRequired({ ...allFalse, specialCategories: true })).toBe(false);
  });

  it("isDpiaRequired: 2 flags = true", () => {
    expect(
      isDpiaRequired({ ...allFalse, specialCategories: true, largeScale: true }),
    ).toBe(true);
  });

  it("isDpiaRequired: all flags = true", () => {
    const allTrue = Object.fromEntries(
      Object.keys(allFalse).map((k) => [k, true]),
    ) as unknown as DpiaCriteriaFlags;
    expect(isDpiaRequired(allTrue)).toBe(true);
  });
});
