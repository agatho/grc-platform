/// <reference lib="dom" />

import { describe, expect, it } from "vitest";

import {
  computeCoverage,
  computeEvidence,
  computeFindings,
  computeFrameworkElement,
  computeRetention,
  conformanceGate,
  personalDataStage,
  riskLevel,
  rollupRisk,
  summarizeFramework,
} from "../../src/grc/analysis";
import { buildGrcGraph } from "../../src/grc/graph";
import { buildOverlayModel } from "../../src/grc/engine";
import { viewById } from "../../src/grc/views";
import {
  AS_OF,
  goodsReceiptRetentionData,
  largeProcessData,
  largeProcessWithoutCoverage,
  laneRiskConcentrationData,
  orderRollupData,
  procurementComplianceData,
  salesRiskControlData,
} from "./fixtures";
import { corpusScene } from "./helpers";

const asOf = new Date(AS_OF);

/**
 * Die Rechenkerne der Funktionen aus §3.12 — jeweils gegen ein echtes
 * Korpusdiagramm und erfundene, aber plausible GRC-Daten.
 */

describe("F1 — Kontrollabdeckung", () => {
  const data = salesRiskControlData();

  it("rechnet die Quote über Restrisikoscores, nicht über Kontrollanzahl", () => {
    const result = computeCoverage(data.elements["Task_offer"]);
    // 16 (unwirksame Kontrolle) + 9 (wirksam) = 25 gesamt, 9 abgedeckt.
    expect(result.totalScore).toBe(25);
    expect(result.coveredScore).toBe(9);
    expect(result.ratio).toBeCloseTo(0.36, 5);
    expect(result.controlCount).toBe(2);
    expect(result.effectiveControlCount).toBe(1);
  });

  it("meldet das unkontrollierte Risiko namentlich", () => {
    const result = computeCoverage(data.elements["Task_offer"]);
    expect(result.uncoveredRisks.map((risk) => risk.id)).toEqual(["risk-3"]);
  });

  it("stuft ein hohes unkontrolliertes Risiko unabhängig von der Quote als unkontrolliert ein", () => {
    const result = computeCoverage({
      risks: [
        { id: "a", title: "klein", residualScore: 1, controlIds: ["c1"] },
        { id: "b", title: "klein", residualScore: 1, controlIds: ["c1"] },
        { id: "c", title: "groß", residualScore: 15, controlIds: [] },
      ],
      controls: [{ id: "c1", title: "wirksam", effectiveness: "effective" }],
    });
    expect(result.stage).toBe("uncovered");
  });

  it("wertet ein Risiko ohne Kontrollverknüpfung als unkontrolliert", () => {
    const result = computeCoverage(data.elements["Gateway_1"]);
    expect(result.stage).toBe("uncovered");
    expect(result.ratio).toBe(0);
  });

  it("meldet ohne Risiken die Stufe „kein Risiko“", () => {
    expect(computeCoverage(data.elements["Task_reject"]).stage).toBe("none");
    expect(computeCoverage(undefined).stage).toBe("none");
  });

  it("erkennt vollständige Abdeckung", () => {
    expect(computeCoverage(data.elements["Task_qualify"]).stage).toBe("full");
  });
});

describe("F2 — Risiko-Roll-up", () => {
  it("erbt das Risiko des Zielprozesses an der Call Activity", async () => {
    const scene = await corpusScene("repo-seed-order-callactivity");
    const graph = buildGrcGraph(scene);
    const data = orderRollupData();
    const call = graph.shapes.get("CallActivity_OA_Touren");
    expect(call).toBeDefined();

    const profile = rollupRisk(graph, data, call!);
    expect(profile.count).toBe(3);
    expect(profile.maxResidual).toBe(20);
    expect(profile.origin).toBe("rolled-up");
    expect(profile.inheritedFrom).toContain("Tourenplanung");
  });

  it("zeigt an der Lane die Risikokonzentration ihrer Aktivitäten", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const data = laneRiskConcentrationData();

    const lane = graph.shapes.get("Lane_Genehmigung");
    expect(lane).toBeDefined();
    const profile = rollupRisk(graph, data, lane!);
    expect(profile.count).toBe(1);
    expect(profile.maxResidual).toBe(18);
    expect(profile.origin).toBe("rolled-up");
    expect(profile.inheritedFrom).toContain("Entscheiden");
  });

  it("aggregiert am Pool über alle Lanes", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const pool = graph.shapes.get("Participant_Bank");
    expect(pool).toBeDefined();
    const profile = rollupRisk(graph, laneRiskConcentrationData(), pool!);
    expect(profile.count).toBe(2);
    expect(profile.sumResidual).toBe(25);
  });

  it("lässt ein Element ohne Kinder unverändert", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const leaf = graph.shapes.get("Task_Bank_Entscheiden");
    expect(leaf).toBeDefined();
    const profile = rollupRisk(graph, laneRiskConcentrationData(), leaf!);
    expect(profile.origin).toBe("own");
    expect(profile.count).toBe(1);
  });

  it("färbt die Call Activity nach der geerbten Abdeckung ein", async () => {
    const scene = await corpusScene("repo-seed-order-callactivity");
    const model = buildOverlayModel(scene, orderRollupData(), {
      view: viewById("risk-control"),
    });
    const decoration = model.elements.get("CallActivity_OA_Touren");
    const shape = decoration?.resolution.shape;
    // Der Zielprozess ist zu 35 % abgedeckt → teilweise, mit Hinweis „geerbt".
    expect(shape?.signal.tone).toBe("warn");
    expect(shape?.signal.describe).toMatch(/geerbt aus „Tourenplanung"/);
  });

  it("benutzt die Ampelschwellen des Bestands", () => {
    expect(riskLevel(16)).toBe("high");
    expect(riskLevel(15)).toBe("high");
    expect(riskLevel(9)).toBe("medium");
    expect(riskLevel(8)).toBe("low");
  });
});

describe("F4 — Nachweisfälligkeit", () => {
  const data = procurementComplianceData();

  it("stuft einen frischen Nachweis als aktuell ein", () => {
    const result = computeEvidence(data.elements["Task_pr"], asOf);
    expect(result.stage).toBe("fresh");
    expect(result.ageDays).toBe(20);
  });

  it("erkennt eine Fälligkeit innerhalb von 30 Tagen", () => {
    const result = computeEvidence(data.elements["Task_approve_pr"], asOf);
    expect(result.stage).toBe("due");
    expect(result.daysUntilDue).toBe(21);
  });

  it("erkennt Überfälligkeit mit Tagesangabe", () => {
    const result = computeEvidence(data.elements["Task_rfq"], asOf);
    expect(result.stage).toBe("overdue");
    expect(result.daysUntilDue).toBe(-135);
  });

  it("hält „nie erbracht“ als eigene Stufe von „sehr überfällig“ getrennt", () => {
    const result = computeEvidence(data.elements["Task_po"], asOf);
    expect(result.stage).toBe("never");
    expect(result.withoutEvidence.map((control) => control.id)).toEqual([
      "c-po-1",
    ]);
  });
});

describe("A3 — Feststellungen mit Fälligkeit", () => {
  it("zählt offen, überfällig, bald fällig und kritisch getrennt", () => {
    const result = computeFindings(
      salesRiskControlData().elements["Task_offer"],
      asOf,
    );
    expect(result.open).toBe(2);
    expect(result.overdue).toBe(1);
    expect(result.dueSoon).toBe(1);
    expect(result.critical).toBe(1);
    expect(result.stage).toBe("overdue");
  });

  it("ignoriert geschlossene Feststellungen", () => {
    const result = computeFindings(
      {
        findings: [
          { id: "x", title: "erledigt", severity: "high", status: "closed" },
        ],
      },
      asOf,
    );
    expect(result.stage).toBe("none");
  });
});

describe("F10 — Aufbewahrung und Löschung", () => {
  const data = goodsReceiptRetentionData();

  it("stuft kurze Fristen als steuerungsbedürftig ein", () => {
    const result = computeRetention(data.elements["Task_WE_Annahme"]?.ropa);
    expect(result.months).toBe(3);
    expect(result.stage).toBe("short");
    expect(result.categories).toContain("Fahrerdaten");
  });

  it("erkennt handelsrechtliche Langfristen", () => {
    const result = computeRetention(data.elements["Task_WE_Sortierung"]?.ropa);
    expect(result.stage).toBe("long");
    expect(result.basis).toBe("§ 257 HGB");
  });

  it("unterscheidet Personenbezug und besondere Kategorie", () => {
    expect(personalDataStage(undefined)).toBe("none");
    expect(personalDataStage(data.elements["Task_WE_Annahme"]?.ropa)).toBe(
      "personal",
    );
    expect(
      personalDataStage({
        isProcessingActivity: true,
        dataCategories: [
          { id: "g", title: "Gesundheit", isSpecialCategory: true },
        ],
      }),
    ).toBe("special");
  });
});

describe("F7 — Torwächter der Conformance-Heatmap", () => {
  it("gibt die Heatmap nur mit ausgewiesener Abdeckungsquote frei", () => {
    const gate = conformanceGate(largeProcessData());
    expect(gate.available).toBe(true);
    expect(gate.note).toContain("87 %");
    expect(gate.note).toContain("nicht zugeordnet");
  });

  it("verweigert die Heatmap ohne Quote — mit Begründung", () => {
    const gate = conformanceGate(largeProcessWithoutCoverage());
    expect(gate.available).toBe(false);
    expect(gate.note).toMatch(/Abdeckungsquote/);
  });
});

describe("F8 — Framework-Abdeckung", () => {
  const data = procurementComplianceData();

  it("wertet je Element die einschlägigen Anforderungen aus", () => {
    const result = computeFrameworkElement(
      data.elements["Task_rfq"],
      data.diagram?.framework,
    );
    expect(result.stage).toBe("gap");
    expect(result.relevant).toHaveLength(1);
  });

  it("zählt je Anforderung, nicht je Verknüpfung — eine Lücke deckt nichts zu", () => {
    const summary = summarizeFramework(data, data.diagram?.framework);
    expect(summary).toBeDefined();
    // A.5.19 abgedeckt, A.5.20 (zweimal verknüpft: partial + covered) teilweise,
    // A.5.21 Lücke.
    expect(summary?.requirements).toBe(3);
    expect(summary?.covered).toBe(1);
    expect(summary?.partial).toBe(1);
    expect(summary?.gaps).toBe(1);
    expect(summary?.gapRequirements).toEqual(["A.5.21"]);
    expect(summary?.coverageRatio).toBeCloseTo(1 / 3, 5);
  });

  it("filtert auf die ausgewählten Anforderungen", () => {
    const result = computeFrameworkElement(data.elements["Task_pr"], {
      frameworkId: "iso27001",
      requirementRefs: ["A.8"],
    });
    expect(result.stage).toBe("none");
  });
});
