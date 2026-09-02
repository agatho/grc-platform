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
      // [STUFE2-E] Nachgezogen: der Datensatz ist jetzt **maximal** besetzt —
      // jede der zehn neuen Tabellen liefert eine Zeile. Genau das ist der
      // Fall, in dem eine versehentliche Erfindung sichtbar würde: was hier
      // trotz voller Eingabe fehlt, fehlt, weil die Daten es nicht hergeben.
      const out = buildDiagramOverlay(
        rows({
          steps: [
            {
              ...STEP,
              lineOfDefense: "first",
              calledProcessId: "proc-child",
              raciResponsibleRoleId: "role-1",
              stepKey: "11111111-1111-4111-8111-111111111111",
            },
          ],
          roles: [
            { id: "role-1", name: "Einkauf" },
            { id: "role-2", name: "Buchhaltung" },
          ],
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
              isKey: true,
              ownerRoleId: "role-1",
              evidenceDueAt: AT,
            },
          ],
          riskControls: [{ riskId: "r1", controlId: "c1" }],
          raci: [{ processStepId: "step-1", roleId: "role-2", raciRole: "C" }],
          ropa: [
            {
              processStepId: "step-1",
              isProcessingActivity: true,
              purpose: "Zweck",
              legalBasis: "contract",
              retentionMonths: 6,
              retentionBasis: "§ 147 AO",
              requiresDpia: true,
              dpiaId: "dpia-1",
              dpiaStatus: "approved",
              transferThirdCountry: true,
              transferCountry: "us",
              transferSafeguard: "SCC",
            },
          ],
          dataCategories: [
            {
              processStepId: "step-1",
              id: "cat-1",
              title: "Gesundheitsdaten",
              isSpecialCategory: true,
            },
          ],
          recipients: [
            { processStepId: "step-1", id: "vendor-1", title: "CloudCo" },
          ],
          bia: [
            {
              processStepId: "step-1",
              criticality: "very_high",
              mtpdMinutes: 105,
              rtoMinutes: 60,
              rpoMinutes: 15,
              workaround: null,
              workaroundMaxDurationMinutes: null,
            },
          ],
          documents: [{ processStepId: "step-1", id: "doc-1", title: "AA-01" }],
          conformanceElements: [
            {
              processStepId: "step-1",
              matchKind: "exact",
              observedCases: 2,
              reworkLoops: 1,
            },
          ],
          conformanceSummary: {
            coverageRatio: 0.75,
            unmappedActivities: ["Sonderfreigabe"],
            totalTraces: 2,
            conformantTraces: 1,
          },
          lanes: [
            {
              bpmnElementId: "Lane_1",
              name: "Einkauf",
              kind: "lane",
              roleId: "role-1",
              orgUnitId: null,
              orgUnitName: null,
              vendorId: null,
              vendorName: null,
              vendorRiskClass: null,
              isExternal: false,
              thirdCountry: null,
            },
          ],
          sodRules: [
            {
              id: "sod-1",
              roleAId: "role-1",
              roleBId: "role-1",
              severity: "critical",
              rationale: null,
              frameworkRef: null,
            },
          ],
        }),
        {
          computedAt: AT,
          processId: "proc-1",
          processName: "Beschaffung",
          outage: { assetId: "asset-1" },
        },
      );

      const element = out.elements["Task_1"];
      expect(element).toBeDefined();

      // Die Felder, die MISSING_TODAY heute noch führt — trotz voller Eingabe.
      for (const key of ["incidents", "workItems"] as const) {
        expect(element).not.toHaveProperty(key);
      }
      expect(element?.conformance).not.toHaveProperty("meanDurationMinutes");
      expect(element?.conformance).not.toHaveProperty("isBottleneck");
      expect(out.diagram?.conformance).not.toHaveProperty("deviations");
      expect(out).not.toHaveProperty("edges");
      expect(out.diagram).not.toHaveProperty("framework");
    });

    it("führt kein Feld mehr, das der Endpunkt inzwischen liefert", () => {
      // Der Wächter gegen die eigentliche Gefahr dieser Liste: dass sie nach
      // einer Schemaerweiterung stehen bleibt und behauptet, etwas sei
      // unmöglich, was längst geliefert wird. Genannt sind die Felder, die die
      // Migrationen 0444–0454 befüllbar gemacht haben.
      const nowDelivered = [
        "isKey",
        "ownerRole",
        "evidenceDueAt",
        "raci.consulted",
        "elements[].ropa",
        "elements[].bia",
        "elements[].stepKey",
        "lanes",
        "diagram.sodRules",
        "diagram.outage",
      ];
      const listed = MISSING_TODAY.map((entry) => entry.field).join(" | ");
      for (const field of nowDelivered) {
        expect(
          listed.includes(field),
          `MISSING_TODAY fuehrt "${field}" noch, obwohl der Endpunkt es liefert`,
        ).toBe(false);
      }
    });
  });

  /* ---------------------------------------------------------------- *
   * STUFE2-E — die zehn Layer, die durch die neuen Tabellen leben
   * ---------------------------------------------------------------- */

  describe("STUFE2-E: die nachgereichten Layer bekommen echte Daten", () => {
    it("RACI: eine Zeile aus process_step_raci gewinnt gegen die Spalte", () => {
      const out = build({
        steps: [
          {
            ...STEP,
            raciResponsibleRoleId: "role-alt",
            raciAccountableRoleId: "role-alt",
          },
        ],
        roles: [
          { id: "role-alt", name: "Alt" },
          { id: "role-1", name: "Einkauf" },
          { id: "role-2", name: "Buchhaltung" },
          { id: "role-3", name: "Aufsicht" },
        ],
        raci: [
          { processStepId: "step-1", roleId: "role-1", raciRole: "A" },
          { processStepId: "step-1", roleId: "role-3", raciRole: "C" },
          { processStepId: "step-1", roleId: "role-2", raciRole: "C" },
          { processStepId: "step-1", roleId: "role-2", raciRole: "I" },
        ],
      });
      const raci = out.elements["Task_1"]?.raci;
      // A steht in der Tabelle und gewinnt gegen die Spalte; für R gibt es
      // keine Zeile, also bleibt die Spalte stehen.
      expect(raci?.accountable?.id).toBe("role-1");
      expect(raci?.responsible?.id).toBe("role-alt");
      // C und I: ausschließlich aus der Tabelle, nach Namen sortiert.
      expect(raci?.consulted?.map((role) => role.name)).toEqual([
        "Aufsicht",
        "Buchhaltung",
      ]);
      expect(raci?.informed?.map((role) => role.id)).toEqual(["role-2"]);
    });

    it("RACI: eine Rolle, die der Datensatz nicht kennt, wird verworfen", () => {
      const out = build({
        steps: [STEP],
        roles: [],
        raci: [{ processStepId: "step-1", roleId: "geist", raciRole: "C" }],
      });
      expect(out.elements["Task_1"]).toBeUndefined();
    });

    it("Kontrolle: isKey, ownerRole und evidenceDueAt kommen durch", () => {
      const out = build({
        steps: [STEP],
        roles: [{ id: "role-1", name: "Interne Revision" }],
        controls: [
          {
            processStepId: "step-1",
            controlId: "c1",
            title: "K",
            status: "effective",
            lastTestedAt: null,
            lastTestResult: null,
            lastEvidenceAt: null,
            isKey: true,
            ownerRoleId: "role-1",
            evidenceDueAt: AT,
          },
        ],
      });
      const control = out.elements["Task_1"]?.controls?.[0];
      expect(control?.isKey).toBe(true);
      expect(control?.ownerRole?.name).toBe("Interne Revision");
      expect(control?.ownerRole?.short).toBe("IR");
      expect(control?.evidenceDueAt).toBe(AT);
    });

    it("Kontrolle: eine nicht abgefragte is_key-Spalte wird nicht zu false", () => {
      const out = build({
        steps: [STEP],
        controls: [
          {
            processStepId: "step-1",
            controlId: "c1",
            title: "K",
            status: "effective",
            lastTestedAt: null,
            lastTestResult: null,
            lastEvidenceAt: null,
          },
        ],
      });
      expect(out.elements["Task_1"]?.controls?.[0]).not.toHaveProperty("isKey");
    });

    it("ROPA: Kategorien und Empfänger hängen am ROPA-Datensatz", () => {
      const out = build({
        steps: [STEP],
        ropa: [
          {
            processStepId: "step-1",
            isProcessingActivity: true,
            purpose: "Vertragsabwicklung",
            legalBasis: "contract",
            retentionMonths: 6,
            retentionBasis: "§ 147 AO",
            requiresDpia: true,
            dpiaId: "dpia-1",
            dpiaStatus: "approved",
            transferThirdCountry: true,
            transferCountry: "us",
            transferSafeguard: "SCC 2021/914",
          },
        ],
        dataCategories: [
          {
            processStepId: "step-1",
            id: "cat-1",
            title: "Gesundheitsdaten",
            isSpecialCategory: true,
          },
        ],
        recipients: [
          { processStepId: "step-1", id: "v1", title: "CloudCo Inc." },
        ],
      });
      const ropa = out.elements["Task_1"]?.ropa;
      expect(ropa?.isProcessingActivity).toBe(true);
      expect(ropa?.retentionMonths).toBe(6);
      // ISO-3166-1 alpha-2 großgeschrieben — der Chip an der Doppelkante zeigt
      // `US`, nicht `us`.
      expect(ropa?.transferCountry).toBe("US");
      expect(ropa?.dpiaStatus).toBe("done");
      expect(ropa?.dataCategories?.[0]?.isSpecialCategory).toBe(true);
      expect(ropa?.recipients?.[0]?.title).toBe("CloudCo Inc.");
    });

    it("ROPA: Kategorien ohne ROPA-Zeile erzeugen keinen Personenbezug", () => {
      // Eine Kategorie allein ist keine Feststellung „hier wird verarbeitet".
      const out = build({
        steps: [STEP],
        dataCategories: [
          {
            processStepId: "step-1",
            id: "cat-1",
            title: "Gesundheitsdaten",
            isSpecialCategory: true,
          },
        ],
      });
      expect(out.elements["Task_1"]).toBeUndefined();
    });

    it("DPIA: eine abgelehnte Folgenabschätzung ist nicht abgeschlossen", () => {
      const out = build({
        steps: [STEP],
        ropa: [
          {
            processStepId: "step-1",
            isProcessingActivity: true,
            purpose: null,
            legalBasis: null,
            retentionMonths: null,
            retentionBasis: null,
            requiresDpia: true,
            dpiaId: "dpia-1",
            dpiaStatus: "rejected",
            transferThirdCountry: false,
            transferCountry: null,
            transferSafeguard: null,
          },
        ],
      });
      expect(out.elements["Task_1"]?.ropa?.dpiaStatus).toBe("required");
    });

    it("DPIA: ohne verknüpfte Akte bleibt der Status weg", () => {
      const out = build({
        steps: [STEP],
        ropa: [
          {
            processStepId: "step-1",
            isProcessingActivity: true,
            purpose: null,
            legalBasis: null,
            retentionMonths: null,
            retentionBasis: null,
            requiresDpia: true,
            dpiaId: null,
            dpiaStatus: null,
            transferThirdCountry: false,
            transferCountry: null,
            transferSafeguard: null,
          },
        ],
      });
      const ropa = out.elements["Task_1"]?.ropa;
      expect(ropa?.requiresDpia).toBe(true);
      expect(ropa).not.toHaveProperty("dpiaId");
      expect(ropa).not.toHaveProperty("dpiaStatus");
    });

    it("BIA: Minuten kommen durch, die 0 des Workarounds bleibt erhalten", () => {
      const out = build({
        steps: [STEP],
        bia: [
          {
            processStepId: "step-1",
            criticality: "high",
            mtpdMinutes: 480,
            rtoMinutes: 240,
            rpoMinutes: 15,
            workaround: "Papierformular",
            workaroundMaxDurationMinutes: 0,
          },
        ],
      });
      const bia = out.elements["Task_1"]?.bia;
      expect(bia?.criticality).toBe("high");
      expect(bia?.rpoMinutes).toBe(15);
      // 0 heißt „trägt nicht" und ist eine Aussage — sie darf nicht
      // wegfallen, sonst gälte der Schritt fälschlich als gedeckt.
      expect(bia?.workaroundMaxDurationMinutes).toBe(0);
    });

    it("BIA: eine unlesbare Kritikalität wird verworfen, nicht auf low gesetzt", () => {
      const out = build({
        steps: [STEP],
        bia: [
          {
            processStepId: "step-1",
            criticality: "sehr hoch",
            mtpdMinutes: 60,
            rtoMinutes: null,
            rpoMinutes: null,
            workaround: null,
            workaroundMaxDurationMinutes: null,
          },
        ],
      });
      expect(out.elements["Task_1"]).toBeUndefined();
    });

    it("Dokumente: Titel statt Kennung, Zeile ohne Titel fällt weg", () => {
      const out = build({
        steps: [STEP],
        documents: [
          { processStepId: "step-1", id: "d1", title: "AA-01" },
          { processStepId: "step-1", id: "d2", title: "FB-07" },
          { processStepId: "step-1", id: "d3", title: null },
        ],
      });
      expect(out.elements["Task_1"]?.documents).toEqual([
        { id: "d1", title: "AA-01" },
        { id: "d2", title: "FB-07" },
      ]);
    });

    it("Lanes: Träger, Drittland und Quoten landen unter der Element-ID", () => {
      const out = build({
        steps: [STEP],
        roles: [{ id: "role-1", name: "Einkauf" }],
        lanes: [
          {
            bpmnElementId: "Lane_1",
            name: "Einkauf",
            kind: "lane",
            roleId: "role-1",
            orgUnitId: "ou-1",
            orgUnitName: "Zentraleinkauf",
            vendorId: null,
            vendorName: null,
            vendorRiskClass: null,
            isExternal: false,
            thirdCountry: null,
          },
          {
            bpmnElementId: "Pool_Ext",
            name: "Dienstleister",
            kind: "pool",
            roleId: null,
            orgUnitId: null,
            orgUnitName: null,
            vendorId: "v1",
            vendorName: "CloudCo Inc.",
            vendorRiskClass: "critical",
            isExternal: true,
            thirdCountry: "us",
          },
        ],
        laneRatios: [
          {
            roleId: "role-1",
            memberCount: 2,
            trainedCount: 1,
            acknowledgedCount: 0,
            hasMandatoryTraining: true,
            hasMandatoryPolicy: false,
          },
        ],
      });
      expect(out.lanes?.["Lane_1"]?.role?.id).toBe("role-1");
      expect(out.lanes?.["Lane_1"]?.orgUnit?.title).toBe("Zentraleinkauf");
      expect(out.lanes?.["Lane_1"]?.trainingRatio).toBe(0.5);
      // Keine Pflichtverteilung im Mandanten → keine Quote, nicht „0 %".
      expect(out.lanes?.["Lane_1"]).not.toHaveProperty("acknowledgmentRatio");
      expect(out.lanes?.["Pool_Ext"]?.vendor?.riskClass).toBe("critical");
      expect(out.lanes?.["Pool_Ext"]?.thirdCountry).toBe("US");
      expect(out.lanes?.["Pool_Ext"]?.isExternal).toBe(true);
    });

    it("Lanes: ohne Mitglieder gibt es keine Quote", () => {
      const out = build({
        steps: [STEP],
        roles: [{ id: "role-1", name: "Einkauf" }],
        lanes: [
          {
            bpmnElementId: "Lane_1",
            name: "Einkauf",
            kind: "lane",
            roleId: "role-1",
            orgUnitId: null,
            orgUnitName: null,
            vendorId: null,
            vendorName: null,
            vendorRiskClass: null,
            isExternal: false,
            thirdCountry: null,
          },
        ],
        laneRatios: [
          {
            roleId: "role-1",
            memberCount: 0,
            trainedCount: 0,
            acknowledgedCount: 0,
            hasMandatoryTraining: true,
            hasMandatoryPolicy: true,
          },
        ],
      });
      expect(out.lanes?.["Lane_1"]).not.toHaveProperty("trainingRatio");
      expect(out.lanes?.["Lane_1"]).not.toHaveProperty("acknowledgmentRatio");
    });

    it("SoD: die Selbstpaarung überlebt die Abbildung", () => {
      const out = build({
        steps: [STEP],
        roles: [{ id: "role-1", name: "Einkauf" }],
        sodRules: [
          {
            id: "sod-1",
            roleAId: "role-1",
            roleBId: "role-1",
            severity: "critical",
            rationale: "Bestellen und Freigeben in einer Hand.",
            frameworkRef: "IDW PS 261",
          },
        ],
      });
      expect(out.diagram?.sodRules).toEqual([
        {
          id: "sod-1",
          roleAId: "role-1",
          roleBId: "role-1",
          severity: "critical",
          rationale: "Bestellen und Freigeben in einer Hand.",
          frameworkRef: "IDW PS 261",
        },
      ]);
    });

    it("SoD: eine Regel mit unbekannter Rolle wird nicht mitgezählt", () => {
      const out = build({
        steps: [STEP],
        roles: [{ id: "role-1", name: "Einkauf" }],
        sodRules: [
          {
            id: "sod-1",
            roleAId: "role-1",
            roleBId: "geist",
            severity: "high",
            rationale: null,
            frameworkRef: null,
          },
        ],
      });
      expect(out.diagram).not.toHaveProperty("sodRules");
    });

    it("Conformance: Quote, nicht zugeordnete Aktivitäten und Rework je Schritt", () => {
      const out = build({
        steps: [STEP],
        conformanceElements: [
          {
            processStepId: "step-1",
            matchKind: "exact",
            observedCases: 2,
            reworkLoops: 1,
          },
        ],
        conformanceSummary: {
          coverageRatio: 0.75,
          unmappedActivities: ["Sonderfreigabe"],
          totalTraces: 2,
          conformantTraces: 1,
        },
      });
      expect(out.elements["Task_1"]?.conformance).toEqual({
        matchKind: "exact",
        observedCases: 2,
        reworkLoops: 1,
      });
      expect(out.diagram?.conformance?.coverageRatio).toBe(0.75);
      expect(out.diagram?.conformance?.unmappedActivities).toEqual([
        "Sonderfreigabe",
      ]);
      expect(out.diagram?.conformance?.conformantTraces).toBe(1);
    });

    // [ARCTOS-FULL-2026-08-31 · OP-014] Die Abweichungen als Kantenpaar —
    // vorher blieb `deviations` unter jeder Eingabe leer, weil die einzige
    // Quelle (`fitness_gaps`) Knoten führt.
    it("Conformance: abweichende Übergänge kommen als Kantenpaar durch", () => {
      const out = build({
        steps: [STEP],
        conformanceSummary: {
          coverageRatio: 0.9,
          unmappedActivities: [],
          totalTraces: 10,
          conformantTraces: 6,
        },
        conformanceDeviations: [
          {
            fromElementId: "Task_1",
            toElementId: "Task_3",
            frequency: 4,
            share: 0.4,
          },
          {
            fromElementId: "Task_3",
            toElementId: "Task_1",
            frequency: 9,
            share: 0.9,
          },
          // Ein Ende ohne Kennung: nicht zeichenbar, fliegt raus.
          {
            fromElementId: "Task_1",
            toElementId: null,
            frequency: 7,
            share: 0.7,
          },
        ],
      });
      expect(out.diagram?.conformance?.deviations).toEqual([
        {
          fromElementId: "Task_3",
          toElementId: "Task_1",
          frequency: 9,
          share: 0.9,
        },
        {
          fromElementId: "Task_1",
          toElementId: "Task_3",
          frequency: 4,
          share: 0.4,
        },
      ]);
    });

    it("Conformance: ohne Abfrage der Route bleibt deviations weg, nicht leer", () => {
      const out = build({
        steps: [STEP],
        conformanceSummary: {
          coverageRatio: 0.9,
          unmappedActivities: [],
          totalTraces: 10,
          conformantTraces: 6,
        },
      });
      expect(out.diagram?.conformance).not.toHaveProperty("deviations");
    });

    it("Conformance: ohne Ereignisse keine Quote und damit keine Heatmap", () => {
      const out = build({
        steps: [STEP],
        conformanceSummary: {
          coverageRatio: null,
          unmappedActivities: [],
          totalTraces: null,
          conformantTraces: null,
        },
      });
      expect(out.diagram).not.toHaveProperty("conformance");
    });

    it("Ausfallszenario: nur auf Ansage, mit aufgelöstem Assetnamen", () => {
      const withoutSelection = build({ steps: [STEP] });
      expect(withoutSelection.diagram).not.toHaveProperty("outage");

      const out = buildDiagramOverlay(
        rows({
          steps: [STEP],
          assets: [
            {
              processStepId: "step-1",
              assetId: "asset-1",
              name: "SAP FI",
              protectionGoalClass: 4,
              confidentiality: 4,
              integrity: 4,
              availability: 4,
              ownerName: null,
            },
          ],
        }),
        {
          computedAt: AT,
          processId: "proc-1",
          outage: { assetId: "asset-1", elapsedMinutes: 30 },
        },
      );
      expect(out.diagram?.outage).toEqual({
        assetId: "asset-1",
        assetName: "SAP FI",
        elapsedMinutes: 30,
      });
    });

    it("stepKey wird geliefert, sobald die Spalte einen Wert hat", () => {
      const out = build({
        steps: [{ ...STEP, stepKey: "11111111-1111-4111-8111-111111111111" }],
      });
      expect(out.elements["Task_1"]?.stepKey).toBe(
        "11111111-1111-4111-8111-111111111111",
      );
    });
  });
});
