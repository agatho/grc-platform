import { describe, it, expect } from "vitest";
import {
  aggregateCrossFindings,
  prioritizeFindings,
  normalizeIcsFindingSeverity,
  normalizeIcsFindingStatus,
  normalizeIsmsNcSeverity,
  normalizeAiIncidentSeverity,
  normalizeBreachSeverity,
  type CrossModuleFinding,
} from "../src/state-machines/cross-findings";

describe("severity normalizers", () => {
  it("ICS significant_nonconformity => high", () => {
    expect(normalizeIcsFindingSeverity("significant_nonconformity")).toBe(
      "high",
    );
  });
  it("ICS observation => observation", () => {
    expect(normalizeIcsFindingSeverity("observation")).toBe("observation");
  });
  it("ICS status identified => open", () => {
    expect(normalizeIcsFindingStatus("identified")).toBe("open");
  });
  it("ICS status remediated => resolved", () => {
    expect(normalizeIcsFindingStatus("remediated")).toBe("resolved");
  });
  it("ISMS major => high", () => {
    expect(normalizeIsmsNcSeverity("major")).toBe("high");
  });
  it("AI serious incident => critical", () => {
    expect(normalizeAiIncidentSeverity(true, "medium")).toBe("critical");
  });
  it("breach high risk => critical", () => {
    expect(normalizeBreachSeverity("high")).toBe("critical");
  });
});

describe("aggregateCrossFindings", () => {
  const now = new Date("2026-04-19T12:00:00Z");

  const mk = (overrides: Partial<CrossModuleFinding>): CrossModuleFinding => ({
    id: "f1",
    sourceId: "s1",
    module: "ics",
    title: "Finding",
    severity: "medium",
    status: "open",
    identifiedAt: new Date("2026-04-10T00:00:00Z"),
    dueDate: null,
    ownerId: null,
    linkPath: "/",
    ...overrides,
  });

  it("empty list", () => {
    const r = aggregateCrossFindings([], now);
    expect(r.total).toBe(0);
    expect(r.openCount).toBe(0);
    expect(r.oldestOpenAgeDays).toBeNull();
  });

  it("counts by module, severity, status", () => {
    const findings = [
      mk({ id: "1", module: "ics", severity: "high", status: "open" }),
      mk({
        id: "2",
        module: "ai_act_incident",
        severity: "critical",
        status: "open",
      }),
      mk({ id: "3", module: "isms_cap", severity: "medium", status: "closed" }),
      mk({
        id: "4",
        module: "dpms_breach",
        severity: "critical",
        status: "resolved",
      }),
    ];
    const r = aggregateCrossFindings(findings, now);
    expect(r.total).toBe(4);
    expect(r.byModule.ics).toBe(1);
    expect(r.byModule.ai_act_incident).toBe(1);
    expect(r.bySeverity.critical).toBe(2);
    expect(r.byStatus.open).toBe(2);
    expect(r.byStatus.closed).toBe(1);
    expect(r.openCount).toBe(2);
    expect(r.criticalOpenCount).toBe(1);
  });

  it("overdue detected via dueDate < now", () => {
    const past = new Date("2026-04-01T00:00:00Z");
    const future = new Date("2026-05-01T00:00:00Z");
    const findings = [
      mk({ id: "1", status: "open", dueDate: past }),
      mk({ id: "2", status: "open", dueDate: future }),
      mk({ id: "3", status: "closed", dueDate: past }), // closed => not overdue
    ];
    const r = aggregateCrossFindings(findings, now);
    expect(r.overdueCount).toBe(1);
    expect(r.openCount).toBe(2);
  });

  it("oldestOpenAgeDays computed from oldest open finding", () => {
    const findings = [
      mk({
        id: "1",
        status: "open",
        identifiedAt: new Date("2026-03-01T00:00:00Z"),
      }),
      mk({
        id: "2",
        status: "open",
        identifiedAt: new Date("2026-04-15T00:00:00Z"),
      }),
    ];
    const r = aggregateCrossFindings(findings, now);
    expect(r.oldestOpenAgeDays).toBeGreaterThanOrEqual(48);
  });
});

describe("prioritizeFindings", () => {
  const now = new Date("2026-04-19T12:00:00Z");

  const mk = (overrides: Partial<CrossModuleFinding>): CrossModuleFinding => ({
    id: "f1",
    sourceId: "s1",
    module: "ics",
    title: "Finding",
    severity: "medium",
    status: "open",
    identifiedAt: new Date("2026-04-10T00:00:00Z"),
    dueDate: null,
    ownerId: null,
    linkPath: "/",
    ...overrides,
  });

  it("critical outranks high outranks medium outranks low outranks observation", () => {
    const findings = [
      mk({ id: "a", severity: "observation" }),
      mk({ id: "b", severity: "low" }),
      mk({ id: "c", severity: "medium" }),
      mk({ id: "d", severity: "high" }),
      mk({ id: "e", severity: "critical" }),
    ];
    const r = prioritizeFindings(findings, now);
    expect(r[0].id).toBe("e");
    expect(r[4].id).toBe("a");
  });

  it("overdue boost elevates same severity above non-overdue", () => {
    const past = new Date("2026-04-01T00:00:00Z");
    const findings = [
      mk({ id: "a", severity: "medium", dueDate: past }),
      mk({ id: "b", severity: "medium", dueDate: null }),
    ];
    const r = prioritizeFindings(findings, now);
    expect(r[0].id).toBe("a");
    expect(r[0].isOverdue).toBe(true);
  });

  it("> 30d overdue gets highest boost", () => {
    const longOverdue = new Date("2026-02-01T00:00:00Z");
    const recentOverdue = new Date("2026-04-15T00:00:00Z");
    const findings = [
      mk({ id: "a", severity: "medium", dueDate: recentOverdue }),
      mk({ id: "b", severity: "medium", dueDate: longOverdue }),
    ];
    const r = prioritizeFindings(findings, now);
    expect(r[0].id).toBe("b");
  });

  it("age boost capped at +0.5", () => {
    const veryOld = new Date("2025-01-01T00:00:00Z");
    const f = mk({
      id: "a",
      severity: "high",
      identifiedAt: veryOld,
      dueDate: null,
    });
    const [scored] = prioritizeFindings([f], now);
    // severity=high (70) * (1 + 0.5) = 105 max without overdue
    expect(scored.priorityScore).toBeLessThanOrEqual(105);
    expect(scored.priorityScore).toBeGreaterThanOrEqual(100);
    expect(scored.daysOpen).toBeGreaterThan(400);
  });

  it("critical overdue > 30d reaches max score", () => {
    const longOverdue = new Date("2026-01-01T00:00:00Z");
    const veryOld = new Date("2025-01-01T00:00:00Z");
    const f = mk({
      id: "a",
      severity: "critical",
      identifiedAt: veryOld,
      dueDate: longOverdue,
    });
    const [scored] = prioritizeFindings([f], now);
    // 100 * 1.5 * 2.0 = 300
    expect(scored.priorityScore).toBe(300);
  });
});
