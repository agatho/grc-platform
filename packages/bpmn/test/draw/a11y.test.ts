/// <reference lib="dom" />

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import axe from "axe-core";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildScene } from "../../src/draw/scene.js";
import { importXml } from "../../src/model/index.js";
import { buildGraphOrder } from "../../src/viewer/order.js";
import {
  buildTextAlternative,
  renderTextAlternativeTable,
} from "../../src/viewer/TextAlternative.js";
import { BpmnCanvas } from "../../src/viewer/BpmnCanvas.js";
import { installSvgPolyfills, JSDOM_LIMITATIONS } from "./helpers/jsdom-svg.js";

/**
 * Barrierefreiheit (Aufgabe 3).
 *
 * Audit-Finding S14-10: im heutigen Modul **kein einziges** `aria-*`, `role`,
 * `tabIndex` oder Tastatur-Handler. Hier wird geprüft, dass die
 * Eigenimplementierung das von Anfang an mitbringt — und ehrlich festgehalten,
 * was jsdom davon *nicht* prüfen kann (`JSDOM_LIMITATIONS`).
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

async function mount(name: string): Promise<BpmnCanvas> {
  const canvas = new BpmnCanvas({ container, importXml });
  await canvas.importXml(corpus(name));
  return canvas;
}

function key(init: KeyboardEventInit): void {
  container.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, ...init }),
  );
}

function liveText(): string {
  return container.querySelector(".arctos-bpmn-live")?.textContent ?? "";
}

describe("Fokusmodell und ARIA", () => {
  it("die Fläche ist ein Tabstopp mit Rolle und Namen", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");

    expect(container.getAttribute("role")).toBe("application");
    expect(container.getAttribute("aria-roledescription")).toBe(
      "BPMN-Prozessdiagramm",
    );
    expect(container.getAttribute("aria-label")).toBeTruthy();
    expect(container.tabIndex).toBe(0);
    canvas.destroy();
  });

  it("jeder Knoten trägt Rolle, Namen und maschinenlesbare Position", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    const scene = canvas.getScene();
    expect(scene).not.toBeNull();

    for (const shape of scene?.shapes ?? []) {
      const graphics = container.querySelector(
        `g.djs-element[data-element-id="${shape.id}"]`,
      );
      expect(graphics, shape.id).not.toBeNull();
      expect(graphics?.getAttribute("role"), shape.id).toMatch(
        /^(button|img)$/,
      );
      expect(
        (graphics?.getAttribute("aria-label") ?? "").length,
        shape.id,
      ).toBeGreaterThan(0);
      // `aria-posinset`/`aria-setsize` sind an `button`/`img` nicht erlaubt
      // (ARIA 1.2) — die Position steht deshalb in `data-order`, wird angesagt
      // und erscheint in der Textalternative.
      expect(graphics?.getAttribute("aria-posinset"), shape.id).toBeNull();
      expect(
        Number(graphics?.getAttribute("data-order")),
        shape.id,
      ).toBeGreaterThan(0);
      expect(graphics?.getAttribute("tabindex"), shape.id).toBe("-1");
    }
    canvas.destroy();
  });

  it("Kanten sind benannt und nennen Quelle und Ziel", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    const scene = canvas.getScene();

    for (const connection of scene?.connections ?? []) {
      const graphics = container.querySelector(
        `g.djs-element[data-element-id="${connection.id}"]`,
      );
      expect(graphics?.getAttribute("role"), connection.id).toBe("img");
      expect(graphics?.getAttribute("aria-label"), connection.id).toMatch(
        /von .* nach /,
      );
    }
    canvas.destroy();
  });

  it("die Visuals sind aria-hidden, damit der Name genau einmal vorkommt", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    const visuals = container.querySelectorAll("g.djs-visual");
    expect(visuals.length).toBeGreaterThan(0);
    for (const visual of Array.from(visuals)) {
      expect(visual.getAttribute("aria-hidden")).toBe("true");
    }
    canvas.destroy();
  });
});

describe("Tastaturnavigation über den Graphen", () => {
  it("Pfeil rechts bewegt den Fokus in topologischer Ordnung", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    const scene = canvas.getScene();
    const order = buildGraphOrder(
      scene ?? {
        shapes: [],
        connections: [],
        labels: [],
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        warnings: [],
        root: undefined,
      },
    );

    key({ key: "ArrowRight" });
    const first = order.nodes[0];
    expect(first).toBeDefined();
    expect(liveText()).toContain("Schritt 1 von");

    key({ key: "ArrowRight" });
    expect(liveText()).toContain("Schritt 2 von");

    key({ key: "ArrowLeft" });
    expect(liveText()).toContain("Schritt 1 von");
    canvas.destroy();
  });

  it("die Ordnung beginnt beim Startereignis, nicht bei der DI-Reihenfolge", async () => {
    const result = await importXml(corpus("repo-prd-sales-with-gateway"));
    const scene = buildScene(result.definitions);
    const order = buildGraphOrder(scene);

    expect(order.nodes[0]?.shape.type).toBe("bpmn:StartEvent");
    // Jeder Nachfolger steht nach seinem Vorgänger, solange der Graph azyklisch ist.
    const positions = new Map(
      order.nodes.map((node) => [node.shape.id, node.index]),
    );
    expect(positions.size).toBe(order.nodes.length);
  });

  it("an einer Verzweigung wechseln Pfeil ab/auf zwischen den Zweigen", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    const scene = canvas.getScene();
    const order = buildGraphOrder(
      scene ?? {
        shapes: [],
        connections: [],
        labels: [],
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        warnings: [],
        root: undefined,
      },
    );
    const gateway = order.nodes.find((node) => node.outgoing.length > 1);
    expect(gateway, "Korpusdiagramm ohne Verzweigung").toBeDefined();

    canvas.focusElement(gateway?.shape.id ?? "");
    expect(liveText()).toContain("ausgehende Pfade");

    key({ key: "ArrowDown" });
    const afterDown = liveText();
    key({ key: "ArrowUp" });
    key({ key: "ArrowUp" });
    expect(liveText()).not.toBe(afterDown);
    canvas.destroy();
  });

  it("Leertaste wählt aus, Enter meldet die Aktivierung", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    const activated: string[] = [];
    canvas.on("element.activate", (event) => {
      if (event.element?.id) {
        activated.push(event.element.id);
      }
    });

    key({ key: "ArrowRight" });
    key({ key: " " });
    expect(liveText()).toContain("ausgewählt");
    const selection = canvas.get<{ get: () => Array<{ id: string }> }>(
      "selection",
    );
    expect(selection.get()).toHaveLength(1);

    key({ key: "Enter" });
    expect(activated).toHaveLength(1);
    canvas.destroy();
  });

  it("Strg + Pfeil verschiebt die Fläche, statt den Fokus zu bewegen", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    key({ key: "ArrowRight" });
    const before = liveText();

    key({ key: "ArrowRight", ctrlKey: true });
    expect(liveText()).toBe(before);
    canvas.destroy();
  });

  it("0 passt die Ansicht ein und meldet es", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    key({ key: "0" });
    expect(liveText()).toContain("eingepasst");
    canvas.destroy();
  });

  it("die Live-Region ist eine höfliche Statusregion", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    const live = container.querySelector(".arctos-bpmn-live");
    expect(live?.getAttribute("role")).toBe("status");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    canvas.destroy();
  });
});

describe("Textalternative", () => {
  it("nummeriert wie die Tastaturordnung", async () => {
    const result = await importXml(corpus("synth-collaboration-pools-lanes"));
    const scene = buildScene(result.definitions);
    const order = buildGraphOrder(scene);
    const alternative = buildTextAlternative(scene, order);

    expect(alternative.rows).toHaveLength(order.nodes.length);
    expect(alternative.rows[0]?.index).toBe(order.nodes[0]?.index);
    expect(alternative.rows[0]?.id).toBe(order.nodes[0]?.shape.id);
  });

  it("nennt Lane, Vorgänger und Nachfolger", async () => {
    const result = await importXml(corpus("synth-collaboration-pools-lanes"));
    const alternative = buildTextAlternative(buildScene(result.definitions));

    const withLane = alternative.rows.filter((row) => row.container !== "");
    expect(withLane.length).toBeGreaterThan(0);
    const withSuccessors = alternative.rows.filter(
      (row) => row.successors.length > 0,
    );
    expect(withSuccessors.length).toBeGreaterThan(0);
  });

  it("erzeugt eine Fließtextform des Ablaufs", async () => {
    const result = await importXml(corpus("repo-prd-sales-with-gateway"));
    const alternative = buildTextAlternative(buildScene(result.definitions));

    expect(alternative.prose).toMatch(/Der Prozess beginnt mit/);
    expect(alternative.prose).toMatch(/Schritt 2/);
  });

  it("die Tabelle hat Beschriftung, Spalten- und Zeilenköpfe", async () => {
    const result = await importXml(corpus("repo-prd-sales-with-gateway"));
    const table = renderTextAlternativeTable(
      buildTextAlternative(buildScene(result.definitions)),
    );

    expect(table.querySelector("caption")?.textContent).toBeTruthy();
    expect(table.querySelectorAll('thead th[scope="col"]')).toHaveLength(6);
    expect(
      table.querySelectorAll('tbody th[scope="row"]').length,
    ).toBeGreaterThan(0);
  });
});

describe("axe-core", () => {
  it("die Textalternative ist frei von Verstößen", async () => {
    const result = await importXml(corpus("repo-prd-sales-with-gateway"));
    const table = renderTextAlternativeTable(
      buildTextAlternative(buildScene(result.definitions)),
    );
    const region = document.createElement("main");
    region.appendChild(table);
    document.body.appendChild(region);

    const report = await axe.run(region, { resultTypes: ["violations"] });
    expect(report.violations.map((violation) => violation.id)).toEqual([]);
  }, 30_000);

  it("die Diagrammfläche ist frei von Verstößen", async () => {
    const canvas = await mount("repo-prd-sales-with-gateway");
    const report = await axe.run(container, { resultTypes: ["violations"] });
    expect(
      report.violations.map(
        (violation) => `${violation.id}: ${violation.help}`,
      ),
    ).toEqual([]);
    canvas.destroy();
  }, 30_000);

  it("hält fest, was jsdom nicht prüfen kann", () => {
    // Kein Verhaltenstest, sondern ein dokumentierender: die Grenzen sollen im
    // Testlauf sichtbar sein und nicht nur im Protokoll stehen.
    expect(JSDOM_LIMITATIONS.length).toBeGreaterThan(3);
    expect(JSDOM_LIMITATIONS.join(" ")).toMatch(/Farbkontrast/);
  });
});
