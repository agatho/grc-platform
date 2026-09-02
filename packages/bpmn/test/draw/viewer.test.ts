/// <reference lib="dom" />

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { importXml } from "../../src/model/index.js";
import { BpmnCanvas } from "../../src/viewer/BpmnCanvas.js";
import { modulesFor } from "../../src/viewer/modules.js";
import { installSvgPolyfills } from "./helpers/jsdom-svg.js";

/**
 * Der Viewer im Ganzen: Bootstrap, Import, Canvas, Selektion, Overlays,
 * Aufräumen. Läuft in jsdom mit den SVG-Polyfills aus `helpers/jsdom-svg.ts`.
 *
 * Die Tests liegen unter `test/draw/`, weil dieser Arbeitsstrang nur dort
 * Dateihoheit hat; inhaltlich gehören sie zu `src/viewer`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(here, "..", "corpus");

function corpus(name: string): string {
  return readFileSync(join(CORPUS, `${name}.bpmn`), "utf8");
}

let container: HTMLElement;

beforeAll(() => {
  installSvgPolyfills();
});

beforeEach(() => {
  document.body.replaceChildren();
  container = document.createElement("div");
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
});

describe("Modus statt zweiter Implementierung", () => {
  it("read und review laden dieselbe Modulliste", () => {
    expect(modulesFor("read")).toEqual(modulesFor("review"));
  });

  it("edit lädt zusätzliche Module", () => {
    expect(modulesFor("edit").length).toBeGreaterThan(
      modulesFor("read").length,
    );
  });

  it("der Editor-Modus bringt die BPMN-Dienste mit, der Lesemodus nicht", () => {
    const editor = new BpmnCanvas({ container, mode: "edit" });
    for (const service of [
      "bpmnRules",
      "bpmnUpdater",
      "bpmnFactory",
      "bpmnImporter",
      "modeling",
      "commandStack",
      "paletteProvider",
      "contextPadProvider",
      "labelEditing",
    ]) {
      expect(editor.get(service), service).toBeTruthy();
    }
    expect(editor.editable).toBe(true);
    editor.destroy();

    const reader = new BpmnCanvas({ container, mode: "read" });
    expect(reader.editable).toBe(false);
    // Nicht „verboten", sondern **nicht registriert** — das ist der ganze
    // Unterschied zwischen den Modi.
    expect(() => reader.get("modeling")).toThrow();
    expect(() => reader.get("paletteProvider")).toThrow();
    expect(reader.canUndo()).toBe(false);
    reader.destroy();
  });
});

describe("BpmnCanvas (Lesepfad)", () => {
  it("importiert XML und legt für jedes Element eine Grafik an", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    const result = await canvas.importXml(corpus("repo-seed-risk-management"));

    expect(result.elementCount).toBeGreaterThan(3);
    const graphics = container.querySelectorAll(
      "g.djs-element[data-element-id]",
    );
    expect(graphics.length).toBeGreaterThanOrEqual(result.elementCount);
    canvas.destroy();
  });

  it("stellt die fünf heute benutzten diagram-js-Dienste bereit", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    await canvas.importXml(corpus("repo-prd-sales-with-gateway"));

    for (const service of [
      "canvas",
      "elementRegistry",
      "eventBus",
      "overlays",
      "selection",
    ]) {
      expect(canvas.get(service), service).toBeTruthy();
    }
    canvas.destroy();
  });

  it("Overlays lassen sich wie heute anhängen und wieder entfernen", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    const result = await canvas.importXml(
      corpus("repo-prd-sales-with-gateway"),
    );
    const task = result.scene.shapes.find((shape) =>
      shape.type.includes("Task"),
    );
    expect(task).toBeDefined();

    const overlays = canvas.get<{
      add: (id: string, type: string, options: unknown) => string;
      remove: (filter: unknown) => void;
      get: (filter: unknown) => unknown[];
    }>("overlays");

    const badge = document.createElement("div");
    badge.textContent = "3 Risiken";
    overlays.add(task?.id ?? "", "risk-badge", {
      position: { top: -14, right: 8 },
      html: badge,
    });
    expect(overlays.get({ type: "risk-badge" })).toHaveLength(1);

    overlays.remove({ type: "risk-badge" });
    expect(overlays.get({ type: "risk-badge" })).toHaveLength(0);
    canvas.destroy();
  });

  it("Selektion setzt den diagram-js-Marker", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    const result = await canvas.importXml(
      corpus("repo-prd-sales-with-gateway"),
    );
    const first = result.scene.shapes[0];
    expect(first).toBeDefined();

    canvas.select(first?.id ?? null);
    const selection = canvas.get<{ get: () => Array<{ id: string }> }>(
      "selection",
    );
    expect(selection.get().map((element) => element.id)).toEqual([first?.id]);
    canvas.destroy();
  });

  it("Zoom und Pan sind bedienbar", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    await canvas.importXml(corpus("repo-prd-sales-with-gateway"));

    canvas.zoom(1.5);
    expect(canvas.zoom()).toBeCloseTo(1.5, 5);
    expect(() => {
      canvas.scroll({ dx: 40, dy: -20 });
    }).not.toThrow();
    canvas.destroy();
  });

  it("Auto-Fit rechnet eine Zoomstufe aus, ohne zu scheitern", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    await canvas.importXml(corpus("synth-large-flat-process"));

    canvas.fitViewport();
    expect(Number.isFinite(canvas.zoom())).toBe(true);
    expect(canvas.zoom()).toBeGreaterThan(0);
    canvas.destroy();
  });

  it("ein zweiter Import ersetzt den Inhalt, statt ihn zu ergänzen", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    const first = await canvas.importXml(corpus("repo-prd-sales-with-gateway"));
    const second = await canvas.importXml(corpus("repo-seed-customer-service"));

    const ids = Array.from(container.querySelectorAll("[data-element-id]")).map(
      (node) => node.getAttribute("data-element-id"),
    );
    for (const shape of first.scene.shapes) {
      expect(ids).not.toContain(shape.id);
    }
    expect(ids).toContain(second.scene.shapes[0]?.id);
    canvas.destroy();
  });

  it("destroy räumt DOM, ARIA-Attribute und Live-Region auf", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    await canvas.importXml(corpus("repo-prd-sales-with-gateway"));
    expect(container.querySelector(".arctos-bpmn-live")).not.toBeNull();

    canvas.destroy();
    expect(container.childElementCount).toBe(0);
    expect(container.getAttribute("role")).toBeNull();
    expect(container.getAttribute("tabindex")).toBeNull();
    expect(() => {
      canvas.destroy();
    }).not.toThrow();
  });

  it("exportiert ein eigenständiges SVG mit Titel und Beschreibung", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    await canvas.importXml(corpus("repo-prd-sales-with-gateway"));

    const svg = canvas.exportSvg("Vertriebsprozess");
    expect(svg).toContain("<?xml");
    expect(svg).toContain("Vertriebsprozess");
    expect(svg).toMatch(/<desc/);
    expect(svg).not.toMatch(/NaN/);
    // Der Export enthält genau eine xmlns-Deklaration — sonst lehnen strenge
    // Parser (librsvg, Batik) die Datei ab.
    expect(svg.match(/xmlns="/g) ?? []).toHaveLength(1);
    canvas.destroy();
  });

  it("meldet eine fehlende Modellschicht verständlich", async () => {
    const canvas = new BpmnCanvas({
      container,
      importXml: () => {
        throw new Error("kaputt");
      },
    });
    await expect(canvas.importXml("<xml/>")).rejects.toThrow(/kaputt/);
    canvas.destroy();
  });
});

/**
 * Der Bearbeitungspfad — die Lücke, die `STUFE2-B2-EINBINDUNG.md` §3.4 als
 * „drei von vier Einbindungen" beschrieb. Geprüft wird nicht die Maus (das
 * geht in jsdom nicht, B1 §7.1), sondern dass dieselbe Komponente im Modus
 * `edit` die Modellierungsschicht bedient und **schreiben** kann.
 */
describe("BpmnCanvas (Bearbeitungspfad)", () => {
  it("importiert über die Modellierungsschicht: geschachtelt statt flach", async () => {
    const canvas = new BpmnCanvas({
      container,
      mode: "edit",
      importXml,
    });
    await canvas.importXml(corpus("synth-boundary-events"));

    const registry = canvas.get<{
      get: (id: string) => { parent?: { id?: string }; host?: { id?: string } };
    }>("elementRegistry");
    // Der flache Szenenaufbau des Lesepfads kennt weder `parent` noch `host`.
    expect(registry.get("Boundary_Timer").host?.id).toBe("Task_Freigabe");
    expect(registry.get("Task_Freigabe").parent?.id).toBe("Process_Boundary");
    canvas.destroy();
  });

  it("gibt unbearbeitetes XML byteweise unverändert zurück (Z-D)", async () => {
    const source = corpus("repo-prd-sales-with-gateway");
    const canvas = new BpmnCanvas({ container, mode: "edit", importXml });
    await canvas.importXml(source);

    expect(canvas.dirty).toBe(false);
    expect(await canvas.exportXml()).toBe(source);
    canvas.destroy();
  });

  it("exportiert nach einer Bearbeitung aus dem Modell — und nimmt sie mit", async () => {
    const source = corpus("repo-prd-sales-with-gateway");
    const canvas = new BpmnCanvas({ container, mode: "edit", importXml });
    await canvas.importXml(source);

    const modeling = canvas.get<{
      createShape: (
        attrs: unknown,
        position: unknown,
        parent: unknown,
      ) => { id: string };
    }>("modeling");
    const root = canvas.get<{ getRootElement: () => unknown }>("canvas");
    const created = modeling.createShape(
      { type: "bpmn:Task", name: "Nachtraeglich ergaenzt" },
      { x: 900, y: 400 },
      root.getRootElement(),
    );

    expect(canvas.dirty).toBe(true);
    const written = await canvas.exportXml();
    expect(written).not.toBe(source);
    expect(written).toContain("Nachtraeglich ergaenzt");
    expect(written).toContain(created.id);
    // Und die Textalternative zeigt den neuen Stand, nicht den alten.
    expect(canvas.getTextAlternative().prose).toContain(
      "Nachtraeglich ergaenzt",
    );
    canvas.destroy();
  });

  it("bedient Undo und Redo, der Lesemodus nicht", async () => {
    const canvas = new BpmnCanvas({ container, mode: "edit", importXml });
    await canvas.importXml(corpus("repo-prd-sales-with-gateway"));
    expect(canvas.canUndo()).toBe(false);

    const modeling = canvas.get<{
      updateProperties: (element: unknown, properties: unknown) => void;
    }>("modeling");
    const registry = canvas.get<{ get: (id: string) => unknown }>(
      "elementRegistry",
    );
    const target = registry.get("Task_offer");
    expect(target).toBeDefined();
    modeling.updateProperties(target, { name: "Umbenannt" });

    expect(canvas.canUndo()).toBe(true);
    canvas.undo();
    expect(canvas.canRedo()).toBe(true);
    canvas.destroy();
  });
});
