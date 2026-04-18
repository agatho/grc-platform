import { describe, it, expect } from "vitest";
import {
  BREACH_ALLOWED_TRANSITIONS,
  validateBreachGate9Assess,
  validateBreachGate10NotifyDpa,
  validateBreachGate11NotifyIndividuals,
  validateBreachGate12Close,
  validateBreachTransition,
  computeBreachDeadline,
  type BreachSnapshot,
} from "../src/state-machines/dpms-breach";

const LONG_DESC = "x".repeat(100);

const assessSnapshot: BreachSnapshot = {
  status: "detected",
  title: "Unauth Access Kundendatenbank 2026-Q2",
  description: LONG_DESC,
  severity: "high",
  detectedAt: new Date(),
  dpaNotifiedAt: null,
  individualsNotifiedAt: null,
  isDpaNotificationRequired: true,
  isIndividualNotificationRequired: false,
  dataCategoriesAffected: null,
  estimatedRecordsAffected: null,
  containmentMeasures: null,
  remediationMeasures: null,
};

const dpaSnapshot: BreachSnapshot = {
  ...assessSnapshot,
  status: "assessing",
  dataCategoriesAffected: ["name", "email", "address"],
  estimatedRecordsAffected: 1500,
  containmentMeasures: "Network-Segmentierung der betroffenen DB; Access-Revoke fuer 5 User.",
};

const closeSnapshot: BreachSnapshot = {
  ...dpaSnapshot,
  status: "remediation",
  dpaNotifiedAt: new Date(),
  remediationMeasures: "Patching der Schwachstelle; MFA-Enforcement; Forensic Report.",
};

describe("BREACH_ALLOWED_TRANSITIONS", () => {
  it("detected -> assessing only", () => {
    expect(BREACH_ALLOWED_TRANSITIONS.detected).toEqual(["assessing"]);
  });
  it("closed terminal", () => {
    expect(BREACH_ALLOWED_TRANSITIONS.closed).toEqual([]);
  });
});

describe("validateBreachGate9Assess", () => {
  it("passes with title+description+detectedAt", () => {
    const blockers = validateBreachGate9Assess(assessSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks missing detectedAt", () => {
    const blockers = validateBreachGate9Assess({ ...assessSnapshot, detectedAt: null });
    expect(blockers.some((b) => b.code === "missing_detected_at")).toBe(true);
  });
});

describe("validateBreachGate10NotifyDpa", () => {
  it("passes with full data", () => {
    const blockers = validateBreachGate10NotifyDpa(dpaSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks missing data_categories", () => {
    const blockers = validateBreachGate10NotifyDpa({ ...dpaSnapshot, dataCategoriesAffected: null });
    expect(blockers.some((b) => b.code === "missing_data_categories")).toBe(true);
  });
  it("blocks missing containment", () => {
    const blockers = validateBreachGate10NotifyDpa({ ...dpaSnapshot, containmentMeasures: null });
    expect(blockers.some((b) => b.code === "missing_containment")).toBe(true);
  });
  it("warns about 72h overdue", () => {
    const old = new Date();
    old.setHours(old.getHours() - 80);
    const blockers = validateBreachGate10NotifyDpa({ ...dpaSnapshot, detectedAt: old });
    const warn = blockers.find((b) => b.code === "72h_deadline_exceeded");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateBreachGate11NotifyIndividuals", () => {
  it("warns when high-severity but individual-not-required", () => {
    const blockers = validateBreachGate11NotifyIndividuals({
      ...dpaSnapshot,
      severity: "high",
      isIndividualNotificationRequired: false,
    });
    const warn = blockers.find((b) => b.code === "high_severity_requires_individual_notification");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateBreachGate12Close", () => {
  it("passes with remediation + dpa_notified", () => {
    const blockers = validateBreachGate12Close(closeSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks DPA-required but not notified", () => {
    const blockers = validateBreachGate12Close({
      ...closeSnapshot,
      dpaNotifiedAt: null,
    });
    expect(blockers.some((b) => b.code === "dpa_notification_required_but_missing")).toBe(true);
  });
});

describe("validateBreachTransition", () => {
  it("blocks detected -> closed", () => {
    const result = validateBreachTransition({
      currentStatus: "detected",
      targetStatus: "closed",
      snapshot: assessSnapshot,
    });
    expect(result.allowed).toBe(false);
  });
  it("allows detected -> assessing", () => {
    const result = validateBreachTransition({
      currentStatus: "detected",
      targetStatus: "assessing",
      snapshot: assessSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("computeBreachDeadline", () => {
  it("72h deadline correctly", () => {
    const detected = new Date("2026-04-18T10:00:00Z");
    const d = computeBreachDeadline(detected, new Date("2026-04-18T11:00:00Z"));
    expect(d.deadlineAt.toISOString()).toBe("2026-04-21T10:00:00.000Z");
    expect(d.overdue).toBe(false);
    expect(d.urgency).toBe("green");
  });
  it("flags red after 73h", () => {
    const detected = new Date("2026-04-18T10:00:00Z");
    const d = computeBreachDeadline(detected, new Date("2026-04-21T11:00:00Z"));
    expect(d.overdue).toBe(true);
    expect(d.urgency).toBe("red");
  });
  it("red when < 6h remaining", () => {
    const detected = new Date();
    detected.setHours(detected.getHours() - 68);
    const d = computeBreachDeadline(detected);
    expect(d.urgency).toBe("red");
  });
});
