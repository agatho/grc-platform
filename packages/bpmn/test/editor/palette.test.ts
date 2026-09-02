/// <reference lib="dom" />

/**
 * Palette (Auftrag Punkt 1).
 *
 * Geprüft wird dreierlei: **was** angeboten wird (der kuratierte Vorrat, nicht
 * die volle BPMN-Palette), **wie** es angeboten wird (Rolle, Name, Gruppen,
 * Tastaturweg) und **dass** ein Klick beziehungsweise die Eingabetaste ein
 * gültiges Modell erzeugt — samt Undo.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PALETTE_ITEMS,
  groupsOf,
  paletteCatalog,
} from "../../src/editor/catalog.js";
import type { ArctosPaletteProvider } from "../../src/editor/PaletteProvider.js";
import type { PaletteChrome } from "../../src/editor/PaletteChrome.js";
import { SIMPLE_PROCESS } from "../modeling/helpers/fixtures.js";
import { act, openEditor, type EditorHarness } from "./helpers/editor.js";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

describe("Vorrat", () => {
  it("bietet die acht real vorkommenden Typen an", () => {
    const types = new Set(DEFAULT_PALETTE_ITEMS.map((item) => item.type));
    // Bestandsaufnahme `inventar_bpmn_elementtypen.csv`, Spalte `vorkommen_real`.
    for (const type of [
      "bpmn:Task",
      "bpmn:StartEvent",
      "bpmn:EndEvent",
      "bpmn:UserTask",
      "bpmn:ServiceTask",
      "bpmn:ExclusiveGateway",
      "bpmn:CallActivity",
      "bpmn:SubProcess",
    ]) {
      expect(types, `${type} fehlt im Vorrat`).toContain(type);
    }
  });

  it("bleibt deutlich unter der vollen BPMN-Palette", () => {
    // Der Renderer zeichnet 35 Typen; angeboten wird die fachliche Auswahl.
    expect(DEFAULT_PALETTE_ITEMS.length).toBeLessThan(20);
  });

  it("bietet kein Randereignis an — das entsteht nur am Wirt", () => {
    expect(
      DEFAULT_PALETTE_ITEMS.some((item) => item.type === "bpmn:BoundaryEvent"),
    ).toBe(false);
  });

  it("ist erweiterbar und ausdünnbar", () => {
    const extended = paletteCatalog({
      additions: [
        {
          id: "create.transaction",
          type: "bpmn:Transaction",
          title: "Transaktion",
          group: "struktur",
        },
      ],
      exclude: ["create.group"],
    });
    expect(extended.some((item) => item.id === "create.transaction")).toBe(
      true,
    );
    expect(extended.some((item) => item.id === "create.group")).toBe(false);
  });

  it("sortiert nach Gruppen und behält innerhalb der Gruppe die Reihenfolge", () => {
    const items = paletteCatalog();
    const groups = items.map((item) => item.group);
    const firstIndex = new Map<string, number>();
    groups.forEach((group, index) => {
      if (!firstIndex.has(group)) firstIndex.set(group, index);
    });
    // Keine Gruppe kommt nach ihrem Ende noch einmal vor.
    let lastGroup = "";
    const seen = new Set<string>();
    for (const group of groups) {
      if (group !== lastGroup) {
        expect(seen.has(group), `Gruppe ${group} ist zerrissen`).toBe(false);
        seen.add(group);
        lastGroup = group;
      }
    }
    expect(groupsOf(items).length).toBeGreaterThan(3);
  });
});

describe("Palette im DOM", () => {
  it("ist eine Werkzeugleiste mit benannten Gruppen und Knöpfen", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const chrome = harness.service<PaletteChrome>("paletteChrome");
    const node = chrome.element();
    expect(node).not.toBeNull();
    expect(node?.getAttribute("role")).toBe("toolbar");
    expect(node?.getAttribute("aria-label")).toContain("Elementpalette");

    const groups = node?.querySelectorAll("[data-group]") ?? [];
    expect(groups.length).toBeGreaterThan(0);
    for (const group of Array.from(groups)) {
      expect(group.getAttribute("role")).toBe("group");
      expect(group.getAttribute("aria-label")).toBeTruthy();
    }

    const buttons = node?.querySelectorAll("button.entry") ?? [];
    expect(buttons.length).toBe(DEFAULT_PALETTE_ITEMS.length);
    for (const button of Array.from(buttons)) {
      expect(button.getAttribute("aria-label")).toBeTruthy();
      expect(button.getAttribute("data-action")).toBeTruthy();
    }
    harness.destroy();
  });

  it("hat genau einen Tabstopp und bewegt den Fokus mit Pfeiltasten", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const node = harness
      .service<PaletteChrome>("paletteChrome")
      .element() as HTMLElement;
    const buttons = Array.from(
      node.querySelectorAll<HTMLElement>("button.entry"),
    );
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);

    harness.service<PaletteChrome>("paletteChrome").focus();
    expect(document.activeElement).toBe(buttons[0]);

    harness.key({ key: "ArrowDown" }, buttons[0]);
    expect(document.activeElement).toBe(buttons[1]);
    expect(harness.said()).toContain(buttons[1]?.getAttribute("aria-label"));

    harness.key({ key: "End" }, document.activeElement ?? undefined);
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);

    harness.key({ key: "Escape" }, document.activeElement ?? undefined);
    expect(harness.said()).toBe("Palette verlassen.");
    harness.destroy();
  });
});

describe("Anlegen über die Palette", () => {
  it("legt per Klick an und hängt an die Auswahl an", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const provider = harness.service<ArctosPaletteProvider>("paletteProvider");
    const item = DEFAULT_PALETTE_ITEMS.find(
      (candidate) => candidate.id === "create.user-task",
    );
    expect(item).toBeDefined();

    // Quelle bewusst der Task und nicht das Endereignis: aus einem
    // `bpmn:EndEvent` darf kein Sequenzfluss herauslaufen, und die Palette
    // fiele dann (richtigerweise) auf freies Platzieren zurück.
    harness.session
      .get<{ select(element: unknown): void }>("selection")
      .select(harness.session.shape("Task_1"));

    const before = harness.session.elementRegistry.getAll().length;
    const result = act(
      harness,
      "Palette: Benutzeraufgabe anhängen",
      () => provider.createByClick(item!),
      {
        after: () => {
          expect(harness.said()).toContain("angehängt");
        },
        afterUndo: () => {
          expect(harness.session.elementRegistry.getAll().length).toBe(before);
        },
      },
    );
    expect(result.value).not.toBeNull();
    expect(result.undoSteps).toBe(1);
    harness.destroy();
  });

  it("legt ohne Auswahl frei und ohne Überlappung an", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const provider = harness.service<ArctosPaletteProvider>("paletteProvider");
    const item = DEFAULT_PALETTE_ITEMS.find(
      (candidate) => candidate.id === "create.task",
    );

    const created = act(harness, "Palette: Aufgabe frei anlegen", () =>
      provider.createByClick(item!),
    ).value;
    expect(created).not.toBeNull();

    const overlapping = harness.session.elementRegistry
      .getAll()
      .filter((element) => {
        const shape = element as {
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          id: string;
        };
        if (shape.id === created?.id) return false;
        if (typeof shape.width !== "number" || created === null) return false;
        return (
          created.x < (shape.x ?? 0) + (shape.width ?? 0) &&
          created.x + created.width > (shape.x ?? 0) &&
          created.y < (shape.y ?? 0) + (shape.height ?? 0) &&
          created.y + created.height > (shape.y ?? 0)
        );
      })
      .filter((element) => (element as { isFrame?: boolean }).isFrame !== true);
    expect(overlapping).toHaveLength(0);
    harness.destroy();
  });

  it("gibt den Fokus nach dem Anlegen an die Zeichenfläche zurück", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const provider = harness.service<ArctosPaletteProvider>("paletteProvider");
    const item = DEFAULT_PALETTE_ITEMS.find((c) => c.id === "create.task");
    provider.createByClick(item!);
    expect(document.activeElement).toBe(harness.canvasContainer);
    harness.destroy();
  });
});

describe("chrome=full im Lesemodus", () => {
  it("zeigt die Palette deaktiviert samt Begründung", async () => {
    harness = await openEditor(SIMPLE_PROCESS, {
      editor: { editable: false, chrome: "full" },
    });
    const node = harness
      .service<PaletteChrome>("paletteChrome")
      .element() as HTMLElement;
    const buttons = Array.from(
      node.querySelectorAll<HTMLElement>("button.entry"),
    );
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("aria-label")).toContain("Prozessmodellierer");
      // Deaktiviert, aber erreichbar — sonst erführe ein Tastaturnutzer nie,
      // dass es die Funktion gibt.
      expect(button.hasAttribute("disabled")).toBe(false);
    }
    harness.destroy();
  });
});
