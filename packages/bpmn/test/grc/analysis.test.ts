/// <reference lib="dom" />

import { describe, expect, it } from "vitest";

import {
  computeCoverage,
  computeEvidence,
  computeKri,
  isKriStale,
  KRI_STALE_FACTOR,
  computeFindings,
  computeFrameworkElement,
  computeIncidents,
  computeRetention,
  computeWorkItems,
  conformanceGate,
  personalDataStage,
  riskLevel,
  rollupRisk,
  summarizeFramework,
} from "../../src/grc/analysis";
import { describeQualificationGaps } from "../../src/grc/catalog";
import { buildGrcGraph } from "../../src/grc/graph";
import { buildOverlayModel } from "../../src/grc/engine";
import { viewById } from "../../src/grc/views";
import {
  AS_OF,
  iso,
  bankPrivacyData,
  goodsReceiptRetentionData,
  largeProcessData,
  largeProcessWithoutCoverage,
  laneRiskConcentrationData,
  orderRollupData,
  procurementComplianceData,
  salesRiskControlData,
} from "./fixtures";
import { corpusModel, corpusScene } from "./helpers";

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

/* ------------------------------------------------------------------ *
 * [ARCTOS-FULL-2026-08-31 · OP-004] F14 — Vorfälle am Schritt
 * ------------------------------------------------------------------ */

describe("F14 — Vorfälle am Schritt", () => {
  const data = salesRiskControlData();

  it("zählt laufende und abgeschlossene getrennt", () => {
    const result = computeIncidents(data.elements["Task_offer"]);
    expect(result.total).toBe(2);
    expect(result.open).toBe(1);
    expect(result.stage).toBe("critical");
  });

  it("lässt einen abgeschlossenen Vorfall NICHT verschwinden", () => {
    // Der Schritt, an dem aufgeräumt wurde, darf nicht aussehen wie der, an
    // dem nie etwas war. Er wechselt die Stufe, nicht die Sichtbarkeit.
    const result = computeIncidents({
      incidents: [
        {
          id: "i1",
          title: "Datenabfluss",
          severity: "critical",
          isOpen: false,
        },
      ],
    });
    expect(result.stage).toBe("closed");
    expect(result.total).toBe(1);
    expect(result.open).toBe(0);
  });

  it("nimmt den schwersten LAUFENDEN, nicht den schwersten überhaupt", () => {
    const result = computeIncidents({
      incidents: [
        { id: "alt", title: "alt", severity: "critical", isOpen: false },
        { id: "neu", title: "neu", severity: "medium", isOpen: true },
      ],
    });
    expect(result.worst?.id).toBe("neu");
    expect(result.stage).toBe("open");
  });

  it("hebt auf `critical`, sobald ein laufender Vorfall hoch oder kritisch ist", () => {
    const result = computeIncidents({
      incidents: [{ id: "i", title: "x", severity: "high", isOpen: true }],
    });
    expect(result.stage).toBe("critical");
  });

  it("zählt meldepflichtige Datenschutzvorfälle mit", () => {
    const result = computeIncidents(data.elements["Task_offer"]);
    expect(result.dataBreaches).toBe(1);
  });

  it("meldet ohne Vorfälle gar nichts", () => {
    expect(computeIncidents(undefined).stage).toBe("none");
    expect(computeIncidents({}).stage).toBe("none");
  });

  it("ist deterministisch bei gleichem Schweregrad", () => {
    // Sonst hinge das Bild an der Reihenfolge der Datenbankzeilen.
    const items = [
      { id: "b", title: "B", severity: "high" as const, isOpen: true },
      { id: "a", title: "A", severity: "high" as const, isOpen: true },
    ];
    expect(computeIncidents({ incidents: items }).worst?.id).toBe("a");
    expect(
      computeIncidents({ incidents: [...items].reverse() }).worst?.id,
    ).toBe("a");
  });
});

/* ------------------------------------------------------------------ *
 * [ARCTOS-FULL-2026-08-31 · OP-005] F16 — Offene Maßnahmen
 * ------------------------------------------------------------------ */

describe("F16 — Offene Maßnahmen mit Fälligkeit", () => {
  const data = salesRiskControlData();

  it("trennt überfällig, bald fällig und ohne Frist", () => {
    const result = computeWorkItems(data.elements["Task_offer"], asOf);
    expect(result.open).toBe(3);
    expect(result.overdue).toBe(1);
    expect(result.dueSoon).toBe(1);
    expect(result.withoutDueDate).toBe(1);
    expect(result.stage).toBe("overdue");
  });

  it("nennt die älteste Überfälligkeit in Tagen", () => {
    const result = computeWorkItems(data.elements["Task_offer"], asOf);
    expect(Math.round(result.daysUntilDue ?? 0)).toBe(-12);
  });

  it("zählt eine Maßnahme ohne Frist, statt sie zu verschweigen", () => {
    // Sie taucht in keiner Fälligkeitsliste auf und sähe in jeder Ampel grün
    // aus. Genau deshalb wird sie gezählt.
    const result = computeWorkItems(
      { workItems: [{ id: "w", title: "ohne Frist" }] },
      asOf,
    );
    expect(result.withoutDueDate).toBe(1);
    expect(result.stage).toBe("open");
    expect(result.daysUntilDue).toBeUndefined();
  });

  it("wertet ein unlesbares Datum als fehlende Frist, nicht als heute fällig", () => {
    const result = computeWorkItems(
      { workItems: [{ id: "w", title: "x", dueAt: "irgendwann" }] },
      asOf,
    );
    expect(result.withoutDueDate).toBe(1);
    expect(result.overdue).toBe(0);
    expect(result.dueSoon).toBe(0);
  });

  it("meldet ohne Maßnahmen gar nichts", () => {
    expect(computeWorkItems(undefined, asOf).stage).toBe("none");
    expect(computeWorkItems({}, asOf).stage).toBe("none");
  });
});

/* ------------------------------------------------------------------ *
 * [ARCTOS-FULL-2026-08-31 · OP-010] F17 — Aufschlüsselung je Rolle
 * ------------------------------------------------------------------ */

describe("F17 — Aufschlüsselung je Rolle", () => {
  it("nennt nur die Rollen mit einer Lücke, größte zuerst", () => {
    const gaps = describeQualificationGaps([
      {
        role: { id: "a", name: "Sachbearbeitung" },
        memberCount: 25,
        trainedCount: 23,
        acknowledgedCount: 25,
        isLaneRole: true,
      },
      {
        role: { id: "b", name: "Buchhaltung" },
        memberCount: 8,
        trainedCount: 3,
        acknowledgedCount: 8,
        isLaneRole: false,
      },
    ]);
    expect(gaps).toEqual([
      "Buchhaltung — 5 von 8 ohne Pflichtschulung",
      "Sachbearbeitung — 2 von 25 ohne Pflichtschulung",
    ]);
  });

  it("schweigt über eine vollständig geschulte Rolle", () => {
    // Eine Aufzählung, in der jede Zeile „12 von 12" sagt, verdeckt die eine,
    // die es nicht tut.
    expect(
      describeQualificationGaps([
        {
          role: { id: "a", name: "A" },
          memberCount: 12,
          trainedCount: 12,
          acknowledgedCount: 12,
          isLaneRole: true,
        },
      ]),
    ).toEqual([]);
  });

  it("macht aus einer fehlenden Pflicht keine Lücke", () => {
    // Ohne Pflichtschulung fehlt `trainedCount` ganz. Daraus „12 von 12 ohne
    // Schulung" zu machen wäre ein Befund, den die Daten nicht tragen.
    expect(
      describeQualificationGaps([
        {
          role: { id: "a", name: "A" },
          memberCount: 12,
          isLaneRole: true,
        },
      ]),
    ).toEqual([]);
  });

  it("nennt beide Lücken einer Rolle in einem Satzteil", () => {
    expect(
      describeQualificationGaps([
        {
          role: { id: "a", name: "A" },
          memberCount: 10,
          trainedCount: 7,
          acknowledgedCount: 2,
          isLaneRole: true,
        },
      ]),
    ).toEqual([
      "A — 3 von 10 ohne Pflichtschulung, 8 von 10 ohne Kenntnisnahme",
    ]);
  });

  it("ist unabhängig von der Reihenfolge der Eingabe", () => {
    const eintraege = [
      {
        role: { id: "a", name: "A" },
        memberCount: 10,
        trainedCount: 5,
        isLaneRole: true,
      },
      {
        role: { id: "b", name: "B" },
        memberCount: 10,
        trainedCount: 5,
        isLaneRole: false,
      },
    ];
    expect(describeQualificationGaps(eintraege)).toEqual(
      describeQualificationGaps([...eintraege].reverse()),
    );
  });

  it("landet in der Beschreibung der Lane — dem Panel dieser Schicht", async () => {
    const { model } = await corpusModel(
      "synth-collaboration-pools-lanes",
      bankPrivacyData(),
      "privacy",
    );
    const text = model.elements
      .get("Lane_Sachbearbeitung")
      ?.descriptions.join(" ");
    expect(text).toContain("Buchhaltung — 5 von 8 ohne Pflichtschulung");
    expect(text).toContain("Sachbearbeitung — 2 von 25 ohne Pflichtschulung");
  });
});

/* ------------------------------------------------------------------ *
 * [ARCTOS-FULL-2026-08-31 · OP-008] F15 — KRI-Schwellenampel
 * ------------------------------------------------------------------ */

describe("F15 — KRI-Schwellenampel", () => {
  const kri = (over: Record<string, unknown> = {}) => ({
    id: "k1",
    title: "Ausfallquote",
    direction: "asc" as const,
    ...over,
  });

  it("zeigt Rot, wenn ein Indikator über der roten Schwelle liegt", () => {
    const result = computeKri({ kris: [kri({ alert: "red" })] }, asOf);
    expect(result.stage).toBe("critical");
    expect(result.red).toBe(1);
  });

  it("macht aus einem Indikator OHNE Schwellen kein Grün", () => {
    // Gemessen am laufenden Schema: `current_alert_status` steht auf `green`,
    // obwohl keine einzige Schwelle hinterlegt ist (NOT NULL DEFAULT). Ein
    // grüner Punkt wäre hier eine Entwarnung aus fehlenden Daten.
    // Frisch gemessen — die Lücke ist ausschliesslich die fehlende Schwelle.
    const result = computeKri(
      {
        kris: [
          kri({ alert: undefined, frequency: "monthly", measuredAt: iso(-3) }),
        ],
      },
      asOf,
    );
    expect(result.stage).toBe("unset");
    expect(result.withoutThresholds).toBe(1);
  });

  it("macht aus einer veralteten Messung kein Grün", () => {
    // Ebenfalls gemessen: ein Indikator mit monatlichem Takt und einer 240
    // Tage alten Messung steht in der Datenbank auf `green`.
    const result = computeKri(
      {
        kris: [
          kri({ alert: "green", frequency: "monthly", measuredAt: iso(-240) }),
        ],
      },
      asOf,
    );
    expect(result.stage).toBe("stale");
    expect(result.stale).toBe(1);
  });

  it("lässt einen verpassten Messtakt durchgehen, zwei nicht", () => {
    // Ein verpasster Takt ist Betriebsrauschen, zwei sind eine Lücke.
    const frisch = kri({
      alert: "green",
      frequency: "monthly",
      measuredAt: iso(-45),
    });
    const alt = kri({
      alert: "green",
      frequency: "monthly",
      measuredAt: iso(-30 * KRI_STALE_FACTOR - 1),
    });
    expect(isKriStale(frisch, asOf)).toBe(false);
    expect(isKriStale(alt, asOf)).toBe(true);
  });

  it("nennt einen nie gemessenen Indikator ausdrücklich", () => {
    const result = computeKri({ kris: [kri({ alert: "green" })] }, asOf);
    expect(result.neverMeasured).toBe(1);
    expect(result.stage).toBe("stale");
  });

  it("sagt ohne bekannten Messtakt NICHT „veraltet“", () => {
    // Eine Erwartung zu wählen, die niemand vereinbart hat, wäre eine
    // erfundene Frist.
    expect(isKriStale(kri({ measuredAt: iso(-5000) }), asOf)).toBe(false);
  });

  it("lässt Rot vor Ungeklärtem und Ungeklärtes vor Gelb gewinnen", () => {
    expect(
      computeKri(
        {
          kris: [
            kri({
              id: "a",
              alert: "yellow",
              frequency: "monthly",
              measuredAt: iso(-3),
            }),
            kri({ id: "b", frequency: "monthly", measuredAt: iso(-3) }),
          ],
        },
        asOf,
      ).stage,
    ).toBe("unset");
    expect(
      computeKri(
        {
          kris: [
            kri({ id: "a", alert: "yellow" }),
            kri({ id: "b", alert: "red" }),
          ],
        },
        asOf,
      ).stage,
    ).toBe("critical");
  });

  it("meldet Grün nur, wenn alles gemessen UND beschwellt ist", () => {
    const result = computeKri(
      {
        kris: [
          kri({ alert: "green", frequency: "monthly", measuredAt: iso(-3) }),
        ],
      },
      asOf,
    );
    expect(result.stage).toBe("ok");
  });

  it("meldet ohne Indikatoren gar nichts", () => {
    expect(computeKri(undefined, asOf).stage).toBe("none");
  });
});
