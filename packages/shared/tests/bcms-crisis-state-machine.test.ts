import { describe, it, expect } from "vitest";
import {
  CRISIS_ALLOWED_TRANSITIONS,
  validateCrisisGate9Activate,
  validateCrisisGate10Resolve,
  validateCrisisTransition,
  computeDoraDeadlines,
  type CrisisSnapshot,
} from "../src/state-machines/bcms-crisis";

const standbySnapshot: CrisisSnapshot = {
  status: "standby",
  name: "Ransomware-Krise 2026-Q2",
  severity: "level_3_crisis",
  bcpId: "bcp-uuid",
  activatedAt: null,
  activatedBy: null,
  resolvedAt: null,
  postMortemNotes: null,
  logEntryCount: 0,
  communicationCount: 0,
};

const activatedSnapshot: CrisisSnapshot = {
  ...standbySnapshot,
  status: "activated",
  activatedAt: new Date(),
  activatedBy: "user-uuid",
  logEntryCount: 3,
  communicationCount: 2,
};

describe("CRISIS_ALLOWED_TRANSITIONS", () => {
  it("standby -> activated only", () => {
    expect(CRISIS_ALLOWED_TRANSITIONS.standby).toEqual(["activated"]);
  });
  it("activated -> resolved only", () => {
    expect(CRISIS_ALLOWED_TRANSITIONS.activated).toEqual(["resolved"]);
  });
  it("resolved -> post_mortem only", () => {
    expect(CRISIS_ALLOWED_TRANSITIONS.resolved).toEqual(["post_mortem"]);
  });
  it("post_mortem -> standby (next cycle)", () => {
    expect(CRISIS_ALLOWED_TRANSITIONS.post_mortem).toEqual(["standby"]);
  });
});

describe("validateCrisisGate9Activate", () => {
  it("passes with user + severity + bcp", () => {
    const blockers = validateCrisisGate9Activate(standbySnapshot, "user-uuid");
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks without activating user", () => {
    const blockers = validateCrisisGate9Activate(standbySnapshot, null);
    expect(blockers.some((b) => b.code === "missing_activator")).toBe(true);
  });
  it("blocks without severity", () => {
    const blockers = validateCrisisGate9Activate({ ...standbySnapshot, severity: null }, "uuid");
    expect(blockers.some((b) => b.code === "missing_severity")).toBe(true);
  });
  it("warns without linked BCP", () => {
    const blockers = validateCrisisGate9Activate({ ...standbySnapshot, bcpId: null }, "uuid");
    const warn = blockers.find((b) => b.code === "no_bcp_linked");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateCrisisGate10Resolve", () => {
  it("passes activated + logs + comms", () => {
    const blockers = validateCrisisGate10Resolve(activatedSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks not activated", () => {
    const blockers = validateCrisisGate10Resolve({ ...activatedSnapshot, activatedAt: null });
    expect(blockers.some((b) => b.code === "not_activated")).toBe(true);
  });
  it("blocks no log entries", () => {
    const blockers = validateCrisisGate10Resolve({ ...activatedSnapshot, logEntryCount: 0 });
    expect(blockers.some((b) => b.code === "no_crisis_log_entries")).toBe(true);
  });
  it("warns no communication log", () => {
    const blockers = validateCrisisGate10Resolve({ ...activatedSnapshot, communicationCount: 0 });
    const warn = blockers.find((b) => b.code === "no_communication_log");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateCrisisTransition", () => {
  it("blocks standby -> resolved", () => {
    const result = validateCrisisTransition({
      currentStatus: "standby",
      targetStatus: "resolved",
      snapshot: standbySnapshot,
    });
    expect(result.allowed).toBe(false);
  });
  it("allows standby -> activated with validator", () => {
    const result = validateCrisisTransition({
      currentStatus: "standby",
      targetStatus: "activated",
      snapshot: standbySnapshot,
      activatingUserId: "uuid",
    });
    expect(result.allowed).toBe(true);
  });
  it("allows activated -> resolved with logs", () => {
    const result = validateCrisisTransition({
      currentStatus: "activated",
      targetStatus: "resolved",
      snapshot: activatedSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("computeDoraDeadlines", () => {
  const classifiedAt = new Date("2026-04-18T10:00:00Z");

  it("computes all 3 deadlines correctly", () => {
    const d = computeDoraDeadlines(classifiedAt, new Date("2026-04-18T10:30:00Z"));
    expect(d.earlyWarningDueAt.toISOString()).toBe("2026-04-18T14:00:00.000Z"); // +4h
    expect(d.intermediateReportDueAt.toISOString()).toBe("2026-04-21T10:00:00.000Z"); // +72h
    expect(d.finalReportDueAt.toISOString()).toBe("2026-05-18T10:00:00.000Z"); // +1m
  });

  it("flags all as not-overdue shortly after classification", () => {
    const d = computeDoraDeadlines(classifiedAt, new Date("2026-04-18T10:30:00Z"));
    expect(d.earlyWarningOverdue).toBe(false);
    expect(d.intermediateOverdue).toBe(false);
    expect(d.finalOverdue).toBe(false);
    expect(d.nextDeadlineLabel).toBe("early_warning");
  });

  it("flags early warning overdue after 5h", () => {
    const d = computeDoraDeadlines(classifiedAt, new Date("2026-04-18T15:00:00Z"));
    expect(d.earlyWarningOverdue).toBe(true);
    expect(d.nextDeadlineLabel).toBe("intermediate");
  });

  it("flags intermediate overdue after 73h", () => {
    const d = computeDoraDeadlines(classifiedAt, new Date("2026-04-21T11:00:00Z"));
    expect(d.intermediateOverdue).toBe(true);
    expect(d.nextDeadlineLabel).toBe("final");
  });

  it("flags final overdue after 1 month+1d", () => {
    const d = computeDoraDeadlines(classifiedAt, new Date("2026-05-19T11:00:00Z"));
    expect(d.finalOverdue).toBe(true);
    expect(d.nextDeadlineLabel).toBe("none");
    expect(d.secondsToNextDeadline).toBe(null);
  });
});
