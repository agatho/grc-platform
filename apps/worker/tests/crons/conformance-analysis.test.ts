// [ARCTOS-FULL-2026-08-31 · OP-014] Die Konformitätsauswertung.
//
// Der Kopfkommentar des Jobs behauptet eine Zahl: „Gemessen an der Prüffixtur
// (3 Spuren: 1→3, 1→2→3, 1→X→3) fällt die Quote von 66,67 % auf 33,33 %."
// Diese Datei IST diese Prüffixtur. Eine Zahl, die in einem Prüfbericht landet,
// darf nicht nur im Kommentar stehen.
//
// Warum das ein eigener Test und kein Datenbanktest ist: `analyseTraces` ist
// reine Rechnung auf zwei Listen — modellierte Schritte und beobachtete
// Spuren. Sie lag bis OP-014 als Schleife mitten im Datenbankdurchlauf, und
// damit war die Aussage dieses Jobs nur gegen eine befüllte Datenbank prüfbar.
// Herausgelöst ist sie in Millisekunden und vollständig prüfbar.

import { describe, it, expect } from "vitest";
import {
  analyseTraces,
  type ModelledStep,
  type ObservedTrace,
} from "../../src/crons/process-mining-conformance";

/** Drei modellierte Schritte in einer Kette: 1 → 2 → 3. */
const KETTE: ModelledStep[] = [
  { name: "Antrag erfassen", bpmnElementId: "Task_1", sequenceOrder: 1 },
  { name: "Antrag prüfen", bpmnElementId: "Task_2", sequenceOrder: 2 },
  { name: "Antrag bescheiden", bpmnElementId: "Task_3", sequenceOrder: 3 },
];

const spur = (id: string, ...activities: string[]): ObservedTrace => ({
  case_id: id,
  activities,
});

describe("analyseTraces — die Prüffixtur aus dem Kopfkommentar", () => {
  const traces = [
    // 1 → 3: überspringt den modellierten Schritt 2.
    spur("c1", "Antrag erfassen", "Antrag bescheiden"),
    // 1 → 2 → 3: folgt dem Modell.
    spur("c2", "Antrag erfassen", "Antrag prüfen", "Antrag bescheiden"),
    // 1 → X → 3: X ist überhaupt nicht modelliert.
    spur("c3", "Antrag erfassen", "Rückfrage stellen", "Antrag bescheiden"),
  ];

  it("meldet 33,33 % — genau die Zahl, die der Kommentar nennt", () => {
    const r = analyseTraces(KETTE, traces);
    expect(r.totalTraces).toBe(3);
    expect(r.conformantTraces).toBe(1);
    expect(r.score).toBe(33.33);
  });

  it("hätte ohne die Reihenfolgeprüfung 66,67 % gemeldet", () => {
    // Der ALTE Begriff, hier nachgebaut: konform = jede Aktivität trifft einen
    // modellierten Schritt. Er ist der Grund, aus dem OP-014 den Begriff enger
    // gefasst hat — eine Spur, die Schritt 2 überspringt, war „vollständig
    // konform" und stand damit über einer Liste ihrer eigenen Abweichungen.
    const namen = new Set(KETTE.map((s) => s.name!.toLowerCase()));
    const altKonform = traces.filter((t) =>
      t.activities.every((a) => namen.has(a.toLowerCase())),
    ).length;
    expect(Math.round((altKonform / traces.length) * 10000) / 100).toBe(66.67);
  });

  it("weist den Sprung 1 → 3 als Kantenpaar aus, nicht als Knoten", () => {
    const r = analyseTraces(KETTE, traces);
    expect(r.deviationEdges).toEqual([
      {
        fromElementId: "Task_1",
        toElementId: "Task_3",
        frequency: 1,
        share: 1,
      },
    ]);
  });

  it("meldet die unmodellierte Aktivität als Fitness-Lücke, nicht als Kante", () => {
    const r = analyseTraces(KETTE, traces);
    expect(r.fitnessGaps).toHaveLength(1);
    expect(r.fitnessGaps[0]).toMatchObject({
      activity: "Rückfrage stellen",
      type: "unexpected",
      frequency: 1,
    });
    // Ist ein Ende gar nicht modelliert, gibt es kein zeichenbares Kantenpaar.
    // Genau deshalb entsteht aus c3 KEINE zusätzliche Kante.
    expect(r.deviationEdges.some((e) => e.fromElementId === "Task_3")).toBe(
      false,
    );
  });
});

describe("analyseTraces — die Ränder", () => {
  it("meldet 0 % statt NaN, wenn es keine Spur gibt", () => {
    const r = analyseTraces(KETTE, []);
    expect(r.score).toBe(0);
    expect(r.totalTraces).toBe(0);
    expect(r.fitnessGaps).toEqual([]);
    expect(r.deviationEdges).toEqual([]);
  });

  it("meldet 100 %, wenn jede Spur dem Modell folgt", () => {
    const r = analyseTraces(KETTE, [
      spur("c1", "Antrag erfassen", "Antrag prüfen", "Antrag bescheiden"),
      spur("c2", "Antrag erfassen", "Antrag prüfen"),
    ]);
    expect(r.score).toBe(100);
    expect(r.deviationEdges).toEqual([]);
  });

  it("vergleicht Aktivitätsnamen ohne Rücksicht auf Gross- und Kleinschreibung", () => {
    // Der Ereignisimport bekommt seine Namen aus fremden Systemen; eine
    // Abweichung in der Schreibung ist keine Prozessabweichung.
    const r = analyseTraces(KETTE, [
      spur("c1", "ANTRAG ERFASSEN", "antrag prüfen", "Antrag Bescheiden"),
    ]);
    expect(r.score).toBe(100);
    expect(r.fitnessGaps).toEqual([]);
  });

  it("zählt eine Wiederholung als Schleife, ohne sie zur Kante zu machen", () => {
    const r = analyseTraces(KETTE, [
      spur(
        "c1",
        "Antrag erfassen",
        "Antrag prüfen",
        "Antrag erfassen",
        "Antrag prüfen",
        "Antrag bescheiden",
      ),
    ]);
    expect(r.reworkLoops).toEqual([
      { activity: "Antrag erfassen", repeatOccurrences: 1 },
      { activity: "Antrag prüfen", repeatOccurrences: 1 },
    ]);
    // 2 → 1 ist ein Rücksprung: modelliert sind sie nicht benachbart in
    // dieser Richtung, also IST das eine Abweichungskante.
    expect(
      r.deviationEdges.some(
        (e) => e.fromElementId === "Task_2" && e.toElementId === "Task_1",
      ),
    ).toBe(true);
  });

  it("wertet eine unmittelbare Wiederholung nicht als Übergang", () => {
    // `vorher !== a` — zweimal derselbe Schritt hintereinander ist keine
    // Kante zwischen zwei Elementen.
    const r = analyseTraces(KETTE, [
      spur("c1", "Antrag erfassen", "Antrag erfassen", "Antrag prüfen"),
    ]);
    expect(r.deviationEdges).toEqual([]);
    expect(r.score).toBe(100);
  });

  it("erzeugt keine Kante, wenn ein Schritt keine BPMN-Kennung trägt", () => {
    // Ohne Kennung liesse sich die Kante im Diagramm nicht zeichnen. Eine
    // Kante mit erfundenem Endpunkt wäre schlimmer als keine.
    const ohneKennung: ModelledStep[] = [
      { name: "Antrag erfassen", bpmnElementId: null, sequenceOrder: 1 },
      { name: "Antrag prüfen", bpmnElementId: "Task_2", sequenceOrder: 2 },
      { name: "Antrag bescheiden", bpmnElementId: "Task_3", sequenceOrder: 3 },
    ];
    const r = analyseTraces(ohneKennung, [
      spur("c1", "Antrag erfassen", "Antrag bescheiden"),
    ]);
    expect(r.deviationEdges).toEqual([]);
    // Und die Spur gilt dann auch als konform — die Abweichung ist nicht
    // feststellbar, also wird sie nicht behauptet.
    expect(r.score).toBe(100);
  });

  it("verträgt einen Schritt ohne Namen, ohne ihn als leere Aktivität zu führen", () => {
    const mitLuecke: ModelledStep[] = [
      ...KETTE,
      { name: null, bpmnElementId: "Task_4", sequenceOrder: 4 },
    ];
    const r = analyseTraces(mitLuecke, [
      spur("c1", "Antrag erfassen", "Antrag prüfen"),
    ]);
    expect(r.score).toBe(100);
    expect(r.fitnessGaps).toEqual([]);
  });

  it("verteilt den Anteil über alle Abweichungskanten und summiert auf 1", () => {
    const r = analyseTraces(KETTE, [
      spur("c1", "Antrag erfassen", "Antrag bescheiden"),
      spur("c2", "Antrag erfassen", "Antrag bescheiden"),
      spur("c3", "Antrag bescheiden", "Antrag erfassen"),
    ]);
    const summe = r.deviationEdges.reduce((a, e) => a + e.share, 0);
    expect(summe).toBeCloseTo(1, 4);
    // Die häufigere Kante steht vorn.
    expect(r.deviationEdges[0]!.frequency).toBe(2);
  });

  it("gibt den Anteil der Fitness-Lücken an den beobachteten Ereignissen an", () => {
    const r = analyseTraces(KETTE, [
      spur("c1", "Antrag erfassen", "Fremdschritt", "Antrag prüfen"),
    ]);
    expect(r.observedEvents).toBe(3);
    expect(r.fitnessGaps[0]!.percentage).toBe(33.33);
  });
});

/* ------------------------------------------------------------------ *
 * [ARCTOS-FULL-2026-08-31 · OP-012] Kantenkennzahlen
 * ------------------------------------------------------------------ */

describe("analyseTraces — beobachtete Übergänge (OP-012)", () => {
  it("zählt AUCH die modellkonformen Übergänge", () => {
    // Der Abweichungszähler (OP-014) trägt nur, was das Modell nicht
    // verbindet. Für eine Kantenhäufigkeit braucht es die anderen ebenso —
    // sonst hätte jede eingehaltene Kante die Häufigkeit null, und die
    // Strichstärke im Diagramm sagte das Gegenteil der Wirklichkeit.
    const r = analyseTraces(KETTE, [
      spur("c1", "Antrag erfassen", "Antrag prüfen", "Antrag bescheiden"),
      spur("c2", "Antrag erfassen", "Antrag prüfen", "Antrag bescheiden"),
    ]);
    const t12 = r.transitions.find(
      (t) => t.fromElementId === "Task_1" && t.toElementId === "Task_2",
    );
    expect(t12?.frequency).toBe(2);
    expect(t12?.isModelled).toBe(true);
    expect(r.deviationEdges).toHaveLength(0);
  });

  it("rechnet die Verzweigungsquote über die Abgänge desselben Knotens", () => {
    // Drei Fälle ab Task_1: zweimal zu Task_2, einmal zu Task_3.
    const r = analyseTraces(KETTE, [
      spur("c1", "Antrag erfassen", "Antrag prüfen"),
      spur("c2", "Antrag erfassen", "Antrag prüfen"),
      spur("c3", "Antrag erfassen", "Antrag bescheiden"),
    ]);
    const ab1 = r.transitions.filter((t) => t.fromElementId === "Task_1");
    const summe = ab1.reduce((a, t) => a + t.probability, 0);
    // Die Quoten ab einem Knoten summieren sich auf 1 — das ist die
    // Zusicherung, an der man merkt, dass der Nenner stimmt.
    expect(Math.round(summe * 100000) / 100000).toBe(1);
    expect(
      ab1.find((t) => t.toElementId === "Task_2")?.probability,
    ).toBeCloseTo(2 / 3, 5);
  });

  it("führt einen abweichenden Übergang als beobachtet UND als Abweichung", () => {
    const r = analyseTraces(KETTE, [
      spur("c1", "Antrag erfassen", "Antrag bescheiden"),
    ]);
    const t13 = r.transitions.find(
      (t) => t.fromElementId === "Task_1" && t.toElementId === "Task_3",
    );
    expect(t13?.frequency).toBe(1);
    expect(t13?.isModelled).toBe(false);
    expect(r.deviationEdges).toHaveLength(1);
  });

  it("erzeugt keinen Übergang, wenn ein Ende nicht modelliert ist", () => {
    // Ein Übergang, dessen eines Ende im Diagramm gar nicht vorkommt, lässt
    // sich nicht zeichnen. Er ist eine Fitness-Lücke, keine Kante.
    const r = analyseTraces(KETTE, [
      spur("c1", "Antrag erfassen", "Rückfrage stellen"),
    ]);
    expect(r.transitions).toHaveLength(0);
    expect(r.fitnessGaps.map((g) => g.activity)).toEqual(["Rückfrage stellen"]);
  });

  it("zählt zweimal denselben Schritt hintereinander nicht als Übergang", () => {
    const r = analyseTraces(KETTE, [
      spur("c1", "Antrag erfassen", "Antrag erfassen", "Antrag prüfen"),
    ]);
    expect(
      r.transitions.filter((t) => t.fromElementId === t.toElementId),
    ).toHaveLength(0);
    expect(
      r.transitions.find((t) => t.toElementId === "Task_2")?.frequency,
    ).toBe(1);
  });

  it("ist reihenfolgestabil — gleiche Spuren, gleiche Liste", () => {
    // Sonst hinge die Strichstärke im Diagramm an der Reihenfolge, in der die
    // Datenbank die Fälle liefert.
    const traces = [
      spur("c1", "Antrag erfassen", "Antrag prüfen"),
      spur("c2", "Antrag erfassen", "Antrag bescheiden"),
    ];
    const a = analyseTraces(KETTE, traces);
    const b = analyseTraces(KETTE, [...traces].reverse());
    expect(JSON.stringify(a.transitions)).toBe(JSON.stringify(b.transitions));
  });

  it("liefert ohne Spuren eine leere Liste statt einer Null-Quote", () => {
    expect(analyseTraces(KETTE, []).transitions).toEqual([]);
  });
});
