/// <reference lib="dom" />

/**
 * Typwechsel über das Menü (Auftrag Punkt 2, „Typ wechseln").
 *
 * Die beiden Punkte, auf die es ankommt, prüft diese Datei einzeln:
 *
 * 1. **Die Kennung bleibt.** ARCTOS referenziert BPMN-Elemente aus der
 *    Datenbank heraus über ihre ID (Risiken, Kontrollen, Kommentare,
 *    Simulationsdaten). Ein Typwechsel, der eine neue vergibt, ist ein stiller
 *    Verlust aller Verknüpfungen. `src/modeling` sichert das zu; hier wird
 *    geprüft, dass der Bedienweg es nicht doch umgeht.
 * 2. **`arctos:grcMetadata` wandert mit.** Dieselbe Begründung, andere Daten.
 *
 * Dazu die Menü-Eigenschaften: es bietet nur an, was die Regeln zulassen, es
 * bietet den Ist-Zustand nicht an, und es gibt den Fokus zurück.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { replaceOptionsFor } from "../../src/editor/catalog";
import type { ReplaceMenu } from "../../src/editor/ReplaceMenu";
import { snapshotOf } from "../../src/editor/copy/serialize";
import { COLLABORATION, SIMPLE_PROCESS } from "../modeling/helpers/fixtures";
import { act, openEditor, type EditorHarness } from "./helpers/editor";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

const GRC_TASK = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:arctos="https://arctos.grc/schema/bpmn/1.0"
                  id="Definitions_R" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_R" isExecutable="false">
    <bpmn:task id="Task_R" name="Zahlung freigeben">
      <bpmn:extensionElements>
        <arctos:grcMetadata lineOfDefense="first">
          <arctos:riskRefs>
            <arctos:riskRef id="risk-4711" title="Zahlungsbetrug" />
          </arctos:riskRefs>
        </arctos:grcMetadata>
      </bpmn:extensionElements>
    </bpmn:task>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_R">
    <bpmndi:BPMNPlane id="Plane_R" bpmnElement="Process_R">
      <bpmndi:BPMNShape id="Task_R_di" bpmnElement="Task_R">
        <dc:Bounds x="160" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

describe("Angebot", () => {
  it("bietet Aufgabenarten für eine Aufgabe an, aber nicht den Ist-Zustand", () => {
    const options = replaceOptionsFor({
      id: "T",
      type: "bpmn:UserTask",
      businessObject: { $type: "bpmn:UserTask" },
    } as never);
    const types = options.map((option) => option.type);
    expect(types).toContain("bpmn:ServiceTask");
    expect(types).toContain("bpmn:SubProcess");
    expect(types).not.toContain("bpmn:UserTask");
  });

  it("bietet an einem Startereignis die Auslöser an", () => {
    const options = replaceOptionsFor({
      id: "S",
      type: "bpmn:StartEvent",
      businessObject: { $type: "bpmn:StartEvent" },
    } as never);
    expect(
      options.some(
        (option) => option.eventDefinitionType === "bpmn:TimerEventDefinition",
      ),
    ).toBe(true);
  });

  it("bietet für Pool und Lane nichts an — das wäre ein Strukturumbau", async () => {
    harness = await openEditor(COLLABORATION);
    const menu = harness.service<ReplaceMenu>("replaceMenu");
    const pool = harness.session.elementRegistry
      .getAll()
      .find(
        (element) =>
          (element.businessObject as { $type?: string } | undefined)?.$type ===
          "bpmn:Participant",
      );
    expect(menu.optionsFor(pool as never)).toHaveLength(0);
    expect(menu.openFor(pool as never)).toBe(false);
    expect(harness.said()).toContain("keinen zulässigen Typwechsel");
    harness.destroy();
  });
});

describe("Wechsel ausführen", () => {
  it("behält die Kennung und die GRC-Angaben, auch nach Undo", async () => {
    harness = await openEditor(GRC_TASK);
    const menu = harness.service<ReplaceMenu>("replaceMenu");
    const element = harness.session.shape("Task_R");
    const option = menu
      .optionsFor(element)
      .find((candidate) => candidate.type === "bpmn:UserTask");
    expect(option).toBeDefined();

    const result = act(
      harness,
      "Typwechsel auf Benutzeraufgabe",
      () => menu.apply(element, option!),
      {
        undoSteps: 1,
        after: () => {
          const changed = harness.session.shape("Task_R");
          expect((changed.businessObject as { $type: string }).$type).toBe(
            "bpmn:UserTask",
          );
          // Die Kennung — der eigentliche Punkt.
          expect(changed.id).toBe("Task_R");
          const grc = JSON.stringify(snapshotOf(changed.businessObject));
          expect(grc).toContain("arctos:GrcMetadata");
          expect(grc).toContain("risk-4711");
          expect(grc).toContain("first");
          expect(harness.said()).toContain("Kennung Task_R bleibt erhalten");
        },
        afterUndo: () => {
          expect(
            (
              harness.session.shape("Task_R").businessObject as {
                $type: string;
              }
            ).$type,
          ).toBe("bpmn:Task");
        },
      },
    );
    expect(result.value).not.toBeNull();
    harness.destroy();
  });

  it("wechselt ein Ereignis samt Auslöser in einem Schritt", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const menu = harness.service<ReplaceMenu>("replaceMenu");
    const element = harness.session.shape("StartEvent_1");
    const option = menu
      .optionsFor(element)
      .find(
        (candidate) =>
          candidate.eventDefinitionType === "bpmn:TimerEventDefinition",
      );
    expect(option).toBeDefined();

    act(
      harness,
      "Startereignis wird Zeitereignis",
      () => menu.apply(element, option!),
      {
        // Der Punkt: **ein** Strg-Z. Ereignis und Auslöser entstehen zusammen,
        // sonst bräuchte ein Bedienschritt zwei Rückschritte.
        undoSteps: 1,
        after: () => {
          const changed = harness.session.shape("StartEvent_1");
          const definitions = (
            changed.businessObject as {
              eventDefinitions?: Array<{ $type: string }>;
            }
          ).eventDefinitions;
          expect(definitions?.[0]?.$type).toBe("bpmn:TimerEventDefinition");
        },
      },
    );
    harness.destroy();
  });
});

describe("Menü als Bedienelement", () => {
  it("ist ein benanntes Menü mit Menüeinträgen und Tastaturweg", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const menu = harness.service<ReplaceMenu>("replaceMenu");
    expect(menu.openFor(harness.session.shape("Task_1"))).toBe(true);

    const node = menu.element() as HTMLElement;
    expect(node.getAttribute("role")).toBe("menu");
    expect(node.getAttribute("aria-label")).toContain("Typ wechseln");

    const items = Array.from(
      node.querySelectorAll<HTMLElement>("button[role='menuitem']"),
    );
    expect(items.length).toBeGreaterThan(3);
    expect(document.activeElement).toBe(items[0]);

    harness.key({ key: "ArrowDown" }, items[0]);
    expect(document.activeElement).toBe(items[1]);

    harness.key({ key: "Escape" }, document.activeElement ?? undefined);
    expect(menu.isOpen()).toBe(false);
    expect(harness.said()).toBe("Typwechsel abgebrochen.");
    harness.destroy();
  });

  it("öffnet mit der Taste r und wechselt mit der Eingabetaste", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const menu = harness.service<ReplaceMenu>("replaceMenu");
    harness.session
      .get<{ select(element: unknown): void }>("selection")
      .select(harness.session.shape("Task_1"));

    harness.key({ key: "r" });
    expect(menu.isOpen()).toBe(true);

    const first = menu
      .element()
      ?.querySelector<HTMLElement>("button[role='menuitem']");
    harness.key({ key: "Enter" }, first ?? undefined);
    expect(menu.isOpen()).toBe(false);
    expect(harness.said()).toContain("Typ gewechselt");
    harness.session.assertInvariants("nach dem Typwechsel per Tastatur");
    expect(harness.session.has("Task_1")).toBe(true);
    harness.destroy();
  });
});
