// BPM Overhaul Phase 3: RACM aggregation logic test.
//
// Mocks the result of the four DB queries the RACM route runs and asserts
// the grouping logic produces correct counts.

import { describe, it, expect } from "vitest";

// Reimplement the grouping logic locally so we can test it pure-functionally.
// Keep in sync with apps/web/src/app/api/v1/processes/[id]/racm/route.ts.

interface StepRisk {
  stepId: string;
  bpmnElementId: string;
  stepName: string | null;
  lineOfDefense: string | null;
  riskId: string | null;
  riskTitle: string | null;
  inherent: number | null;
  residual: number | null;
  riskStatus: string | null;
}

interface StepControl {
  stepId: string;
  controlId: string | null;
  controlTitle: string | null;
  controlStatus: string | null;
}

interface Finding {
  id: string;
  title: string;
  severity: string;
  status: string;
  processStepId: string | null;
}

function groupRacmRows(
  stepsWithRisks: StepRisk[],
  stepsWithControls: StepControl[],
  findings: Finding[],
) {
  const byStep = new Map<
    string,
    {
      stepId: string;
      bpmnElementId: string;
      stepName: string | null;
      lineOfDefense: string | null;
      risks: any[];
      controls: any[];
      findings: any[];
    }
  >();
  for (const r of stepsWithRisks) {
    if (!byStep.has(r.stepId)) {
      byStep.set(r.stepId, {
        stepId: r.stepId,
        bpmnElementId: r.bpmnElementId,
        stepName: r.stepName,
        lineOfDefense: r.lineOfDefense,
        risks: [],
        controls: [],
        findings: [],
      });
    }
    if (r.riskId && !byStep.get(r.stepId)!.risks.find((x) => x.id === r.riskId)) {
      byStep.get(r.stepId)!.risks.push({
        id: r.riskId,
        title: r.riskTitle,
        residual: r.residual,
      });
    }
  }
  for (const c of stepsWithControls) {
    if (!c.controlId) continue;
    const row = byStep.get(c.stepId);
    if (row && !row.controls.find((x) => x.id === c.controlId)) {
      row.controls.push({ id: c.controlId, title: c.controlTitle });
    }
  }
  for (const f of findings) {
    if (f.processStepId && byStep.has(f.processStepId)) {
      byStep.get(f.processStepId)!.findings.push(f);
    }
  }
  return Array.from(byStep.values());
}

describe("RACM aggregation", () => {
  it("deduplicates risks per step", () => {
    const rows = groupRacmRows(
      [
        {
          stepId: "s1",
          bpmnElementId: "Task_1",
          stepName: "A",
          lineOfDefense: "first",
          riskId: "r1",
          riskTitle: "Fraud",
          inherent: 10,
          residual: 5,
          riskStatus: "open",
        },
        {
          stepId: "s1",
          bpmnElementId: "Task_1",
          stepName: "A",
          lineOfDefense: "first",
          riskId: "r1",
          riskTitle: "Fraud",
          inherent: 10,
          residual: 5,
          riskStatus: "open",
        },
      ],
      [],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].risks).toHaveLength(1);
  });

  it("includes step even when no risks", () => {
    const rows = groupRacmRows(
      [
        {
          stepId: "s1",
          bpmnElementId: "Task_1",
          stepName: "A",
          lineOfDefense: null,
          riskId: null,
          riskTitle: null,
          inherent: null,
          residual: null,
          riskStatus: null,
        },
      ],
      [],
      [],
    );
    expect(rows[0].risks).toHaveLength(0);
  });

  it("attaches findings to the right step", () => {
    const rows = groupRacmRows(
      [
        {
          stepId: "s1",
          bpmnElementId: "Task_1",
          stepName: "A",
          lineOfDefense: null,
          riskId: null,
          riskTitle: null,
          inherent: null,
          residual: null,
          riskStatus: null,
        },
        {
          stepId: "s2",
          bpmnElementId: "Task_2",
          stepName: "B",
          lineOfDefense: null,
          riskId: null,
          riskTitle: null,
          inherent: null,
          residual: null,
          riskStatus: null,
        },
      ],
      [],
      [
        { id: "f1", title: "Issue", severity: "high", status: "open", processStepId: "s2" },
      ],
    );
    expect(rows.find((r) => r.stepId === "s2")!.findings).toHaveLength(1);
    expect(rows.find((r) => r.stepId === "s1")!.findings).toHaveLength(0);
  });

  it("attaches controls only to their step", () => {
    const rows = groupRacmRows(
      [
        {
          stepId: "s1",
          bpmnElementId: "Task_1",
          stepName: "A",
          lineOfDefense: null,
          riskId: null,
          riskTitle: null,
          inherent: null,
          residual: null,
          riskStatus: null,
        },
      ],
      [{ stepId: "s1", controlId: "c1", controlTitle: "C1", controlStatus: "effective" }],
      [],
    );
    expect(rows[0].controls).toHaveLength(1);
    expect(rows[0].controls[0].title).toBe("C1");
  });
});
