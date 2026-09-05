/// <reference lib="dom" />

import BpmnRenderer from "./BpmnRenderer";
import { buildScene, type Scene } from "./scene";
import { getAriaRole, getLabelText, getTypeLabel } from "./semantic";
import { svgAppend, svgAttr, svgCreate } from "./svg";
import { DEFAULT_PALETTE } from "./theme";
import { isConnection, type BpmnElement, type ModdleElement } from "./types";

/**
 * Rendert eine Szene ohne `diagram-js`-Canvas in ein eigenständiges SVG.
 *
 * Zweck (drei auf einmal):
 * 1. **Beleg.** Korpusdiagramme werden als `.svg`-Dateien abgelegt und lassen
 *    sich in jedem Betrachter ansehen — der eigentliche Spike-Nachweis.
 * 2. **Test.** Prüfungen auf Formen, Marker und Randstärken brauchen weder
 *    Canvas noch Browser-Layout, laufen also in jsdom.
 * 3. **Serverseite.** Derselbe Weg trägt später PDF-/PNG-Export im Worker
 *    (Plan §2.5: die Engine bleibt framework-frei).
 *
 * Der *Zeichencode ist derselbe* wie im Canvas-Betrieb — es wird derselbe
 * `BpmnRenderer` benutzt, nur die Einbettung unterscheidet sich. Damit kann das
 * Exportbild nicht vom Bildschirmbild abweichen.
 */

/** Minimaler EventBus-Ersatz: `BaseRenderer` registriert nur Handler. */
class NoopEventBus {
  on(): void {
    /* der statische Renderer ruft die Zeichenmethoden direkt auf */
  }
}

export interface StaticRenderOptions {
  /** Rand um die Zeichnung in px. */
  readonly padding?: number;
  /** Titel des SVG (`<title>`, WCAG 1.1.1 für die eigenständige Datei). */
  readonly title?: string;
  /** Beschreibung (`<desc>`). */
  readonly description?: string;
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly contrast?: "normal" | "more";
  /** Hintergrundfläche zeichnen (für Dateien sinnvoll, im Canvas nicht). */
  readonly background?: boolean;
}

export interface StaticRenderResult {
  readonly svg: SVGSVGElement;
  readonly scene: Scene;
  /** Anzahl gezeichneter Elemente (Knoten + Kanten, ohne Beschriftungen). */
  readonly elementCount: number;
}

/** Zeichnet eine bereits gebaute Szene. */
export function renderScene(
  scene: Scene,
  options: StaticRenderOptions = {},
): StaticRenderResult {
  const padding = options.padding ?? 20;
  const renderer = new BpmnRenderer(new NoopEventBus(), {
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    contrast: options.contrast,
  });

  const width = Math.max(scene.bounds.width + padding * 2, 1);
  const height = Math.max(scene.bounds.height + padding * 2, 1);
  const minX = scene.bounds.x - padding;
  const minY = scene.bounds.y - padding;

  // Kein eigenes `xmlns`-Attribut: der Knoten liegt bereits im SVG-Namensraum,
  // und `XMLSerializer` schreibt die Deklaration selbst. Setzt man sie zusätzlich
  // von Hand, entsteht `xmlns` doppelt und strenge Parser (librsvg, Batik,
  // Browser im XML-Modus) lehnen die Datei ab.
  const svg = svgCreate("svg", {
    version: "1.1",
    width,
    height,
    viewBox: `${String(round(minX))} ${String(round(minY))} ${String(round(width))} ${String(
      round(height),
    )}`,
    role: "img",
    class: "arctos-bpmn",
  });

  const titleText = options.title ?? "BPMN-Diagramm";
  const titleNode = svgCreate("title", { id: "arctos-bpmn-title" });
  titleNode.textContent = titleText;
  svgAppend(svg, titleNode);
  svgAttr(svg, { "aria-labelledby": "arctos-bpmn-title" });

  if (options.description) {
    const desc = svgCreate("desc", { id: "arctos-bpmn-desc" });
    desc.textContent = options.description;
    svgAppend(svg, desc);
    svgAttr(svg, { "aria-describedby": "arctos-bpmn-desc" });
  }

  if (options.background !== false) {
    svgAppend(
      svg,
      svgCreate("rect", {
        x: minX,
        y: minY,
        width,
        height,
        fill: DEFAULT_PALETTE.canvas,
        "aria-hidden": "true",
      }),
    );
  }

  const layer = svgCreate("g", { class: "arctos-bpmn-layer" });
  svgAppend(svg, layer);

  let count = 0;
  for (const shape of scene.shapes) {
    const group = elementGroup(layer, shape, "djs-shape");
    renderer.drawShape(visualOf(group), shape);
    count += 1;
  }
  for (const connection of scene.connections) {
    const group = elementGroup(layer, connection, "djs-connection");
    renderer.drawConnection(visualOf(group), {
      ...connection,
      waypoints: [...connection.waypoints],
    });
    count += 1;
  }
  for (const label of scene.labels) {
    const group = elementGroup(layer, label, "djs-label-shape");
    renderer.drawShape(visualOf(group), label);
  }

  return { svg, scene, elementCount: count };
}

/** Baut die Szene aus `definitions` und zeichnet sie. */
export function renderDefinitions(
  definitions: ModdleElement,
  options: StaticRenderOptions = {},
): StaticRenderResult {
  return renderScene(buildScene(definitions), options);
}

/**
 * Serialisiert das Ergebnis als eigenständige SVG-Datei.
 *
 * `XMLSerializer` steht in jsdom zur Verfügung; ein eigener Serialisierer wäre
 * nur eine Fehlerquelle mehr.
 */
export function toSvgString(result: StaticRenderResult): string {
  const serialized = new XMLSerializer().serializeToString(result.svg);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}\n`;
}

/**
 * Erzeugt die äußere Elementgruppe mit Rolle und zugänglichem Namen.
 *
 * Der zugängliche Name entsteht *zentral* aus dem Modell (Plan §4.5) — nicht an
 * zwanzig Aufrufstellen. Die Visuals darunter sind `aria-hidden`, damit
 * Screenreader den Namen genau einmal hören.
 */
function elementGroup(
  parent: SVGElement,
  element: BpmnElement,
  className: string,
): SVGGElement {
  const group = svgCreate("g", {
    class: `djs-element ${className}`,
    "data-element-id": element.id,
    role: getAriaRole(element),
    "aria-label": describeElement(element),
    tabindex: -1,
  });
  svgAppend(parent, group);
  const visual = svgCreate("g", { class: "djs-visual" });
  svgAppend(group, visual);
  return group;
}

function visualOf(group: SVGGElement): SVGElement {
  const visual = group.firstElementChild;
  if (!visual) {
    throw new Error("Elementgruppe ohne Visual");
  }
  return visual as SVGElement;
}

/** Kurzbeschreibung eines Elements für `aria-label` und Textalternative. */
export function describeElement(element: BpmnElement): string {
  const typeLabel = getTypeLabel(
    element.type === "label" ? "label" : element.type,
  );
  const name = getLabelText(element);

  if (element.type === "label") {
    return name ? `Beschriftung ${name}` : "Beschriftung";
  }
  if (isConnection(element)) {
    const from = element.source
      ? getLabelText(element.source) || element.source.id
      : "?";
    const to = element.target
      ? getLabelText(element.target) || element.target.id
      : "?";
    return name
      ? `${typeLabel} „${name}“ von ${from} nach ${to}`
      : `${typeLabel} von ${from} nach ${to}`;
  }
  return name
    ? `${typeLabel} „${name}“`
    : `${typeLabel} ohne Namen (${element.id})`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
