/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-019] Automatischer Typwechsel beim Anheften.
 *
 * **Reproduktion.** Vor dieser Welle lehnte `ElementCreation.attachBoundary`
 * jeden Typ ab, der nicht bereits `bpmn:BoundaryEvent` war:
 *
 * ```
 * creation.attachBoundary(task, { type: "bpmn:IntermediateCatchEvent", … })
 * → { shape: null, rejected: "Nur ein Randereignis lässt sich an eine
 *      Aktivität anheften." }
 * ```
 *
 * **Die Begründung im Code war überholt.** `BpmnRules.canAttach` lässt
 * `bpmn:IntermediateCatchEvent` und `bpmn:IntermediateThrowEvent` seit
 * Stufe A1 ausdrücklich zu — der Kommentar dort sagt „(und zwischenzeitliche
 * Ereignisse, die dabei zu welchen werden)". Die Regel erlaubte es also, die
 * Operation (`modeling.replaceShape`) konnte es, und allein die Bedienschicht
 * sagte nein. Der Registereintrag („Verhalten fehlt in der
 * Modellierungsschicht") trifft damit nicht mehr zu; die Abweichung steht im
 * Protokoll.
 *
 * Geprüft werden **beide** Richtungen: neu anlegen und anheften, und ein
 * vorhandenes Ereignis an eine Aktivität hängen — die zweite ausschließlich
 * über Tastenereignisse.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  asBoundaryItem,
  eventDefinitionOf,
  type ElementCreation,
} from "../../src/editor/ElementCreation";
import type { ContainerMode } from "../../src/editor/ContainerMode";
import type { PaletteItem } from "../../src/editor/types";
import { canAttach } from "../../src/modeling/BpmnRules";
import type { BpmnShape } from "../../src/modeling/types";
import { BOUNDARY_PROCESS } from "../modeling/helpers/fixtures";
import { openEditor, act, type EditorHarness } from "./helpers/editor";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

const TIMER_INTERMEDIATE: PaletteItem = {
  id: "create.timer-event",
  type: "bpmn:IntermediateCatchEvent",
  title: "Zeitereignis",
  group: "ereignisse",
  eventDefinitionType: "bpmn:TimerEventDefinition",
};

function focus(h: EditorHarness, id: string): void {
  const node = h.session
    .get<{ getGraphics(id: string): SVGElement | undefined }>("elementRegistry")
    .getGraphics(id) as unknown as HTMLElement | undefined;
  node?.setAttribute("data-element-id", id);
  node?.setAttribute("tabindex", "-1");
  node?.focus();
}

describe("asBoundaryItem — was am Rand einer Aktivität gemeint ist", () => {
  it("macht aus einem Zwischenereignis ein Randereignis mit derselben Definition", () => {
    const converted = asBoundaryItem(TIMER_INTERMEDIATE);
    expect(converted?.type).toBe("bpmn:BoundaryEvent");
    expect(converted?.eventDefinitionType).toBe("bpmn:TimerEventDefinition");
  });

  it("lässt ein Randereignis unverändert", () => {
    const item: PaletteItem = {
      id: "x",
      type: "bpmn:BoundaryEvent",
      title: "Randereignis",
      group: "ereignisse",
    };
    expect(asBoundaryItem(item)).toBe(item);
  });

  it("lehnt ab, was am Rand keine Bedeutung hat", () => {
    for (const type of [
      "bpmn:Task",
      "bpmn:ExclusiveGateway",
      "bpmn:StartEvent",
      "bpmn:EndEvent",
      "bpmn:Participant",
    ]) {
      expect(
        asBoundaryItem({ id: "x", type, title: type, group: "aufgaben" }),
        `${type} darf nicht zum Randereignis werden`,
      ).toBeUndefined();
    }
  });
});

describe("Die Regel erlaubte es die ganze Zeit", () => {
  it("canAttach lässt Zwischenereignisse an Aktivitäten zu", async () => {
    // Der Beleg für die Abweichung zum Registereintrag: nicht die
    // Modellierungsschicht fehlte, die Bedienung verweigerte.
    harness = await openEditor(BOUNDARY_PROCESS);
    const task = harness.session.shape("Task_A");
    const event = harness.session
      .get<{ createShape(attrs: Record<string, unknown>): BpmnShape }>(
        "elementFactory",
      )
      .createShape({
        type: "bpmn:IntermediateCatchEvent",
        eventDefinitionType: "bpmn:TimerEventDefinition",
      });
    expect(canAttach([event], task)).toBe("attach");
    harness.destroy();
  });
});

describe("OP-019 — anlegen und anheften in einem Schritt", () => {
  it("heftet ein Zwischenereignis an und macht ein Randereignis daraus", async () => {
    harness = await openEditor(BOUNDARY_PROCESS);
    const creation = harness.service<ElementCreation>("elementCreation");
    const task = harness.session.shape("Task_A");

    const result = act(
      harness,
      "Zeitereignis anheften",
      () => creation.attachBoundary(task, TIMER_INTERMEDIATE),
      {
        after: () => {
          /* Invarianten prüft `act` selbst — genau darum geht es hier: das
             Ergebnis muss ein gültiges Modell sein, nicht nur ein Shape. */
        },
      },
    ).value;

    expect(result.rejected).toBeUndefined();
    const created = result.shape;
    expect(created).not.toBeNull();
    expect(created?.type).toBe("bpmn:BoundaryEvent");
    expect(created?.host).toBe(task);
    // Die Definition ist mitgekommen — ohne sie wäre es ein anderes Element
    // unter demselben Namen.
    expect(eventDefinitionOf(created as BpmnShape)).toBe(
      "bpmn:TimerEventDefinition",
    );
    // Und der Wechsel wird angesagt, statt still zu geschehen.
    expect(harness.said()).toContain("umgewandelt");
    harness.destroy();
  });

  it("schreibt das Randereignis mit attachedToRef in die Datei", async () => {
    harness = await openEditor(BOUNDARY_PROCESS);
    const creation = harness.service<ElementCreation>("elementCreation");
    const task = harness.session.shape("Task_A");
    const created = creation.attachBoundary(task, TIMER_INTERMEDIATE).shape;

    const xml = await harness.session.exportXml();
    expect(xml).toContain("bpmn:boundaryEvent");
    expect(xml).toContain(`attachedToRef="Task_A"`);
    expect(xml).toContain(created?.id ?? "###");
    // Kein Zwischenereignis als Rest des Wechsels: die Datei darf nicht
    // beides enthalten.
    expect(xml).not.toContain("intermediateCatchEvent");
    harness.destroy();
  });

  it("lehnt weiterhin ab, was am Rand nichts zu suchen hat", async () => {
    harness = await openEditor(BOUNDARY_PROCESS);
    const creation = harness.service<ElementCreation>("elementCreation");
    const task = harness.session.shape("Task_A");
    const result = creation.attachBoundary(task, {
      id: "create.task",
      type: "bpmn:Task",
      title: "Aufgabe",
      group: "aufgaben",
    });
    expect(result.shape).toBeNull();
    expect(result.rejected).toContain("nicht anheften");
    harness.destroy();
  });
});

describe("OP-019 — ein vorhandenes Ereignis anheften, ohne Maus", () => {
  it("bietet die Aktivität im Containerwechsel an und wandelt beim Bestätigen um", async () => {
    harness = await openEditor(BOUNDARY_PROCESS);
    const creation = harness.service<ElementCreation>("elementCreation");
    const task = harness.session.shape("Task_A");

    // Ein freistehendes Zwischenereignis anlegen …
    const free = creation.createAt(TIMER_INTERMEDIATE).shape as BpmnShape;
    expect(free.type).toBe("bpmn:IntermediateCatchEvent");
    const id = free.id;

    // … und es allein über die Tastatur an die Aufgabe heften.
    harness.session.get<{ select(e: unknown): void }>("selection").select(free);
    focus(harness, id);
    harness.key({ key: "m" });

    const mode = harness.service<ContainerMode>("containerMode");
    expect(mode.isActive()).toBe(true);
    // Die Aufgabe steht als Ziel in der Liste — vor dieser Welle nicht, weil
    // eine Aufgabe kein Container ist.
    const index = mode.candidates().findIndex((c) => c.id === "Task_A");
    expect(index, "Task_A wird nicht als Anheftziel angeboten").toBeGreaterThan(
      -1,
    );
    for (let i = 0; i < index; i += 1) harness.key({ key: "ArrowRight" });
    expect(mode.current()?.id).toBe("Task_A");
    expect(harness.said()).toContain("Anheften an");

    harness.key({ key: "Enter" });

    const registry = harness.session.get<{
      get(id: string): BpmnShape | undefined;
    }>("elementRegistry");
    const now = registry.get(id);
    // Die Kennung bleibt — daran hängen Risiken, Kontrollen und Kommentare.
    expect(now).toBeDefined();
    expect(now?.type).toBe("bpmn:BoundaryEvent");
    expect(now?.host).toBe(task);
    expect(harness.said()).toContain("umgewandelt");
    harness.session.assertInvariants("nach dem Anheften per Tastatur");
    harness.destroy();
  });

  it("bietet das Anheften im Kontextmenü an — der Mausweg zur selben Handlung", async () => {
    harness = await openEditor(BOUNDARY_PROCESS);
    const creation = harness.service<ElementCreation>("elementCreation");
    const free = creation.createAt(TIMER_INTERMEDIATE).shape as BpmnShape;

    const provider = harness.service<{
      getContextPadEntries(element: unknown): Record<string, unknown>;
    }>("contextPadProvider");
    expect(Object.keys(provider.getContextPadEntries(free))).toContain(
      "attach.to-activity",
    );
    harness.destroy();
  });
});
