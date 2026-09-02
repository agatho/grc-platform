/// <reference lib="dom" />

/**
 * Ausrichten, Verteilen, Raster (Auftrag Punkt 8) und der Modus-Schalter
 * (Plan §2.4).
 *
 * Zum Modus-Schalter: Geprüft wird, dass er **eine** Wahrheit hat. `read`
 * registriert die Bearbeitungsmodule nicht; `editorConfig.editable` liest das
 * ab, statt es ein zweites Mal zu behaupten. Ein Test, der beides gegeneinander
 * hält, ist der einzige Weg, das offenzuhalten — sonst driftet die Option von
 * der Modulliste weg und die Palette bietet Knöpfe an, die nichts tun.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { AlignDistribute } from "../../src/editor/AlignDistribute.js";
import { isAlignable } from "../../src/editor/AlignDistribute.js";
import {
  editorModulesFor,
  editorServicesFor,
} from "../../src/editor/modules.js";
import type { EditorConfiguration } from "../../src/editor/config.js";
import type { PaletteChrome } from "../../src/editor/PaletteChrome.js";
import { modulesFor } from "../../src/viewer/modules.js";
import { COLLABORATION, SIMPLE_PROCESS } from "../modeling/helpers/fixtures.js";
import { act, openEditor, type EditorHarness } from "./helpers/editor.js";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

interface SelectionLike {
  select(elements: unknown, add?: boolean): void;
}

describe("Ausrichten und Verteilen", () => {
  it("richtet mindestens zwei Formen aus und nimmt es zurück", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const align = harness.service<AlignDistribute>("alignDistribute");
    const task = harness.session.shape("Task_1");
    const gateway = harness.session.shape("Gateway_1");
    const before = { task: task.y, gateway: gateway.y };

    act(harness, "oben ausrichten", () => align.align("top", [task, gateway]), {
      undoSteps: 1,
      after: () => {
        expect(task.y).toBe(gateway.y);
        expect(harness.said()).toContain("ausgerichtet");
      },
      afterUndo: () => {
        expect(task.y).toBe(before.task);
        expect(gateway.y).toBe(before.gateway);
      },
    });
    harness.destroy();
  });

  it("verteilt drei Formen gleichmäßig", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const align = harness.service<AlignDistribute>("alignDistribute");
    const elements = [
      harness.session.shape("StartEvent_1"),
      harness.session.shape("Task_1"),
      harness.session.shape("EndEvent_1"),
    ];
    act(harness, "waagerecht verteilen", () =>
      align.distribute("horizontal", elements),
    );
    expect(harness.said()).toContain("verteilt");
    harness.destroy();
  });

  it("weigert sich bei zu kleiner Auswahl und sagt warum", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const align = harness.service<AlignDistribute>("alignDistribute");
    expect(align.align("left", [harness.session.shape("Task_1")])).toBe(false);
    expect(harness.said()).toContain("mindestens zwei");
    expect(
      align.distribute("horizontal", [
        harness.session.shape("Task_1"),
        harness.session.shape("Gateway_1"),
      ]),
    ).toBe(false);
    expect(harness.said()).toContain("mindestens drei");
    harness.destroy();
  });

  it("richtet Pools, Lanes, Kanten und Beschriftungen nicht aus", async () => {
    harness = await openEditor(COLLABORATION);
    for (const element of harness.session.elementRegistry.getAll()) {
      const type = (element.businessObject as { $type?: string } | undefined)
        ?.$type;
      if (type === "bpmn:Participant" || type === "bpmn:Lane") {
        expect(
          isAlignable(element as never),
          `${element.id} sollte tabu sein`,
        ).toBe(false);
      }
      if (Array.isArray((element as { waypoints?: unknown }).waypoints)) {
        expect(isAlignable(element as never)).toBe(false);
      }
    }
    harness.destroy();
  });

  it("schaltet das Einrasten am Raster um", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const align = harness.service<AlignDistribute>("alignDistribute");
    const first = align.toggleGrid();
    expect(align.gridActive()).toBe(first);
    const second = align.toggleGrid();
    expect(second).toBe(!first);
    harness.destroy();
  });
});

describe("Modus und chrome", () => {
  it("baut auf der Modulliste des Betrachters auf", () => {
    const viewer = modulesFor("read");
    const editor = editorModulesFor({ mode: "edit" });
    for (const module of viewer) {
      expect(editor).toContain(module);
    }
    expect(editor.length).toBeGreaterThan(viewer.length);
  });

  it("registriert im Lesemodus mit chrome=minimal gar nichts", () => {
    expect(editorServicesFor({ mode: "read", chrome: "minimal" })).toEqual([]);
    expect(editorModulesFor({ mode: "read", chrome: "minimal" })).toEqual(
      modulesFor("read"),
    );
  });

  it("registriert im Lesemodus mit chrome=full nur die Oberfläche", () => {
    const services = editorServicesFor({ mode: "read", chrome: "full" });
    expect(services).toContain("paletteProvider");
    expect(services).toContain("editorAnnouncer");
    // Keine Bearbeitung: kein Kontextmenü, keine Tastaturbefehle, kein Anlegen.
    expect(services).not.toContain("contextPadProvider");
    expect(services).not.toContain("editorKeyboard");
    expect(services).not.toContain("elementCreation");
  });

  it("liest `editable` aus der Modulliste ab, nicht aus einer Option", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const config = harness.service<EditorConfiguration>("editorConfig");
    // `modeling` ist registriert ⇒ bearbeitbar, ohne dass es jemand gesagt hat.
    expect(config.editable).toBe(true);
    expect(config.showsChrome).toBe(true);
    harness.destroy();
  });

  it("zeigt die Begründung im Namen der Palette, wenn nicht bearbeitet wird", async () => {
    harness = await openEditor(SIMPLE_PROCESS, {
      editor: { editable: false, chrome: "full" },
    });
    const node = harness
      .service<PaletteChrome>("paletteChrome")
      .element() as HTMLElement;
    expect(node.getAttribute("aria-label")).toContain("nur Ansicht");
    expect(node.getAttribute("aria-label")).toContain("Prozessmodellierer");
    harness.destroy();
  });

  it("verweigert das Anlegen im Lesemodus mit Begründung", async () => {
    harness = await openEditor(SIMPLE_PROCESS, {
      editor: { editable: false, chrome: "full" },
    });
    const before = harness.session.elementRegistry.getAll().length;
    const button = (
      harness.service<PaletteChrome>("paletteChrome").element() as HTMLElement
    ).querySelector<HTMLElement>("button.entry");
    button?.click();
    expect(harness.session.elementRegistry.getAll().length).toBe(before);
    expect(harness.said()).toContain("Prozessmodellierer");
    harness.destroy();
  });

  it("nimmt einen eigenen Vorrat und eine eigene Begründung entgegen", async () => {
    harness = await openEditor(SIMPLE_PROCESS, {
      editor: {
        hidePaletteItems: ["create.group", "create.data-store"],
        disabledReason: "Freigabe läuft.",
        gridStep: 10,
      },
    });
    const config = harness.service<EditorConfiguration>("editorConfig");
    expect(config.paletteItems.some((item) => item.id === "create.group")).toBe(
      false,
    );
    expect(config.gridStep).toBe(10);
    expect(config.disabledReason).toBe("Freigabe läuft.");

    const task = harness.session.shape("Task_1");
    harness.service<SelectionLike>("selection").select(task);
    const before = task.x;
    harness.key({ key: "ArrowRight", shiftKey: true });
    expect(task.x).toBe(before + 10);
    harness.destroy();
  });
});
