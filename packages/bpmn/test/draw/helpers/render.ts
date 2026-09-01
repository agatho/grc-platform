/// <reference lib="dom" />

import BpmnRenderer from "../../../src/draw/BpmnRenderer.js";
import { SVG_NS } from "../../../src/draw/svg.js";
import type {
  BpmnConnection,
  BpmnRendererConfig,
  BpmnShape,
  ModdleElement,
  Point,
} from "../../../src/draw/types.js";

/**
 * Zeichenhilfen für die Tests.
 *
 * Der Renderer wird ohne `diagram-js`-Canvas betrieben: `BaseRenderer` meldet
 * sich nur beim EventBus an, und für die Prüfung der Formen genügt ein
 * losgelöstes `<svg>`. Das hält die Formtests schnell und frei von
 * Layout-Annahmen.
 */

class NoopEventBus {
  on(): void {
    /* keine Ereignisse in den Formtests */
  }
}

export function createRenderer(config?: BpmnRendererConfig): BpmnRenderer {
  return new BpmnRenderer(new NoopEventBus(), config);
}

export interface DrawnShape {
  readonly svg: SVGSVGElement;
  readonly visual: SVGGElement;
  readonly shape: BpmnShape;
}

export function makeShape(
  type: string,
  overrides: Partial<BpmnShape> & {
    businessObject?: Partial<ModdleElement>;
  } = {},
): BpmnShape {
  const bo: ModdleElement = {
    $type: type,
    id: overrides.id ?? "e1",
    ...(overrides.businessObject as Record<string, unknown> | undefined),
  } as ModdleElement;

  return {
    id: overrides.id ?? "e1",
    type,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 100,
    height: overrides.height ?? 80,
    businessObject: overrides.businessObject
      ? (overrides.businessObject as ModdleElement)
      : bo,
    di: overrides.di,
    labelTarget: overrides.labelTarget,
  };
}

export function makeConnection(
  type: string,
  overrides: Partial<BpmnConnection> & {
    businessObject?: Partial<ModdleElement>;
  } = {},
): BpmnConnection {
  const waypoints: Point[] = overrides.waypoints
    ? [...overrides.waypoints]
    : [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
  return {
    id: overrides.id ?? "c1",
    type,
    waypoints,
    businessObject:
      (overrides.businessObject as ModdleElement | undefined) ??
      ({ $type: type, id: overrides.id ?? "c1" } as ModdleElement),
    source: overrides.source,
    target: overrides.target,
    di: overrides.di,
  };
}

function emptySvg(): { svg: SVGSVGElement; visual: SVGGElement } {
  const svg = document.createElementNS(SVG_NS, "svg");
  document.body.appendChild(svg);
  const visual = document.createElementNS(SVG_NS, "g");
  visual.setAttribute("class", "djs-visual");
  svg.appendChild(visual);
  return { svg, visual };
}

export function drawShape(
  shape: BpmnShape,
  config?: BpmnRendererConfig,
): DrawnShape {
  const { svg, visual } = emptySvg();
  createRenderer(config).drawShape(visual, shape);
  return { svg, visual, shape };
}

export function drawConnection(
  connection: BpmnConnection,
  config?: BpmnRendererConfig,
): { svg: SVGSVGElement; visual: SVGGElement } {
  const { svg, visual } = emptySvg();
  createRenderer(config).drawConnection(visual, {
    ...connection,
    waypoints: [...connection.waypoints],
  });
  return { svg, visual };
}

/** Die tragende Kontur eines gezeichneten Elements. */
export function outlineOf(visual: SVGElement): SVGElement {
  const outline = visual.querySelector(".bpmn-outline");
  if (!outline) {
    throw new Error("kein Element mit der Klasse .bpmn-outline gefunden");
  }
  return outline as SVGElement;
}

export function strokeWidthOf(node: SVGElement): number {
  return Number(node.getAttribute("stroke-width"));
}

export function symbolNames(visual: SVGElement): string[] {
  return Array.from(visual.querySelectorAll("[data-symbol]")).map(
    (node) => node.getAttribute("data-symbol") ?? "",
  );
}

export function markerNames(visual: SVGElement): string[] {
  return Array.from(visual.querySelectorAll("[data-marker]")).map(
    (node) => node.getAttribute("data-marker") ?? "",
  );
}

/**
 * Sichtbarer Text eines Visuals — Zeilen (`<tspan>`) mit Leerzeichen verbunden,
 * damit ein Umbruch die Prüfung auf den Beschriftungstext nicht zerreißt.
 */
export function textContentOf(visual: SVGElement): string {
  const lines = Array.from(visual.querySelectorAll("tspan")).map(
    (node) => node.textContent ?? "",
  );
  if (lines.length > 0) {
    return lines.join(" ").trim();
  }
  return Array.from(visual.querySelectorAll("text"))
    .map((node) => node.textContent ?? "")
    .join(" ")
    .trim();
}
