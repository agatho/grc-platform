/**
 * [ARCTOS-FULL-2026-08-31 · OP-030] Die Gruppenbeschriftung gegen die Referenz.
 *
 * `labels.test.ts` beweist, dass ARCTOS die Beschriftung einer Gruppe jetzt
 * über `bpmn:CategoryValue` schreibt und dass sie den Round-Trip übersteht.
 * Das beantwortet „tut es, was wir sagen". Offen bleibt die teurere Frage:
 * **ist es dieselbe Form, die der Rest der Welt liest?**
 *
 * Solange `bpmn-js` im Baum liegt, lässt sich das messen statt behaupten —
 * das ist der ausdrückliche Zweck des Schattenlaufs (siehe den Kopf von
 * `src/verify/drivers/bpmnjs.ts`). Dieser Test lässt beide Werkzeuge
 * dasselbe tun: eine Gruppe anlegen, sie beschriften, das Dokument schreiben.
 * Verglichen wird nicht Byte für Byte — Reihenfolge und ID-Vergabe dürfen
 * abweichen —, sondern die **Struktur**, an der ein Fremdwerkzeug den Text
 * findet:
 *
 *   `bpmn:group/@categoryValueRef` → `bpmn:categoryValue/@value`,
 *   und diese `categoryValue` unter einer `bpmn:category` in `rootElements`.
 *
 * Ohne diesen Test wäre auch eine Lösung grün, die den Text zwar verlustfrei
 * durch den EIGENEN Round-Trip trägt, ihn aber an eine Stelle schreibt, an
 * der Camunda oder Signavio ihn nicht suchen — und das war der gemeldete
 * Schaden.
 *
 * Der Test überspringt sich selbst, wenn `bpmn-js` nicht mehr installiert
 * ist; dieselbe Bedingung, unter der `shadow.test.ts` verschwindet.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installBpmnJsSupport } from "./jsdom-svg";
import { isBpmnJsAvailable, loadBpmnJs } from "../../src/verify/drivers/bpmnjs";
import { ModelingSession } from "../../src/modeling/session";
import { boOf } from "../../src/modeling/util";
import { labelText } from "../../src/modeling/labels";
import type { BpmnShape } from "../../src/modeling/types";

installBpmnJsSupport();

const XML = readFileSync(
  join(__dirname, "../corpus/synth-data-objects-and-artifacts.bpmn"),
  "utf8",
);

/**
 * Wo steht der Text einer Gruppe im geschriebenen Dokument?
 *
 * Bewusst über den XML-Text und nicht über das Modell des schreibenden
 * Werkzeugs: die Frage ist, was in der DATEI steht, und beide Engines haben
 * ihre eigene Sicht darauf, was „im Modell" heisst.
 */
function groupLabelShape(xml: string): {
  groupRefs: string[];
  values: Record<string, string>;
  categoryCount: number;
} {
  const groupRefs = [
    ...xml.matchAll(/<bpmn2?:?group\b[^>]*categoryValueRef="([^"]+)"/gi),
  ].map((m) => m[1]!);
  const values: Record<string, string> = {};
  for (const m of xml.matchAll(
    /<bpmn2?:?categoryValue\b[^>]*id="([^"]+)"[^>]*value="([^"]*)"/gi,
  )) {
    values[m[1]!] = m[2]!;
  }
  // Auch die umgekehrte Attributreihenfolge — `moddle` und `bpmn-js`
  // schreiben nicht garantiert dieselbe.
  for (const m of xml.matchAll(
    /<bpmn2?:?categoryValue\b[^>]*value="([^"]*)"[^>]*id="([^"]+)"/gi,
  )) {
    values[m[2]!] = m[1]!;
  }
  const categoryCount = [...xml.matchAll(/<bpmn2?:?category\b/gi)].length;
  return { groupRefs, values, categoryCount };
}

async function arctosResult(): Promise<string> {
  const container = document.createElement("div");
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
  const session = new ModelingSession({ container });
  await session.importXml(XML);

  session.modeling.updateLabel(session.shape("Group_1"), "Kreditvergabe");
  const created = session.modeling.createShape(
    { type: "bpmn:Group" } as never,
    { x: 700, y: 500 } as never,
    session.root() as never,
  ) as unknown as BpmnShape;
  session.modeling.updateLabel(created, "Nebenprozess");

  const xml = await session.exportXml();
  session.destroy();
  container.remove();
  return xml;
}

async function bpmnJsResult(): Promise<string> {
  const Modeler = (await loadBpmnJs())!;
  const container = document.createElement("div");
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
  const modeler = new Modeler({ container });
  await modeler.importXML(XML);

  const registry = modeler.get("elementRegistry");
  const modeling = modeler.get("modeling") as unknown as {
    updateLabel(element: unknown, text: string): void;
    createShape(shape: unknown, position: unknown, parent: unknown): unknown;
  };
  const elementFactory = modeler.get("elementFactory") as unknown as {
    createShape(attrs: Record<string, unknown>): unknown;
  };
  const canvas = modeler.get("canvas");

  modeling.updateLabel(registry.get("Group_1"), "Kreditvergabe");
  const created = modeling.createShape(
    elementFactory.createShape({ type: "bpmn:Group" }),
    { x: 700, y: 500 },
    canvas.getRootElement(),
  );
  modeling.updateLabel(created, "Nebenprozess");

  const { xml } = await modeler.saveXML({ format: true });
  modeler.destroy();
  container.remove();
  return xml ?? "";
}

describe("OP-030 · Gruppenbeschriftung — dieselbe Form wie die Referenz", () => {
  let available = false;
  beforeAll(async () => {
    available = await isBpmnJsAvailable();
  });

  it("ARCTOS und bpmn-js legen den Text an derselben Stelle ab", async () => {
    if (!available) {
      // Kein stiller Erfolg: wenn die Referenz weg ist, hat dieser Test
      // seinen Zweck verloren und gehört mit dem Rest von test/verify/
      // gelöscht — nicht dauerhaft grün mitgeschleppt.
      expect(available).toBe(false);
      return;
    }

    const ours = groupLabelShape(await arctosResult());
    const theirs = groupLabelShape(await bpmnJsResult());

    // 1. Beide Gruppen tragen einen Verweis — keine schreibt einen `name`.
    expect(ours.groupRefs).toHaveLength(2);
    expect(theirs.groupRefs).toHaveLength(2);

    // 2. Die Verweise lösen in beiden Dokumenten auf dieselben Texte auf.
    const textsOf = (r: ReturnType<typeof groupLabelShape>) =>
      r.groupRefs.map((ref) => r.values[ref]).sort();
    expect(textsOf(ours)).toEqual(["Kreditvergabe", "Nebenprozess"]);
    expect(textsOf(ours)).toEqual(textsOf(theirs));

    // 3. Für die neu angelegte Gruppe entsteht in beiden Werkzeugen genau
    //    EINE zusätzliche Kategorie — die Vorlage bringt eine mit.
    expect(ours.categoryCount).toBe(2);
    expect(theirs.categoryCount).toBe(2);
  });

  it("die Referenz liest, was ARCTOS geschrieben hat", async () => {
    if (!available) {
      expect(available).toBe(false);
      return;
    }
    // Die Gegenrichtung, und die eigentlich interessante: ein Fremdwerkzeug
    // muss unsere Datei öffnen und die Beschriftung finden. `bpmn-js` steht
    // hier stellvertretend für jedes Werkzeug, das dieselbe Bibliothek
    // benutzt — und das sind die meisten.
    const xml = await arctosResult();
    const Modeler = (await loadBpmnJs())!;
    const container = document.createElement("div");
    container.style.width = "1200px";
    container.style.height = "800px";
    document.body.appendChild(container);
    const modeler = new Modeler({ container });
    await modeler.importXML(xml);
    const registry = modeler.get("elementRegistry");
    const group = registry.get("Group_1")!;
    const category = group.businessObject?.["categoryValueRef"] as
      Record<string, unknown> | undefined;
    expect(category?.["value"]).toBe("Kreditvergabe");
    modeler.destroy();
    container.remove();

    // Und zur Gegenprobe dieselbe Frage an die eigene Engine, damit ein
    // grüner Lauf nicht daran liegen kann, dass beide dasselbe falsch tun:
    // die Textquelle ist `labelText()`, also der Weg, den der Editor geht.
    const own = new ModelingSession({
      container: document.createElement("div"),
    });
    await own.importXml(xml);
    expect(labelText(boOf(own.shape("Group_1")))).toBe("Kreditvergabe");
    own.destroy();
  });
});
