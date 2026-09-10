/**
 * [ARCTOS-FULL-2026-08-31 · OP-037] Der Wächter über die eine Interpretation.
 *
 * **Warum es diese Datei vorher nicht gab.** `grep -rl
 * "raci-engine\|walkthrough-engine" packages/shared/tests apps/web/src` ergab
 * am 2026-09-02 **null** Treffer: die beiden Motoren, die BPMN mit regulären
 * Ausdrücken lasen, liefen an keiner Stelle durch einen Test. Sie waren damit
 * die riskanteste der sechs Dateien aus OP-037 — falsch **und** unbeobachtet.
 *
 * Jeder Fall hier ist einer, den die alte Regex-Fassung nachweislich falsch
 * gemacht hat. Die Kommentare nennen ihn.
 */

import { describe, expect, it } from "vitest";

import {
  extractBpmn,
  laneNameByNode,
  nodesOfType,
} from "../src/lib/bpmn-extract";
import { deriveRACIFromBPMN } from "../src/lib/bpmn-raci-engine";
import { deriveWalkthroughFromBPMN } from "../src/lib/bpmn-walkthrough-engine";

const NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";

/** Ein Pool mit zwei Lanes, vier Knoten und drei Kanten — je Präfix. */
function collaboration(prefix: string): string {
  const t = prefix === "" ? "" : `${prefix}:`;
  const xmlns = prefix === "" ? "xmlns" : `xmlns:${prefix}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<${t}definitions ${xmlns}="${NS}" id="D">
  <${t}process id="P">
    <${t}laneSet id="LS">
      <${t}lane id="L1" name="Vertrieb">
        <${t}flowNodeRef>Start_1</${t}flowNodeRef>
        <${t}flowNodeRef>Task_1</${t}flowNodeRef>
      </${t}lane>
      <${t}lane id="L2" name="Buchhaltung">
        <${t}flowNodeRef>Task_2</${t}flowNodeRef>
        <${t}flowNodeRef>End_1</${t}flowNodeRef>
      </${t}lane>
    </${t}laneSet>
    <${t}startEvent id="Start_1" name="Anfrage" />
    <${t}task id="Task_1" name="Angebot erstellen" />
    <${t}userTask id="Task_2" name="Rechnung pruefen" />
    <${t}endEvent id="End_1" name="Fertig" />
    <${t}sequenceFlow id="F1" sourceRef="Start_1" targetRef="Task_1" />
    <${t}sequenceFlow id="F2" sourceRef="Task_1" targetRef="Task_2" />
    <${t}sequenceFlow id="F3" sourceRef="Task_2" targetRef="End_1" />
  </${t}process>
</${t}definitions>`;
}

describe("extractBpmn — Präfixe und Namensräume", () => {
  it("liest dasselbe Dokument unter jedem Präfix gleich", () => {
    const referenz = extractBpmn(collaboration("bpmn"));
    expect(referenz.lanes).toHaveLength(2);
    expect(referenz.nodes).toHaveLength(4);
    expect(referenz.flows).toHaveLength(3);

    for (const prefix of ["", "ns0", "semantic", "b"]) {
      const andere = extractBpmn(collaboration(prefix));
      expect(
        andere,
        `Präfix „${prefix}" wird anders gelesen als „bpmn"`,
      ).toEqual(referenz);
    }
  });

  it("zählt ein gleichnamiges Element aus einem fremden Namensraum nicht mit", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${NS}" xmlns:x="http://example.test/x" id="D">
  <bpmn:process id="P">
    <bpmn:task id="Echt" name="Echt" />
    <x:task id="Fremd" name="Fremd" />
    <x:sequenceFlow id="FF" sourceRef="a" targetRef="b" />
  </bpmn:process>
</bpmn:definitions>`;
    const extracted = extractBpmn(xml);
    expect(extracted.nodes.map((n) => n.id)).toEqual(["Echt"]);
    expect(extracted.flows).toHaveLength(0);
  });
});

describe("extractBpmn — was die regulären Ausdrücke falsch machten", () => {
  it("findet eine Lane, deren Attribute in anderer Reihenfolge stehen", () => {
    // `/<bpmn:lane\\s+id="([^"]+)"…/` verlangte `id` zuerst. In XML ist die
    // Attributreihenfolge bedeutungslos.
    const xml = `<bpmn:definitions xmlns:bpmn="${NS}" id="D"><bpmn:process id="P">
      <bpmn:lane name="Vertrieb" id="L1"><bpmn:flowNodeRef>T</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:task id="T" name="Tun" />
    </bpmn:process></bpmn:definitions>`;
    expect(extractBpmn(xml).lanes[0]).toEqual({
      id: "L1",
      name: "Vertrieb",
      flowNodeRefs: ["T"],
    });
  });

  it("findet eine leere, selbstschliessende Lane", () => {
    // Der alte Ausdruck brauchte ein schliessendes `</bpmn:lane>`.
    const xml = `<bpmn:definitions xmlns:bpmn="${NS}" id="D"><bpmn:process id="P">
      <bpmn:lane id="L1" name="Leer" />
    </bpmn:process></bpmn:definitions>`;
    expect(extractBpmn(xml).lanes).toEqual([
      { id: "L1", name: "Leer", flowNodeRefs: [] },
    ]);
  });

  it("übergeht ein auskommentiertes Element", () => {
    // Ein Kommentar ist kein Element. Der reguläre Ausdruck sah den
    // Unterschied nicht.
    const xml = `<bpmn:definitions xmlns:bpmn="${NS}" id="D"><bpmn:process id="P">
      <!-- <bpmn:task id="Auskommentiert" name="Weg" /> -->
      <bpmn:task id="Echt" name="Da" />
    </bpmn:process></bpmn:definitions>`;
    expect(extractBpmn(xml).nodes.map((n) => n.id)).toEqual(["Echt"]);
  });

  it("dekodiert Entitäten im Namen", () => {
    // `name="a &gt; b"` war für den regulären Ausdruck der Text `a &gt; b`.
    const xml = `<bpmn:definitions xmlns:bpmn="${NS}" id="D"><bpmn:process id="P">
      <bpmn:task id="T" name="Betrag &gt; 1.000 &amp; Freigabe" />
    </bpmn:process></bpmn:definitions>`;
    expect(extractBpmn(xml).nodes[0]?.name).toBe("Betrag > 1.000 & Freigabe");
  });

  it("liefert einen leeren Auszug statt zu werfen, wenn das XML kaputt ist", () => {
    // Die Motoren sind Auswertungen, keine Prüfer: bei kaputter Eingabe sollen
    // sie nichts finden, nicht die aufrufende Seite mitreissen.
    const leer = extractBpmn("<bpmn:definitions><nicht-geschlossen>");
    expect(leer.nodes).toHaveLength(0);
    expect(leer.lanes).toHaveLength(0);
  });
});

describe("extractBpmn — Hilfsformen", () => {
  it("filtert Knoten nach lokalem Namen", () => {
    const extracted = extractBpmn(collaboration("bpmn"));
    expect(
      nodesOfType(extracted, new Set(["task", "userTask"])).map((n) => n.id),
    ).toEqual(["Task_1", "Task_2"]);
  });

  it("bildet Knoten auf Lane-Namen ab", () => {
    const mapping = laneNameByNode(extractBpmn(collaboration("bpmn")));
    expect(mapping.get("Task_1")).toBe("Vertrieb");
    expect(mapping.get("Task_2")).toBe("Buchhaltung");
    expect(mapping.get("gibt-es-nicht")).toBeUndefined();
  });

  it("ordnet dataInputAssociation dem Quellknoten zu", () => {
    const xml = `<bpmn:definitions xmlns:bpmn="${NS}" id="D"><bpmn:process id="P">
      <bpmn:task id="T" name="Tun">
        <bpmn:dataInputAssociation id="DIA">
          <bpmn:sourceRef>T</bpmn:sourceRef>
          <bpmn:targetRef>Doc_1</bpmn:targetRef>
        </bpmn:dataInputAssociation>
      </bpmn:task>
    </bpmn:process></bpmn:definitions>`;
    expect(extractBpmn(xml).dataInputsByNode.get("T")).toEqual(["Doc_1"]);
  });
});

describe("Die beiden Motoren, die vorher keinen Test hatten", () => {
  it("leitet eine RACI-Matrix aus Lanes und Aufgaben ab — auch mit fremdem Präfix", () => {
    const bpmn = deriveRACIFromBPMN(collaboration("bpmn"));
    const ns0 = deriveRACIFromBPMN(collaboration("ns0"));

    expect(bpmn.entries.length).toBeGreaterThan(0);
    // Vor dieser Welle war die zweite Matrix leer: der reguläre Ausdruck fand
    // unter `ns0:` weder Lane noch Aufgabe.
    expect(ns0.entries).toEqual(bpmn.entries);

    const angebot = bpmn.entries.find((e) => e.activityId === "Task_1");
    expect(angebot?.participantName).toBe("Vertrieb");
    expect(angebot?.role).toBe("R");
  });

  it("leitet eine Durchsprache ab — auch mit fremdem Präfix", () => {
    const bpmn = deriveWalkthroughFromBPMN(collaboration("bpmn"));
    const ns0 = deriveWalkthroughFromBPMN(collaboration("ns0"));

    expect(bpmn.length).toBeGreaterThan(0);
    expect(ns0).toEqual(bpmn);
    expect(JSON.stringify(bpmn)).toContain("Task_1");
  });

  it("liefert für ein Dokument ohne Lanes und ohne Kanten nichts, statt zu werfen", () => {
    const xml = `<bpmn:definitions xmlns:bpmn="${NS}" id="D"><bpmn:process id="P" /></bpmn:definitions>`;
    expect(() => deriveRACIFromBPMN(xml)).not.toThrow();
    expect(() => deriveWalkthroughFromBPMN(xml)).not.toThrow();
  });
});
