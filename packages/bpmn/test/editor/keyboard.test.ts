/// <reference lib="dom" />

/**
 * Tastaturbedienung (Auftrag Punkt 7).
 *
 * Der Anspruch, an dem sich die Arbeit misst: **ohne Maus muss ein
 * vollständiges Diagramm baubar sein.** Der letzte Test dieser Datei baut eines
 * — sechs Elemente, fünf Kanten, beschriftet —, ausschließlich über
 * `KeyboardEvent`s, exportiert es und prüft die Invarianten über dem
 * *reimportierten* Ergebnis. Nicht über dem Editor-Zustand: Was zählt, ist die
 * Datei.
 *
 * Audit-Finding S14-10 (kein einziger Tastatur-Handler im Bestandsmodul) ist
 * der Maßstab, gegen den hier geprüft wird.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { AlignDistribute } from "../../src/editor/AlignDistribute";
import type { ConnectMode } from "../../src/editor/ConnectMode";
import type { EditorKeyboard } from "../../src/editor/Keyboard";
import type { LabelEditing } from "../../src/editor/LabelEditing";
import type { PaletteChrome } from "../../src/editor/PaletteChrome";
import { arrowDelta } from "../../src/editor/Keyboard";
import { checkInvariants } from "../../src/modeling/invariants";
import { importXml } from "../../src/model/index";
import { SIMPLE_PROCESS } from "../modeling/helpers/fixtures";
import { openEditor, type EditorHarness } from "./helpers/editor";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

/** Ein leeres Diagramm — Ausgangspunkt des Aufbaus ohne Maus. */
const EMPTY_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_E" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_E" isExecutable="false" />
  <bpmndi:BPMNDiagram id="Diagram_E">
    <bpmndi:BPMNPlane id="Plane_E" bpmnElement="Process_E" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

interface SelectionLike {
  get(): Array<{ id: string }>;
  select(element: unknown, add?: boolean): void;
}

function selection(harness: EditorHarness): SelectionLike {
  return harness.service<SelectionLike>("selection");
}

/** Das gerade fokussierte Element im DOM. */
function active(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
}

/**
 * Legt ein Element **ausschließlich über die Tastatur** an.
 *
 * `F6` in die Palette, mit `↓` bis zum gewünschten Eintrag, `Eingabe`. Genau
 * die Folge, die ein Nutzer ohne Zeigegerät ausführt — kein Aufruf einer
 * Editor-Methode, keine Maus.
 */
function createViaKeyboard(harness: EditorHarness, action: string): void {
  harness.key({ key: "F6" });
  const focused = active();
  expect(
    focused,
    "F6 hat den Fokus nicht in die Palette geführt",
  ).not.toBeNull();

  const buttons = Array.from(
    (
      harness.service<PaletteChrome>("paletteChrome").element() as HTMLElement
    ).querySelectorAll<HTMLElement>("button.entry"),
  );
  const target = buttons.findIndex(
    (button) => button.getAttribute("data-action") === action,
  );
  expect(target, `Paletteneintrag ${action} fehlt`).toBeGreaterThanOrEqual(0);

  for (let step = 0; step < target; step += 1) {
    harness.key({ key: "ArrowDown" }, active() ?? undefined);
  }
  expect(active()?.getAttribute("data-action")).toBe(action);
  harness.key({ key: "Enter" }, active() ?? undefined);
}

/** Beschriftet das ausgewählte Element über `F2`. */
function labelViaKeyboard(harness: EditorHarness, text: string): void {
  harness.key({ key: "F2" });
  const editing = harness.service<LabelEditing>("labelEditing");
  const input = editing.input();
  expect(input, "F2 hat kein Eingabefeld geöffnet").not.toBeNull();
  // Der Tastenanschlag selbst ist in jsdom nicht nachbildbar (es gibt keine
  // Texteingabe-Engine); alles Weitere — Übernahme, Fokusrückgabe, Ansage —
  // läuft wieder über echte Ereignisse.
  if (input) input.value = text;
  input?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
}

describe("Belegung", () => {
  it("rechnet Pfeiltasten in Rasterschritte um", () => {
    expect(arrowDelta("ArrowRight", 20)).toEqual({ x: 20, y: 0 });
    expect(arrowDelta("ArrowUp", 20)).toEqual({ x: 0, y: -20 });
    expect(arrowDelta("Enter", 20)).toBeNull();
  });

  it("verschiebt die Auswahl mit Umschalt und Pfeil im Raster", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const task = harness.session.shape("Task_1");
    selection(harness).select(task);
    const before = { x: task.x, y: task.y };

    harness.key({ key: "ArrowRight", shiftKey: true });
    expect(task.x).toBe(before.x + 20);
    harness.session.assertInvariants("nach dem Verschieben");
    expect(harness.said()).toContain("verschoben");

    harness.key({ key: "ArrowLeft", shiftKey: true, altKey: true });
    expect(task.x).toBe(before.x + 19);
    harness.session.assertInvariants("nach dem feinen Verschieben");

    harness.key({ key: "z", ctrlKey: true });
    harness.key({ key: "z", ctrlKey: true });
    expect(task.x).toBe(before.x);
    harness.session.assertInvariants("nach zweimal Rückgängig");
    harness.destroy();
  });

  it("lässt blanke Pfeiltasten dem Betrachter", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const task = harness.session.shape("Task_1");
    selection(harness).select(task);
    const before = task.x;
    harness.key({ key: "ArrowRight" });
    expect(task.x).toBe(before);
    harness.destroy();
  });

  it("löscht die Auswahl und stellt sie mit Strg+Z wieder her", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    selection(harness).select(harness.session.shape("Task_1"));

    harness.key({ key: "Delete" });
    expect(harness.session.has("Task_1")).toBe(false);
    harness.session.assertInvariants("nach dem Löschen");
    expect(harness.said()).toContain("gelöscht");

    harness.key({ key: "z", ctrlKey: true });
    expect(harness.session.has("Task_1")).toBe(true);
    harness.session.assertInvariants("nach dem Rückgängigmachen");

    harness.key({ key: "y", ctrlKey: true });
    expect(harness.session.has("Task_1")).toBe(false);
    harness.session.assertInvariants("nach dem Wiederholen");
    harness.destroy();
  });

  it("kopiert und fügt mit Strg+C und Strg+V ein", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    selection(harness).select(harness.session.shape("Task_1"));
    const before = harness.session.elementRegistry.getAll().length;

    harness.key({ key: "c", ctrlKey: true });
    expect(harness.said()).toContain("kopiert");
    harness.key({ key: "v", ctrlKey: true });
    expect(harness.session.elementRegistry.getAll().length).toBeGreaterThan(
      before,
    );
    harness.session.assertInvariants("nach dem Einfügen");

    harness.key({ key: "z", ctrlKey: true });
    expect(harness.session.elementRegistry.getAll().length).toBe(before);
    harness.session.assertInvariants("nach dem Rückgängigmachen");
    harness.destroy();
  });

  it("wählt mit Strg+A alles aus", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    harness.key({ key: "a", ctrlKey: true });
    expect(selection(harness).get().length).toBeGreaterThan(5);
    expect(harness.said()).toContain("ausgewählt");
    harness.destroy();
  });

  it("schaltet das Raster mit g um", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const align = harness.service<AlignDistribute>("alignDistribute");
    const before = align.gridActive();
    harness.key({ key: "g" });
    expect(align.gridActive()).toBe(!before);
    expect(harness.said()).toContain("Raster");
    harness.destroy();
  });

  it("öffnet mit Umschalt+F10 das Kontextmenü und fokussiert den ersten Eintrag", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    selection(harness).select(harness.session.shape("Task_1"));
    harness.key({ key: "F10", shiftKey: true });
    const pad = harness.canvasContainer.querySelector(".djs-context-pad");
    expect(pad).not.toBeNull();
    expect(active()?.classList.contains("entry")).toBe(true);
    harness.destroy();
  });
});

describe("Verbinden ohne Maus", () => {
  it("blättert durch die zulässigen Ziele und verbindet mit Eingabe", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const connect = harness.service<ConnectMode>("connectMode");
    selection(harness).select(harness.session.shape("Task_1"));

    harness.key({ key: "c" });
    expect(connect.isActive()).toBe(true);
    const first = connect.current();
    harness.key({ key: "ArrowRight" });
    expect(connect.current()).not.toBe(first);
    expect(harness.said()).toContain("Ziel");

    const before = harness.session.elementRegistry.getAll().length;
    harness.key({ key: "Enter" });
    expect(connect.isActive()).toBe(false);
    expect(harness.session.elementRegistry.getAll().length).toBe(before + 1);
    harness.session.assertInvariants("nach dem Verbinden");

    harness.key({ key: "z", ctrlKey: true });
    expect(harness.session.elementRegistry.getAll().length).toBe(before);
    harness.session.assertInvariants("nach dem Rückgängigmachen");
    harness.destroy();
  });

  it("bricht mit Escape ohne Änderung ab", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const connect = harness.service<ConnectMode>("connectMode");
    selection(harness).select(harness.session.shape("Task_1"));
    const before = harness.session.elementRegistry.getAll().length;

    harness.key({ key: "c" });
    harness.key({ key: "Escape" });
    expect(connect.isActive()).toBe(false);
    expect(harness.session.elementRegistry.getAll().length).toBe(before);
    expect(harness.said()).toBe("Abgebrochen.");
    harness.destroy();
  });

  it("sagt an, wenn es kein zulässiges Ziel gibt", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const connect = harness.service<ConnectMode>("connectMode");
    // Aus einem Endereignis führt kein Sequenzfluss heraus; eine Assoziation
    // ginge nur zu einer Textanmerkung, und die gibt es hier nicht.
    selection(harness).select(harness.session.shape("EndEvent_1"));
    harness.key({ key: "c" });
    expect(connect.isActive()).toBe(false);
    expect(harness.said()).toContain("nichts verbinden");
    harness.destroy();
  });
});

describe("Bereichswechsel", () => {
  it("führt mit F6 in die Palette und zurück", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    harness.key({ key: "F6" });
    expect(active()?.closest(".djs-palette")).not.toBeNull();

    harness.key({ key: "F6" }, active() ?? undefined);
    expect(harness.said()).toBe("Zeichenfläche.");
    harness.destroy();
  });
});

describe("Ein Diagramm ohne Maus", () => {
  it("baut sechs Elemente und fünf Kanten, exportiert und hält die Invarianten", async () => {
    harness = await openEditor(EMPTY_PROCESS);

    const plan: ReadonlyArray<[string, string]> = [
      ["create.start-event", "Antrag geht ein"],
      ["create.user-task", "Antrag prüfen"],
      ["create.exclusive-gateway", "Vollständig?"],
      ["create.service-task", "Bonität abrufen"],
      ["create.business-rule-task", "Entscheidung ableiten"],
      ["create.end-event", "Antrag entschieden"],
    ];

    for (const [action, label] of plan) {
      createViaKeyboard(harness, action);
      labelViaKeyboard(harness, label);
      harness.session.assertInvariants(`nach ${action}`);
    }

    const shapes = harness.session.elementRegistry
      .getAll()
      .filter(
        (element) =>
          typeof (element as { width?: number }).width === "number" &&
          (element as { labelTarget?: unknown }).labelTarget === undefined &&
          element.parent !== undefined,
      );
    const connections = harness.session.elementRegistry
      .getAll()
      .filter((element) =>
        Array.isArray((element as { waypoints?: unknown }).waypoints),
      );

    expect(shapes.length).toBe(6);
    expect(connections.length).toBe(5);

    // Alles trägt seinen Namen — die Beschriftung lief über dasselbe Feld.
    const names = shapes
      .map((element) => (element.businessObject as { name?: unknown }).name)
      .filter((name): name is string => typeof name === "string");
    expect(names).toHaveLength(6);
    expect(names).toContain("Antrag geht ein");
    expect(names).toContain("Antrag entschieden");

    // Der eigentliche Nachweis: die **Datei**.
    const xml = await harness.session.exportXml();
    const { definitions } = await importXml(xml);
    const violations = checkInvariants({ definitions });
    expect(
      violations,
      violations.map((violation) => violation.message).join("\n"),
    ).toHaveLength(0);

    // Und sie enthält den Ablauf, nicht nur sechs lose Kästen.
    expect(xml).toContain("bpmn:sequenceFlow");
    expect(xml.match(/<bpmn:sequenceFlow/g)).toHaveLength(5);
    expect(xml).toContain("Antrag prüfen");

    harness.destroy();
  });

  it("nimmt den ganzen Aufbau Schritt für Schritt zurück", async () => {
    harness = await openEditor(EMPTY_PROCESS);
    for (const action of [
      "create.start-event",
      "create.user-task",
      "create.end-event",
    ]) {
      createViaKeyboard(harness, action);
    }
    const built = harness.session.elementRegistry.getAll().length;
    expect(built).toBeGreaterThan(4);

    let steps = 0;
    while (harness.session.commandStack.canUndo()) {
      harness.key({ key: "z", ctrlKey: true });
      harness.session.assertInvariants(`nach Strg-Z Nummer ${String(++steps)}`);
      expect(steps).toBeLessThan(20);
    }
    // Drei Bedienschritte, drei Strg-Z.
    expect(steps).toBe(3);
    expect(
      harness.session.elementRegistry
        .getAll()
        .filter((element) => element.parent !== undefined),
    ).toHaveLength(0);
    harness.destroy();
  });
});

describe("Keine Bearbeitung im Lesemodus", () => {
  it("ignoriert Bearbeitungstasten", async () => {
    harness = await openEditor(SIMPLE_PROCESS, {
      editor: { editable: false },
    });
    const keyboard = harness.service<EditorKeyboard>("editorKeyboard");
    const event = new KeyboardEvent("keydown", { key: "Delete" });
    expect(keyboard.handle(event)).toBe(false);
    expect(harness.session.has("Task_1")).toBe(true);
    harness.destroy();
  });
});
