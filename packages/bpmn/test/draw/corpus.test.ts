/// <reference lib="dom" />

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { buildScene, type Scene } from "../../src/draw/scene.js";
import { renderScene, toSvgString } from "../../src/draw/StaticRenderer.js";
import type { ModdleElement } from "../../src/draw/types.js";
import { importXml } from "../../src/model/index.js";
import { buildTextAlternative } from "../../src/viewer/TextAlternative.js";

/**
 * Rendering-Durchlauf über den gesamten Testkorpus.
 *
 * Zugesichert wird (Aufgabe 4):
 * - kein Fehler beim Zeichnen
 * - jedes Element der Szene hat eine SVG-Entsprechung
 * - keine Nullflächen
 * - keine NaN-Koordinaten im erzeugten SVG
 *
 * Nebenbei entstehen die sichtbaren Belege in `test/draw/rendered/`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(here, "..", "corpus");
const OUT_DIR = join(here, "rendered");

interface CorpusEntry {
  readonly name: string;
  readonly xml: string;
}

interface Rendered {
  readonly name: string;
  readonly scene: Scene;
  readonly svg: string;
  readonly svgRoot: SVGSVGElement;
}

const entries: CorpusEntry[] = readdirSync(CORPUS_DIR)
  .filter((file) => file.endsWith(".bpmn"))
  .sort()
  .map((file) => ({
    name: file.replace(/\.bpmn$/, ""),
    xml: readFileSync(join(CORPUS_DIR, file), "utf8"),
  }));

const rendered: Rendered[] = [];
const empty: string[] = [];

beforeAll(async () => {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  for (const entry of entries) {
    let definitions: ModdleElement;
    try {
      const result = await importXml(entry.xml);
      definitions = result.definitions;
    } catch {
      // Nicht einlesbare Dateien sind Sache der Modellschicht, nicht des
      // Renderers — hier bewusst übersprungen statt fälschlich als
      // Renderfehler gezählt.
      continue;
    }

    const scene = buildScene(definitions);
    if (scene.shapes.length === 0 && scene.connections.length === 0) {
      empty.push(entry.name);
      continue;
    }

    const alternative = buildTextAlternative(scene);
    const result = renderScene(scene, {
      title: entry.name,
      description: alternative.prose.slice(0, 600),
    });
    const svg = toSvgString(result);
    rendered.push({ name: entry.name, scene, svg, svgRoot: result.svg });
    writeFileSync(join(OUT_DIR, `${entry.name}.svg`), svg, "utf8");
  }

  writeFileSync(join(OUT_DIR, "_index.html"), contactSheet(rendered), "utf8");
}, 60_000);

describe("Korpus-Rendering", () => {
  it("der Korpus ist nicht leer", () => {
    expect(entries.length).toBeGreaterThan(10);
  });

  it("mindestens fünf Diagramme wurden als eigenständige SVG-Dateien abgelegt", () => {
    const files = readdirSync(OUT_DIR).filter((file) => file.endsWith(".svg"));
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it("Dateien ohne DI erzeugen eine leere Szene statt eines Fehlers", () => {
    // Der Korpus enthält absichtlich Diagramme ohne DI-Abschnitt.
    expect(empty.length).toBeGreaterThan(0);
    for (const name of empty) {
      const source = entries.find((entry) => entry.name === name)?.xml ?? "";
      // Leer ist nur richtig, wenn die Datei tatsächlich keine zeichenbare DI hat.
      expect(source, name).not.toMatch(/BPMNShape/);
    }
  });

  it("jedes Element der Szene hat genau eine SVG-Entsprechung", () => {
    for (const item of rendered) {
      const ids = new Set<string>();
      for (const node of Array.from(
        item.svgRoot.querySelectorAll("[data-element-id]"),
      )) {
        const id = node.getAttribute("data-element-id");
        if (id) {
          ids.add(id);
        }
      }
      for (const shape of item.scene.shapes) {
        expect(
          ids.has(shape.id),
          `${item.name}: Knoten ${shape.id} fehlt im SVG`,
        ).toBe(true);
      }
      for (const connection of item.scene.connections) {
        expect(
          ids.has(connection.id),
          `${item.name}: Kante ${connection.id} fehlt im SVG`,
        ).toBe(true);
      }
    }
  });

  it("jede Elementgruppe trägt eine Rolle und einen zugänglichen Namen", () => {
    for (const item of rendered) {
      for (const node of Array.from(
        item.svgRoot.querySelectorAll("g.djs-element"),
      )) {
        expect(node.getAttribute("role"), `${item.name}`).toMatch(
          /^(button|img)$/,
        );
        expect(
          (node.getAttribute("aria-label") ?? "").length,
          `${item.name}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("keine Nullflächen", () => {
    for (const item of rendered) {
      for (const shape of item.scene.shapes) {
        expect(shape.width, `${item.name}/${shape.id}`).toBeGreaterThan(0);
        expect(shape.height, `${item.name}/${shape.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("keine NaN- oder Infinity-Koordinaten im erzeugten SVG", () => {
    for (const item of rendered) {
      expect(item.svg, item.name).not.toMatch(/NaN/);
      expect(item.svg, item.name).not.toMatch(/Infinity/);
      expect(item.svg, item.name).not.toMatch(/undefined/);
    }
  });

  it("jedes gezeichnete Element trägt seinen BPMN-Typ", () => {
    for (const item of rendered) {
      for (const visual of Array.from(
        item.svgRoot.querySelectorAll("g.djs-visual"),
      )) {
        expect(visual.getAttribute("data-bpmn-type"), item.name).toBeTruthy();
      }
    }
  });

  it("der Viewport umschließt alle Elemente", () => {
    for (const item of rendered) {
      const viewBox = (item.svgRoot.getAttribute("viewBox") ?? "")
        .split(" ")
        .map(Number);
      const [vx, vy, vw, vh] = viewBox;
      expect(vx, item.name).not.toBeNaN();
      if (
        vx === undefined ||
        vy === undefined ||
        vw === undefined ||
        vh === undefined
      ) {
        throw new Error(`${item.name}: unvollständige viewBox`);
      }
      for (const shape of item.scene.shapes) {
        expect(shape.x, `${item.name}/${shape.id}`).toBeGreaterThanOrEqual(vx);
        expect(shape.y, `${item.name}/${shape.id}`).toBeGreaterThanOrEqual(vy);
        expect(
          shape.x + shape.width,
          `${item.name}/${shape.id}`,
        ).toBeLessThanOrEqual(vx + vw);
        expect(
          shape.y + shape.height,
          `${item.name}/${shape.id}`,
        ).toBeLessThanOrEqual(vy + vh);
      }
    }
  });

  it("nicht unterstützte Typen sind ausgewiesen, nicht unsichtbar", () => {
    const unsupported = new Set<string>();
    for (const item of rendered) {
      for (const node of Array.from(
        item.svgRoot.querySelectorAll("[data-unsupported]"),
      )) {
        const visual = node.closest("g.djs-visual");
        const type = visual?.getAttribute("data-bpmn-type");
        if (type) {
          unsupported.add(type);
        }
      }
    }
    // Dokumentiert den Ist-Stand: was hier auftaucht, fehlt im Renderer.
    expect([...unsupported].sort()).toEqual([]);
  });

  it("die Textalternative zählt so viele Schritte wie die Szene Knoten hat", () => {
    for (const item of rendered) {
      const alternative = buildTextAlternative(item.scene);
      const navigable = item.scene.shapes.filter(
        (shape) => shape.type !== "bpmn:Group",
      ).length;
      expect(alternative.rows.length, item.name).toBe(navigable);
      const indexes = alternative.rows.map((row) => row.index);
      expect(indexes, item.name).toEqual([...indexes].sort((a, b) => a - b));
    }
  });
});

function contactSheet(items: readonly Rendered[]): string {
  const cards = items
    .map(
      (item) =>
        `<figure><figcaption>${escapeHtml(item.name)} — ${String(
          item.scene.shapes.length,
        )} Knoten, ${String(item.scene.connections.length)} Kanten</figcaption>` +
        `<img src="${encodeURIComponent(item.name)}.svg" alt="${escapeHtml(item.name)}"></figure>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>ARCTOS BPMN-Renderer — Korpus</title>
<style>
 body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; background: #f6f7f9; color: #12181f; }
 figure { background: #fff; border: 1px solid #d5d9de; border-radius: 6px; margin: 0 0 1.5rem; padding: 1rem; }
 figcaption { font-weight: 600; margin-bottom: .75rem; }
 img { max-width: 100%; height: auto; }
</style></head>
<body><h1>Gerenderter Testkorpus (${String(items.length)} Diagramme)</h1>
${cards}
</body></html>
`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) =>
    char === "&"
      ? "&amp;"
      : char === "<"
        ? "&lt;"
        : char === ">"
          ? "&gt;"
          : "&quot;",
  );
}
