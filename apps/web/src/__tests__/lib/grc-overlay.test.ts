/**
 * Der Rechenkern des Overlay-Endpunkts (Plan §3.3.6).
 *
 * Geprüft wird hier, was ohne Datenbank prüfbar ist — und das ist der Teil, an
 * dem die fachlichen Entscheidungen hängen: die Zuordnung der zehn
 * ISO-19011-Schweregrade auf die vier Stufen des Vertrags, der Join
 * `process_step_risk ⋈ risk_control ⋈ process_step_control`, der Roll-up eines
 * aufgerufenen Prozesses und — der wichtigste Block — dass jedes Feld, das
 * `MISSING_TODAY` als „heute nicht befüllbar" führt, im Ergebnis tatsächlich
 * **fehlt**, statt still mit einem Ersatzwert dazustehen.
 */

import { describe, it, expect } from "vitest";
import {
  buildDiagramOverlay,
  toSeverity,
  toCoverage,
  MISSING_TODAY,
  type OverlayQueryResult,
} from "@/lib/grc-overlay";

const AT = "2026-09-02T10:00:00Z";

function rows(partial: Partial<OverlayQueryResult> = {}): OverlayQueryResult {
  return {
    steps: [],
    risks: [],
    controls: [],
    riskControls: [],
    findings: [],
    assets: [],
    roles: [],
    comments: [],
    frameworks: [],
    simulation: [],
    dmn: [],
    calledProcesses: [],
    ...partial,
  };
}

const STEP = {
  id: "step-1",
  bpmnElementId: "Task_1",
  lineOfDefense: null,
  calledProcessId: null,
  raciResponsibleRoleId: null,
  raciAccountableRoleId: null,
};

function build(partial: Partial<OverlayQueryResult>) {
  return buildDiagramOverlay(rows(partial), {
    computedAt: AT,
    processId: "proc-1",
    processName: "Beschaffung",
  });
}

describe("buildDiagramOverlay", () => {
  it("liefert computedAt und den Prozessbezug, auch ohne einen einzigen Schritt", () => {
    const out = build({});
    expect(out.computedAt).toBe(AT);
    expect(out.elements).toEqual({});
    expect(out.diagram?.processId).toBe("proc-1");
    expect(out.diagram?.processName).toBe("Beschaffung");
    // `asOf` ist der Bezugszeitpunkt jeder Fristenrechnung der GRC-Schicht.
    expect(out.diagram?.asOf).toBe(AT);
  });

  it("schlüsselt nach BPMN-Element-ID, nicht nach process_step.id", () => {
    const out = build({
      steps: [STEP],
      risks: [
        {
          processStepId: "step-1",
          riskId: "r1",
          title: "Doppelzahlung",
          residualScore: 12,
          inherentScore: 20,
          ownerName: "A. Beispiel",
          treatmentStrategy: "mitigate",
        },
      ],
    });
    expect(Object.keys(out.elements)).toEqual(["Task_1"]);
    expect(out.elements["Task_1"]?.risks?.[0]).toEqual({
      id: "r1",
      title: "Doppelzahlung",
      residualScore: 12,
      inherentScore: 20,
      owner: "A. Beispiel",
      treatment: "mitigate",
    });
  });

  it("ignoriert Zeilen zu Schritten ohne BPMN-Element-ID", () => {
    const out = build({
      steps: [{ ...STEP, bpmnElementId: null }],
      findings: [
        {
          processStepId: "step-1",
          id: "f1",
          title: "x",
          severity: "major_nonconformity",
          status: "identified",
          dueAt: null,
        },
      ],
    });
    expect(out.elements).toEqual({});
  });

  describe("der Join aus §3.3.6 — risks[].controlIds", () => {
    const base = {
      steps: [STEP],
      risks: [
        {
          processStepId: "step-1",
          riskId: "r1",
          title: "R",
          residualScore: 9,
          inherentScore: null,
          ownerName: null,
          treatmentStrategy: null,
        },
      ],
      controls: [
        {
          processStepId: "step-1",
          controlId: "c1",
          title: "Vier-Augen-Prinzip",
          status: "effective",
          lastTestedAt: null,
          lastTestResult: null,
          lastEvidenceAt: null,
        },
      ],
    };

    it("verknüpft nur Kontrollen, die das Risiko behandeln UND am Schritt hängen", () => {
      const out = build({
        ...base,
        riskControls: [{ riskId: "r1", controlId: "c1" }],
      });
      expect(out.elements["Task_1"]?.risks?.[0]?.controlIds).toEqual(["c1"]);
    });

    it("lässt controlIds weg, wenn die Kontrolle das Risiko woanders behandelt", () => {
      // `risk_control` ist global; eine Kontrolle, die an einem anderen Schritt
      // hängt, deckt diesen Schritt nicht ab. Ohne den Schnitt wäre die
      // Abdeckungsampel (F1) systematisch zu grün.
      const out = build({
        ...base,
        riskControls: [{ riskId: "r1", controlId: "c-anderswo" }],
      });
      expect(out.elements["Task_1"]?.risks?.[0]?.controlIds).toBeUndefined();
    });

    it("liefert die Kontroll-IDs sortiert — gleiche Zeilen, gleiches Bild", () => {
      const out = build({
        ...base,
        controls: [
          ...base.controls,
          {
            processStepId: "step-1",
            controlId: "c0",
            title: "Freigabe",
            status: "designed",
            lastTestedAt: null,
            lastTestResult: null,
            lastEvidenceAt: null,
          },
        ],
        riskControls: [
          { riskId: "r1", controlId: "c1" },
          { riskId: "r1", controlId: "c0" },
        ],
      });
      expect(out.elements["Task_1"]?.risks?.[0]?.controlIds).toEqual([
        "c0",
        "c1",
      ]);
    });
  });

  describe("Kontrollen", () => {
    const control = {
      processStepId: "step-1",
      controlId: "c1",
      title: "Vier-Augen-Prinzip",
      status: "designed",
      lastTestedAt: null as string | null,
      lastTestResult: null as string | null,
      lastEvidenceAt: null as string | null,
    };

    it("wertet nur status='effective' als wirksam — wie GET /control-coverage", () => {
      for (const [status, expected] of [
        ["effective", "effective"],
        ["ineffective", "ineffective"],
        ["designed", "untested"],
        ["implemented", "untested"],
        ["retired", "untested"],
      ] as const) {
        const out = build({
          steps: [STEP],
          controls: [{ ...control, status }],
        });
        expect(out.elements["Task_1"]?.controls?.[0]?.effectiveness).toBe(
          expected,
        );
      }
    });

    it("gibt `partial` nur aus, wenn ein Test es festgestellt hat", () => {
      const out = build({
        steps: [STEP],
        controls: [
          {
            ...control,
            status: "implemented",
            lastTestedAt: "2026-05-01",
            lastTestResult: "partially_effective",
          },
        ],
      });
      const got = out.elements["Task_1"]?.controls?.[0];
      expect(got?.effectiveness).toBe("partial");
      expect(got?.lastTestResult).toBe("partial");
      expect(got?.lastTestedAt).toBe("2026-05-01");
    });

    it("lässt einen ausdrücklichen Status gewinnen — der Test ändert ihn nicht", () => {
      const out = build({
        steps: [STEP],
        controls: [
          {
            ...control,
            status: "effective",
            lastTestResult: "partially_effective",
          },
        ],
      });
      expect(out.elements["Task_1"]?.controls?.[0]?.effectiveness).toBe(
        "effective",
      );
    });

    it("lässt lastEvidenceAt weg, wenn kein Nachweis existiert", () => {
      const out = build({ steps: [STEP], controls: [control] });
      expect(out.elements["Task_1"]?.controls?.[0]).not.toHaveProperty(
        "lastEvidenceAt",
      );
    });
  });

  describe("Feststellungen", () => {
    it("bildet die zehn ISO-19011-Schweregrade auf die vier Vertragsstufen ab", () => {
      // Ohne diese Tabelle fiele jeder Wert auf `medium` — eine schwere
      // Nichtkonformität sähe aus wie eine Anmerkung.
      expect(toSeverity("major_nonconformity")).toBe("critical");
      expect(toSeverity("significant_nonconformity")).toBe("critical");
      expect(toSeverity("minor_nonconformity")).toBe("high");
      expect(toSeverity("insignificant_nonconformity")).toBe("high");
      expect(toSeverity("opportunity_for_improvement")).toBe("medium");
      expect(toSeverity("improvement_requirement")).toBe("medium");
      expect(toSeverity("observation")).toBe("low");
      expect(toSeverity("recommendation")).toBe("low");
      expect(toSeverity("conforming")).toBe("low");
      expect(toSeverity("positive")).toBe("low");
    });

    it("lässt einen unbekannten Wert nicht als Entwarnung durchgehen", () => {
      expect(toSeverity("was-auch-immer")).toBe("medium");
      expect(toSeverity(null)).toBe("medium");
    });

    it("nimmt die Fälligkeit aus remediation_due_date", () => {
      const out = build({
        steps: [STEP],
        findings: [
          {
            processStepId: "step-1",
            id: "f1",
            title: "Keine Freigabe dokumentiert",
            severity: "minor_nonconformity",
            status: "in_remediation",
            dueAt: "2026-09-30",
          },
        ],
      });
      expect(out.elements["Task_1"]?.findings?.[0]).toEqual({
        id: "f1",
        title: "Keine Freigabe dokumentiert",
        severity: "high",
        status: "in_progress",
        dueAt: "2026-09-30",
      });
    });

    it("zählt unbekannte Zustände als offen, nicht als erledigt", () => {
      const out = build({
        steps: [STEP],
        findings: [
          {
            processStepId: "step-1",
            id: "f1",
            title: "t",
            severity: "observation",
            status: "voellig-neu",
            dueAt: null,
          },
        ],
      });
      expect(out.elements["Task_1"]?.findings?.[0]?.status).toBe("open");
    });
  });

  describe("Assets", () => {
    const assetRow = {
      processStepId: "step-1",
      assetId: "a1",
      name: "SAP FI",
      protectionGoalClass: 4,
      confidentiality: 3,
      integrity: 4,
      availability: 2,
      ownerName: "IT-Betrieb",
    };

    it("übersetzt die Schutzbedarfsklasse und das CIA-Profil", () => {
      const out = build({ steps: [STEP], assets: [assetRow] });
      expect(out.elements["Task_1"]?.assets?.[0]).toEqual({
        id: "a1",
        title: "SAP FI",
        criticality: "very_high",
        cia: "H/S/M",
        owner: "IT-Betrieb",
      });
    });

    it("lässt ein Asset ohne Schutzbedarf weg statt es auf `low` zu setzen", () => {
      const out = build({
        steps: [STEP],
        assets: [{ ...assetRow, protectionGoalClass: null }],
      });
      expect(out.elements["Task_1"]?.assets).toBeUndefined();
    });

    it("lässt cia weg, wenn eine der drei Angaben fehlt", () => {
      const out = build({
        steps: [STEP],
        assets: [{ ...assetRow, integrity: null }],
      });
      expect(out.elements["Task_1"]?.assets?.[0]).not.toHaveProperty("cia");
    });
  });

  describe("Roll-up der Call Activity (§3.4/A5)", () => {
    const withCall = {
      steps: [{ ...STEP, calledProcessId: "proc-child" }],
    };

    it("rechnet die Abdeckungsquote aus abgedecktem und gesamtem Restrisiko", () => {
      const out = build({
        ...withCall,
        calledProcesses: [
          {
            processId: "proc-child",
            name: "Freigabe",
            riskCount: 3,
            maxResidualScore: 16,
            residualScoreSum: 40,
            coveredScoreSum: 10,
            openFindings: 2,
          },
        ],
      });
      expect(out.elements["Task_1"]?.calledProcess).toEqual({
        processId: "proc-child",
        name: "Freigabe",
        rollup: {
          riskCount: 3,
          maxResidualScore: 16,
          residualScoreSum: 40,
          coverageRatio: 0.25,
          openFindings: 2,
        },
      });
    });

    it("lässt die Quote weg, wenn es kein bewertetes Restrisiko gibt", () => {
      // 0/0 ist keine vollständige Abdeckung, sondern keine Aussage.
      const out = build({
        ...withCall,
        calledProcesses: [
          {
            processId: "proc-child",
            name: "Freigabe",
            riskCount: 0,
            maxResidualScore: 0,
            residualScoreSum: 0,
            coveredScoreSum: 0,
            openFindings: 0,
          },
        ],
      });
      expect(out.elements["Task_1"]?.calledProcess?.rollup).not.toHaveProperty(
        "coverageRatio",
      );
    });

    it("nennt den Zielprozess auch ohne Aggregat — dann aber ohne rollup", () => {
      const out = build(withCall);
      expect(out.elements["Task_1"]?.calledProcess?.processId).toBe(
        "proc-child",
      );
      expect(out.elements["Task_1"]?.calledProcess?.rollup).toBeUndefined();
    });
  });

  it("nimmt R und A aus custom_role, mit Kürzel für die Anzeige", () => {
    const out = build({
      steps: [
        {
          ...STEP,
          raciResponsibleRoleId: "role-1",
          raciAccountableRoleId: "role-2",
        },
      ],
      roles: [
        { id: "role-1", name: "Einkauf Sachbearbeitung" },
        { id: "role-2", name: "Leitung" },
      ],
    });
    expect(out.elements["Task_1"]?.raci).toEqual({
      responsible: {
        id: "role-1",
        name: "Einkauf Sachbearbeitung",
        short: "ES",
      },
      accountable: { id: "role-2", name: "Leitung", short: "LE" },
    });
    // C und I haben keine DB-Heimat — sie fehlen, statt leer dazustehen.
    expect(out.elements["Task_1"]?.raci).not.toHaveProperty("consulted");
    expect(out.elements["Task_1"]?.raci).not.toHaveProperty("informed");
  });

  it("hängt Simulationsparameter an die BPMN-ID, nicht an die Schritt-ID", () => {
    const out = build({
      steps: [STEP],
      simulation: [
        {
          activityId: "Task_1",
          durationMostLikely: 12.5,
          costPerExecution: 4,
          executions: 1000,
        },
      ],
    });
    expect(out.elements["Task_1"]?.simulation).toEqual({
      durationMinutes: 12.5,
      costPerExecution: 4,
      executions: 1000,
    });
  });

  it("hängt eine Framework-Anforderung an den Schritt (F8, seit Migration 0443)", () => {
    const out = build({
      steps: [STEP],
      frameworks: [
        {
          processStepId: "step-1",
          id: "m1",
          frameworkCode: "ISO27001",
          entryCode: "A.5.1",
          entryTitle: "Richtlinien für Informationssicherheit",
          mappingStrength: "partial",
        },
      ],
    });
    expect(out.elements["Task_1"]?.frameworks?.[0]).toEqual({
      id: "m1",
      frameworkId: "ISO27001",
      frameworkName: "ISO27001",
      requirementRef: "A.5.1",
      requirementTitle: "Richtlinien für Informationssicherheit",
      coverage: "partial",
    });
  });

  it("übersetzt `references` als Lücke, nicht als Teilabdeckung", () => {
    expect(toCoverage("covers")).toBe("covered");
    expect(toCoverage("partial")).toBe("partial");
    expect(toCoverage("references")).toBe("gap");
    expect(toCoverage(null)).toBe("gap");
  });

  it("lässt eine Zuordnung ohne Anforderungskennung weg", () => {
    const out = build({
      steps: [STEP],
      frameworks: [
        {
          processStepId: "step-1",
          id: "m1",
          frameworkCode: "ISO27001",
          entryCode: null,
          entryTitle: null,
          mappingStrength: "covers",
        },
      ],
    });
    expect(out.elements["Task_1"]?.frameworks).toBeUndefined();
  });

  it("zählt Kommentarstränge und nennt den letzten Autor", () => {
    const out = build({
      steps: [STEP],
      comments: [
        {
          processStepId: "step-1",
          totalThreads: 3,
          openThreads: 1,
          lastAt: AT,
          lastAuthor: "B. Prüfer",
        },
      ],
    });
    expect(out.elements["Task_1"]?.comments).toEqual({
      openThreads: 1,
      totalThreads: 3,
      lastAt: AT,
      lastAuthor: "B. Prüfer",
    });
  });

  it("ordnet die Elemente stabil — zweimal dieselbe Eingabe, dieselbe Reihenfolge", () => {
    const input = rows({
      steps: [
        { ...STEP, id: "s2", bpmnElementId: "Task_Z" },
        { ...STEP, id: "s1", bpmnElementId: "Task_A" },
      ],
      findings: [
        {
          processStepId: "s2",
          id: "f2",
          title: "t",
          severity: "observation",
          status: "identified",
          dueAt: null,
        },
        {
          processStepId: "s1",
          id: "f1",
          title: "t",
          severity: "observation",
          status: "identified",
          dueAt: null,
        },
      ],
    });
    const a = buildDiagramOverlay(input, { computedAt: AT, processId: "p" });
    const b = buildDiagramOverlay(input, { computedAt: AT, processId: "p" });
    expect(Object.keys(a.elements)).toEqual(["Task_A", "Task_Z"]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  describe("MISSING_TODAY ist keine Behauptung, sondern geprüft", () => {
    it("nennt jedes Feld mit einem Grund", () => {
      expect(MISSING_TODAY.length).toBeGreaterThan(0);
      for (const entry of MISSING_TODAY) {
        expect(entry.field.length).toBeGreaterThan(3);
        expect(entry.reason.length).toBeGreaterThan(20);
      }
    });

    it("liefert keines der dort genannten Felder mit einem Ersatzwert", () => {
      // Ein voll besetzter Datensatz — genau der Fall, in dem eine
      // versehentliche Erfindung sichtbar würde.
      const out = build({
        steps: [
          {
            ...STEP,
            lineOfDefense: "first",
            calledProcessId: "proc-child",
            raciResponsibleRoleId: "role-1",
          },
        ],
        roles: [{ id: "role-1", name: "Einkauf" }],
        risks: [
          {
            processStepId: "step-1",
            riskId: "r1",
            title: "R",
            residualScore: 9,
            inherentScore: null,
            ownerName: null,
            treatmentStrategy: null,
          },
        ],
        controls: [
          {
            processStepId: "step-1",
            controlId: "c1",
            title: "K",
            status: "effective",
            lastTestedAt: "2026-01-01",
            lastTestResult: "effective",
            lastEvidenceAt: AT,
          },
        ],
        riskControls: [{ riskId: "r1", controlId: "c1" }],
      });

      const element = out.elements["Task_1"];
      expect(element).toBeDefined();
      for (const key of [
        "stepKey",
        "ropa",
        "bia",
        "documents",
        "conformance",
        "incidents",
        "workItems",
      ] as const) {
        expect(element).not.toHaveProperty(key);
      }
      expect(element?.controls?.[0]).not.toHaveProperty("isKey");
      expect(element?.controls?.[0]).not.toHaveProperty("ownerRole");
      expect(element?.controls?.[0]).not.toHaveProperty("evidenceDueAt");

      expect(out).not.toHaveProperty("lanes");
      expect(out).not.toHaveProperty("edges");
      expect(out.diagram).not.toHaveProperty("sodRules");
      expect(out.diagram).not.toHaveProperty("outage");
      expect(out.diagram).not.toHaveProperty("framework");
      expect(out.diagram).not.toHaveProperty("conformance");
    });
  });
});
