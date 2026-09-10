/**
 * [ARCTOS-FULL-2026-08-31 · OP-163] Der XML-Vergleich des Shadow-Compare — und
 * der Nachweis, dass die Klasse `both-lossy` überhaupt auftreten KANN.
 *
 * Der Befund. `shadowCompare` vergleicht die exportierten Dokumente nur, wenn
 * `compareXml === true` gesetzt ist. Kein Aufrufer hat das getan. Da
 * `lossySignatures()` ausschliesslich `xml/…`-Signaturen erzeugt und `classify`
 * das Urteil `both-lossy` allein über diese Menge vergibt, konnte das Urteil
 * nicht vergeben werden: die Null im Bericht bedeutete nicht „bpmn-moddle
 * verliert nichts", sondern „auf dieser Ebene wird nicht gemessen".
 *
 * Diese Datei hält beide Hälften der Reparatur fest:
 *
 *   1. der XML-Vergleich ist standardmässig AN und filtert die Zeichenebene
 *      (DI/DC), die `compareSnapshots` mit Toleranzen ohnehin vergleicht;
 *   2. `lossySignatures()` zählt nur, was wirklich fehlt — nicht, was der
 *      LCS-Diff durch eine Sortierverschiebung zweimal meldet;
 *   3. eine Divergenz, deren Signatur in der Verlustmenge steht, wird
 *      tatsächlich als `both-lossy` klassifiziert. Ende zu Ende, durch
 *      `shadowCompare`, nicht durch einen Aufruf der internen Funktion.
 *
 * Die Treiber sind Attrappen. Das ist hier kein Ersatz, sondern das
 * Instrument: um zu zeigen, dass eine bestimmte Divergenzklasse den Weg durch
 * die Klassifikation findet, muss man diese Divergenz herstellen können — und
 * mit zwei echten Engines liesse sie sich nur beobachten, nicht erzeugen.
 */

import { describe, expect, it } from "vitest";
import type { ModelingDriver, OperationResult } from "../../src/verify/driver";
import type { CandidateKind } from "../../src/verify/operations";
import {
  isDiagramInterchange,
  lossySignatures,
  shadowCompare,
  summarize,
} from "../../src/verify/shadow";
import { editableBases } from "./bases";

/** Ein Treiber, der genau das Dokument zurückgibt, das man ihm mitgibt. */
class FixedDriver implements ModelingDriver {
  constructor(
    readonly name: string,
    private readonly xml: string,
  ) {}
  async load(): Promise<void> {}
  candidates(_kind: CandidateKind): readonly string[] {
    return [];
  }
  async apply(): Promise<OperationResult> {
    return { outcome: "rejected", resolved: [] };
  }
  async exportXml(): Promise<string> {
    return this.xml;
  }
  liveDefinitions(): undefined {
    return undefined;
  }
  destroy(): void {}
}

/**
 * Kleinstmögliches Dokument mit einem Attribut, das bpmn-moddle beim reinen
 * Lesen und Schreiben verliert. `isCollection="false"` ist der Vorgabewert der
 * Eigenschaft; moddle schreibt Vorgabewerte nicht zurück. Gemessen am
 * 2026-09-03 über das Korpus: dieselbe Ursache liegt hinter allen 13
 * Signaturen der Verlustmenge (`cancelActivity`, `instantiate`,
 * `eventGatewayType`, `isSequential`, `expressionLanguage`, `typeLanguage` —
 * plus Kommentare und Processing Instructions).
 */
const BASE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Defs_OP163" targetNamespace="http://arctos.invalid/op163">
  <bpmn:process id="Process_OP163" isExecutable="false">
    <bpmn:startEvent id="Start_1"/>
    <bpmn:dataObject id="Data_1" name="Beleg" isCollection="false"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_OP163">
      <bpmndi:BPMNShape id="Shape_Start_1" bpmnElement="Start_1">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** Dasselbe Dokument, aber ohne das Attribut, das moddle ohnehin verliert. */
const WITHOUT_IS_COLLECTION = BASE_XML.replace(' isCollection="false"', "");

/** Dasselbe Dokument mit einer reinen Geometrie-Abweichung (2 px). */
const SHIFTED_BOUNDS = BASE_XML.replace('x="100" y="100"', 'x="102" y="100"');

describe("OP-163 · Verlustmenge zählt nur, was wirklich fehlt", () => {
  it("meldet für das Prüfdokument genau die eine verlorene Eigenschaft", async () => {
    const lossy = [...(await lossySignatures(BASE_XML))];
    expect(lossy).toEqual([
      "xml/{http://www.omg.org/spec/BPMN/20100524/MODEL}dataObject/isCollection",
    ]);
  });

  // Die Messung, an der die alte Fassung scheiterte. `diffCanonical` sortiert
  // Geschwister; faellt EIN Attribut weg, aendert sich der Sortierschluessel
  // seines Elements und der ganze Block wandert — der Diff meldet ihn als
  // „entfernt" plus „hinzugefuegt". Auf `synth-boundary-events` wurden aus
  // einem verlorenen Attribut so 23 Diff-Zeilen und 12 Signaturen, darunter
  // `outgoing/<outgoing>`. Da eine Signatur bewusst inhaltsfrei ist, passte
  // sie danach auf JEDE outgoing-Differenz irgendeines anderen Dokuments und
  // haette dort „bpmn-moddle verliert das ohnehin" behauptet, wo bpmn-moddle
  // nichts verliert.
  it("zählt eine verschobene Zeile nicht als Verlust (synth-boundary-events)", async () => {
    const base = editableBases().find(
      (e) => e.name === "synth-boundary-events",
    );
    expect(base, "Korpusdokument synth-boundary-events fehlt").toBeDefined();
    const lossy = [...(await lossySignatures(base!.xml))];
    expect(lossy).toEqual([
      "xml/{http://www.omg.org/spec/BPMN/20100524/MODEL}boundaryEvent/cancelActivity",
    ]);
  });
});

describe("OP-163 · der XML-Vergleich ist an und filtert die Zeichenebene", () => {
  it("erkennt die DI/DC-Namensräume als Zeichenebene", () => {
    expect(
      isDiagramInterchange(
        "{http://www.omg.org/spec/DD/20100524/DC}Bounds",
        '@x="435"',
      ),
    ).toBe(true);
    expect(
      isDiagramInterchange(
        "{http://www.omg.org/spec/BPMN/20100524/MODEL}dataObject",
        '@isCollection="false"',
      ),
    ).toBe(false);
  });

  it("meldet eine reine Geometriedifferenz NICHT als XML-Divergenz", async () => {
    // Sie gehört `compareSnapshots` — dort mit Toleranz. Zweimal gemeldet,
    // einmal davon ohne Toleranz, wäre schlechter als einmal gemeldet.
    const result = await shadowCompare({
      baseXml: BASE_XML,
      ops: [],
      ours: new FixedDriver("arctos", BASE_XML),
      reference: new FixedDriver("bpmn-js", SHIFTED_BOUNDS),
    });
    expect(result.divergences.filter((d) => d.kind === "xml")).toEqual([]);
  });

  it("meldet eine semantische Differenz OHNE gesetzten Schalter", async () => {
    // Der Kern von OP-163: der Vergleich muss laufen, ohne dass ein Aufrufer
    // daran denkt. Vorher war `compareXml === true` verlangt, und kein
    // Aufrufer setzte es.
    const result = await shadowCompare({
      baseXml: BASE_XML,
      ops: [],
      ours: new FixedDriver("arctos", BASE_XML),
      reference: new FixedDriver("bpmn-js", WITHOUT_IS_COLLECTION),
    });
    expect(
      result.divergences.some((d) => d.kind === "xml"),
      "ohne XML-Vergleich bleibt die semantische Ebene ungeprüft",
    ).toBe(true);
  });
});

describe("OP-163 · both-lossy kann auftreten", () => {
  it("vergibt das Urteil für eine Divergenz aus der Verlustmenge", async () => {
    const result = await shadowCompare({
      baseXml: BASE_XML,
      ops: [],
      ours: new FixedDriver("arctos", BASE_XML),
      reference: new FixedDriver("bpmn-js", WITHOUT_IS_COLLECTION),
    });

    const bothLossy = result.divergences.filter(
      (d) => d.verdict === "both-lossy",
    );
    expect(
      bothLossy.length,
      "die Klasse both-lossy muss erreichbar sein — genau das war OP-163",
    ).toBeGreaterThan(0);
    expect(bothLossy.map((d) => d.signature)).toContain(
      "xml/{http://www.omg.org/spec/BPMN/20100524/MODEL}dataObject/isCollection",
    );
    expect(summarize(result.divergences)["both-lossy"]).toBe(bothLossy.length);
  });

  // Die Gegenprobe, und zugleich die Reproduktion des Befunds: mit
  // abgeschaltetem XML-Vergleich — dem Zustand vor dieser Welle — bleibt die
  // Klasse leer, obwohl dieselben zwei Dokumente denselben Unterschied tragen.
  it("bleibt bei abgeschaltetem XML-Vergleich leer — der Zustand vor OP-163", async () => {
    const result = await shadowCompare({
      baseXml: BASE_XML,
      ops: [],
      ours: new FixedDriver("arctos", BASE_XML),
      reference: new FixedDriver("bpmn-js", WITHOUT_IS_COLLECTION),
      compareXml: false,
    });
    expect(
      result.divergences.filter((d) => d.verdict === "both-lossy"),
    ).toEqual([]);
    expect(summarize(result.divergences)["both-lossy"]).toBeUndefined();
  });
});
