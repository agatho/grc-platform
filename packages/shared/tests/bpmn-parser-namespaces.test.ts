/**
 * [ARCTOS-FULL-2026-08-31 · OP-037] Der Parser liest Namensräume, nicht
 * Präfixe.
 *
 * **Reproduktion, gemessen am 2026-09-02** gegen dasselbe Dokument mit fünf
 * verschiedenen Präfixen:
 *
 * ```
 * prefix="bpmn:"      → 3 Schritte
 * prefix=""           → 3 Schritte
 * prefix="ns0:"       → Fehler „missing <bpmn:definitions> root element"
 * prefix="b:"         → Fehler „missing <bpmn:definitions> root element"
 * prefix="semantic:"  → Fehler „missing <bpmn:definitions> root element"
 * ```
 *
 * Die alte Fassung verglich `parsed["bpmn:definitions"] ||
 * parsed["definitions"]` — also Präfixe. `ns0:` schreiben Werkzeuge auf
 * JAXB-Basis, `semantic:` schreibt Signavio; beides sind gültige BPMN-2.0-
 * Dokumente. Das ist der Kern von OP-037: zwei Interpretationen desselben
 * Formats, von denen eine falsch liegt.
 *
 * Diese Datei ist der Wächter darüber, dass die Interpretation die von
 * `@grc/bpmn` bleibt.
 */

import { describe, expect, it } from "vitest";

import { parseBpmnXml, validateBpmnXml } from "../src/bpmn-parser";

const MODEL_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";

/** Dasselbe Dokument, einmal je Präfix. */
function document(prefix: string): string {
  const tag = prefix === "" ? "" : `${prefix}:`;
  const xmlns = prefix === "" ? "xmlns" : `xmlns:${prefix}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<${tag}definitions ${xmlns}="${MODEL_NS}" id="Definitions_1">
  <${tag}process id="Process_1" isExecutable="false">
    <${tag}startEvent id="Start_1" name="Antrag eingegangen" />
    <${tag}task id="Task_1" name="Antrag pruefen" />
    <${tag}exclusiveGateway id="Gw_1" name="Vollstaendig?" />
    <${tag}endEvent id="End_1" name="Fertig" />
  </${tag}process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="D_1" />
</${tag}definitions>`;
}

describe("OP-037 — Präfixe spielen keine Rolle", () => {
  it("liest dasselbe Dokument unter jedem Präfix gleich", () => {
    const referenz = parseBpmnXml(document("bpmn"));
    expect(referenz.map((step) => step.bpmnElementId)).toEqual([
      "Start_1",
      "Task_1",
      "Gw_1",
      "End_1",
    ]);

    for (const prefix of ["", "ns0", "b", "semantic", "camunda"]) {
      expect(
        parseBpmnXml(document(prefix)),
        `Präfix „${prefix}" wird anders gelesen als „bpmn"`,
      ).toEqual(referenz);
    }
  });

  it("lehnt ein Dokument in einem fremden Namensraum ab", () => {
    // Das Gegenstück: derselbe lokale Name, anderer Namensraum. Ihn zu
    // akzeptieren wäre die Kehrseite desselben Fehlers — Namen ohne
    // Namensraum zu vergleichen.
    const fremd = document("bpmn").replace(
      MODEL_NS,
      "http://example.test/not-bpmn",
    );
    expect(() => parseBpmnXml(fremd)).toThrow(/definitions/);
  });

  it("nimmt ein Dokument ganz ohne Namensraum — der Excel-Import erzeugt solche", () => {
    const ohne = `<?xml version="1.0" encoding="UTF-8"?>
<definitions id="D">
  <process id="P">
    <startEvent id="S" name="Start" />
    <task id="T" name="Tun" />
    <endEvent id="E" name="Ende" />
  </process>
</definitions>`;
    expect(parseBpmnXml(ohne).map((step) => step.bpmnElementId)).toEqual([
      "S",
      "T",
      "E",
    ]);
  });
});

describe("OP-037 — Dokumentreihenfolge statt Gruppierung nach Tag", () => {
  it("nummeriert in der Reihenfolge, in der die Elemente stehen", () => {
    // `fast-xml-parser` bündelte gleiche Tags; die Reihenfolge folgte damit
    // den Tag-*Namen*. Bei diesem Dokument kam Start, Aufgabe, Aufgabe, Ende
    // heraus — obwohl das Ende in der Mitte steht.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${MODEL_NS}" id="D">
  <bpmn:process id="P">
    <bpmn:startEvent id="A" />
    <bpmn:task id="B" />
    <bpmn:endEvent id="C" />
    <bpmn:task id="D" />
  </bpmn:process>
</bpmn:definitions>`;
    expect(parseBpmnXml(xml).map((step) => step.bpmnElementId)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("betritt einen Subprozess an der Stelle, an der er steht", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${MODEL_NS}" id="D">
  <bpmn:process id="P">
    <bpmn:startEvent id="A" />
    <bpmn:subProcess id="Sub">
      <bpmn:task id="Sub_1" />
      <bpmn:task id="Sub_2" />
    </bpmn:subProcess>
    <bpmn:endEvent id="Z" />
  </bpmn:process>
</bpmn:definitions>`;
    const steps = parseBpmnXml(xml);
    expect(steps.map((step) => step.bpmnElementId)).toEqual([
      "A",
      "Sub",
      "Sub_1",
      "Sub_2",
      "Z",
    ]);
    // Und lückenlos von 1 an — daran hängt `process_step.sequence_order`.
    expect(steps.map((step) => step.sequenceOrder)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("OP-037 — Fremdes bleibt draußen", () => {
  it("zählt ein <task> aus einem fremden Namensraum nicht mit", () => {
    // Camunda-, Signavio- und Zeebe-Erweiterungen führen eigene Elemente in
    // eigenen Namensräumen. Sie nach dem lokalen Namen mitzuzählen erzeugte
    // Schritte, die es fachlich nicht gibt.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${MODEL_NS}" xmlns:x="http://example.test/x" id="D">
  <bpmn:process id="P">
    <bpmn:task id="Echt" name="Echt" />
    <x:task id="Fremd" name="Fremd" />
  </bpmn:process>
</bpmn:definitions>`;
    expect(parseBpmnXml(xml).map((step) => step.bpmnElementId)).toEqual([
      "Echt",
    ]);
  });

  it("übergeht ein Element ohne id, statt es mit leerer Kennung zu führen", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${MODEL_NS}" id="D">
  <bpmn:process id="P">
    <bpmn:task name="Ohne Kennung" />
    <bpmn:task id="Mit" name="Mit Kennung" />
  </bpmn:process>
</bpmn:definitions>`;
    expect(parseBpmnXml(xml).map((step) => step.bpmnElementId)).toEqual([
      "Mit",
    ]);
  });
});

describe("OP-037 — die Fehlermeldungen bleiben brauchbar", () => {
  it("nennt bei kaputtem XML die Stelle statt nur „ungültig“", () => {
    expect(() => parseBpmnXml("<bpmn:definitions><nicht-geschlossen>")).toThrow(
      /Invalid BPMN XML/,
    );
  });

  it("meldet ein Dokument ohne Prozess als solches", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${MODEL_NS}" id="D" />`;
    expect(() => parseBpmnXml(xml)).toThrow(/missing <bpmn:process>/);
  });

  it("reicht den Fehler unverändert an validateBpmnXml durch", () => {
    const result = validateBpmnXml("<kein-bpmn />");
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("XML parsing failed");
  });
});
