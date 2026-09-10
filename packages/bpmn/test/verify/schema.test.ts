import { describe, expect, it } from "vitest";
import { loadCorpus } from "../model/corpus";
import {
  checkSchema,
  formatSchemaFindings,
  type SchemaFinding,
} from "../../src/verify/schema";
import { arctosModdle } from "../../src/model/moddle";

/**
 * Wächter der Schemaprüfung — Welle 2a, OP-043.
 *
 * Zwei Aussagen, und die erste ist die wichtigere:
 *
 *  1. **Der Prüfer findet, was `bpmn-moddle` verschluckt.** Der Beleg dafür
 *     steht als Test daneben: dasselbe Dokument einmal durch den Prüfer und
 *     einmal durch `moddle.fromXML`, und der Vergleich zeigt, dass moddle den
 *     Fehler nicht nur nicht meldet, sondern den Wert *umdeutet*.
 *  2. **Der ganze Korpus ist sauber.** 53 Dateien, kein Befund — sonst prüfte
 *     der Prüfer gegen ein Schema, das das eigene Prüfmaterial verletzt.
 */

function first(findings: readonly SchemaFinding[]): SchemaFinding {
  const finding = findings[0];
  if (!finding) throw new Error("erwartet wurde mindestens ein Befund");
  return finding;
}

const HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_S" targetNamespace="http://arctos.dev/bpmn">`;

function document(body: string): string {
  return `${HEADER}\n  <bpmn:process id="Process_S" isExecutable="false">\n${body}\n  </bpmn:process>\n</bpmn:definitions>`;
}

describe("OP-043 — lexikalische Schemaprüfung", () => {
  it('findet `cancelActivity="ja"`, das `bpmn-moddle` still zu `false` macht', async () => {
    const xml = document(
      `    <bpmn:task id="T"/>\n` +
        `    <bpmn:boundaryEvent id="B" attachedToRef="T" cancelActivity="ja"/>`,
    );

    // (a) Der Prüfer meldet es.
    const findings = checkSchema(xml);
    expect(findings).toHaveLength(1);
    expect(first(findings)).toMatchObject({
      kind: "attribute-type",
      element: "bpmn:boundaryEvent",
      elementId: "B",
      attribute: "cancelActivity",
      value: "ja",
      expected: "Boolean",
    });

    // (b) Und das ist der Grund, aus dem er auf dem Text arbeitet: der Parser
    //     meldet **nichts** und deutet den Wert um. `cancelActivity=false`
    //     heißt „nicht unterbrechend"; die Schemavorgabe ist `true`. Aus einem
    //     Tippfehler wird damit ein anderer Prozess.
    const parsed = await arctosModdle.fromXML(xml);
    expect(parsed.warnings).toHaveLength(0);
    const process = (
      parsed.rootElement["rootElements"] as { flowElements: unknown[] }[]
    )[0];
    const boundary = (
      process?.flowElements as { id?: string; cancelActivity?: unknown }[]
    ).find((element) => element.id === "B");
    expect(boundary?.cancelActivity).toBe(false);
  });

  it("akzeptiert alle vier Schreibweisen von `xsd:boolean` und keine fünfte", () => {
    for (const value of ["true", "false", "1", "0"]) {
      expect(
        checkSchema(
          document(
            `    <bpmn:task id="T"/>\n    <bpmn:boundaryEvent id="B" attachedToRef="T" cancelActivity="${value}"/>`,
          ),
        ),
        `"${value}" ist ein gültiges xsd:boolean`,
      ).toHaveLength(0);
    }
    for (const value of ["TRUE", "yes", "", " true"]) {
      expect(
        checkSchema(
          document(
            `    <bpmn:task id="T"/>\n    <bpmn:boundaryEvent id="B" attachedToRef="T" cancelActivity="${value}"/>`,
          ),
        ),
        `"${value}" ist kein gültiges xsd:boolean`,
      ).toHaveLength(1);
    }
  });

  it("meldet ein unbekanntes Attribut an einem bekannten Typ", () => {
    const findings = checkSchema(
      document(`    <bpmn:task id="T" laufzeit="12"/>`),
    );
    expect(first(findings)).toMatchObject({
      kind: "unknown-attribute",
      attribute: "laufzeit",
    });
  });

  it("lässt fremde Namensräume in Ruhe", () => {
    // Das Bewahren fremder Erweiterungen ist eine Zusage dieser Schicht; der
    // Prüfer darf sie nicht zur Beanstandung machen.
    expect(
      checkSchema(
        document(
          `    <bpmn:userTask id="T" camunda:assignee="demo" camunda:async="vielleicht"/>`,
        ),
      ),
    ).toHaveLength(0);
  });

  it("meldet ein Element, das im BPMN-Namensraum nicht deklariert ist", () => {
    const findings = checkSchema(
      document(`    <bpmn:zwischenschritt id="Z"/>`),
    );
    expect(first(findings)).toMatchObject({
      kind: "unknown-element",
      element: "bpmn:zwischenschritt",
    });
  });

  it("prüft auch die DI: `dc:Bounds/@width` muss eine Zahl sein", () => {
    const xml = `${HEADER}
  <bpmn:process id="Process_S"/>
  <bpmndi:BPMNDiagram id="D">
    <bpmndi:BPMNPlane id="P" bpmnElement="Process_S">
      <bpmndi:BPMNShape id="S_di" bpmnElement="Process_S">
        <dc:Bounds x="10" y="10" width="breit" height="80"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    const findings = checkSchema(xml);
    expect(first(findings)).toMatchObject({
      kind: "attribute-type",
      element: "dc:Bounds",
      attribute: "width",
      expected: "Real",
    });
    expect(first(findings).line).toBe(11);
  });

  it("liest nichts aus einem Kommentar", () => {
    // Die Zeilennummern müssen dabei stehen bleiben — sonst zeigt jeder Befund
    // in einer kommentierten Datei auf die falsche Zeile.
    const xml = document(
      `    <!-- <bpmn:boundaryEvent id="X" cancelActivity="ja"/> -->\n    <bpmn:task id="T" laufzeit="1"/>`,
    );
    const findings = checkSchema(xml);
    expect(findings).toHaveLength(1);
    expect(first(findings).attribute).toBe("laufzeit");
    // Zeile 9: sechs Zeilen Kopf, `<bpmn:process>`, der Kommentar, dann der
    // Task. Der Kommentar wird durch Leerzeichen gleicher Länge ersetzt,
    // damit genau diese Zählung stimmt.
    expect(first(findings).line).toBe(9);
  });

  it("hält den gesamten Korpus für schemakonform", () => {
    // Der eigentliche Nutzen im Alltag: 53 Dateien, die alle Prüfwerkzeuge
    // dieses Pakets als Eingabe benutzen. Wäre eine davon nicht konform, prüfte
    // jedes Werkzeug darüber gegen ungültiges BPMN.
    const dirty: string[] = [];
    for (const entry of loadCorpus()) {
      const findings = checkSchema(entry.xml);
      if (findings.length > 0) {
        dirty.push(`${entry.name}:\n${formatSchemaFindings(findings)}`);
      }
    }
    expect(dirty, dirty.join("\n\n")).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────
// [ARCTOS-FULL-2026-08-31 · Abnahme Welle 2] Der Formatierer, den bis
// hierher nichts ausgeführt hat.
//
// `formatSchemaFindings` wird im Korpustest oben aufgerufen — aber nur im
// Zweig `findings.length > 0`, und der Korpus ist sauber. Die Funktion lief
// also in keinem einzigen grünen Lauf. Das ist genau die Klasse, die dieser
// Audit wiederholt gefunden hat: Code, der ausschliesslich im Fehlerfall
// läuft, ist Code, den nie jemand hat laufen sehen. Wirft er, geht die
// Fehlermeldung verloren, die den Fehler erklären sollte — und der Test
// scheitert dann an seiner eigenen Diagnose statt an der Sache.
// ────────────────────────────────────────────────────────────────────

describe("formatSchemaFindings", () => {
  const befund = (over: Partial<SchemaFinding> = {}): SchemaFinding => ({
    kind: "unknown-attribute",
    element: "bpmn:task",
    line: 42,
    detail: "Erklärung.",
    ...over,
  });

  it("nennt Zeile, Art, Element und Erklärung", () => {
    const text = formatSchemaFindings([befund()]);
    expect(text).toContain("Zeile 42");
    expect(text).toContain("[unknown-attribute]");
    expect(text).toContain("bpmn:task");
    expect(text).toContain("Erklärung.");
  });

  it("hängt Kennung und Attribut an, wenn sie da sind", () => {
    const text = formatSchemaFindings([
      befund({ elementId: "Task_1", attribute: "cancelActivity" }),
    ]);
    expect(text).toContain("bpmn:task#Task_1/@cancelActivity");
  });

  it("lässt Kennung und Attribut weg, wenn sie fehlen — kein `#undefined`", () => {
    const text = formatSchemaFindings([befund()]);
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("#");
    expect(text).not.toContain("/@");
  });

  it("gibt für keinen Befund die leere Zeichenkette zurück", () => {
    // Der Aufrufer setzt das Ergebnis in eine Meldung ein; `""` ist dort
    // richtig, `"undefined"` wäre es nicht.
    expect(formatSchemaFindings([])).toBe("");
  });

  it("trennt mehrere Befunde zeilenweise und behält ihre Reihenfolge", () => {
    const zeilen = formatSchemaFindings([
      befund({ line: 7, detail: "erster" }),
      befund({ line: 9, detail: "zweiter" }),
    ]).split("\n");
    expect(zeilen).toHaveLength(4); // je Befund zwei Zeilen
    expect(zeilen[0]).toContain("Zeile 7");
    expect(zeilen[2]).toContain("Zeile 9");
  });
});
