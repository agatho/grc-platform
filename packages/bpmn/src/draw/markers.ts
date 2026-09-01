/// <reference lib="dom" />

import { svgAppend, svgAttr, svgCreate, SVG_NS } from "./svg.js";

/**
 * Pfeilspitzen und Kantenenden als `<marker>` im `<defs>` des besitzenden SVG.
 *
 * BPMN unterscheidet vier Kantenenden (BPMN 2.0, Tabelle 10.5 / 10.7):
 * - Sequenzfluss: gefüllte Pfeilspitze
 * - Nachrichtenfluss: offene Pfeilspitze, am Anfang ein unausgefüllter Kreis
 * - Assoziation / Datenassoziation: offene, dünne Pfeilspitze
 * - Bedingter Sequenzfluss: unausgefüllte Raute am Anfang
 * - Standard-Sequenzfluss: Schrägstrich am Anfang
 *
 * Marker-IDs werden je SVG-Dokument vergeben, damit mehrere Diagramme auf einer
 * Seite sich nicht gegenseitig überschreiben.
 */

export type MarkerKind =
  | "sequenceflow-end"
  | "messageflow-start"
  | "messageflow-end"
  | "association-end"
  | "conditional-flow-start"
  | "default-flow-start";

interface MarkerSpec {
  readonly viewBox: string;
  readonly refX: number;
  readonly refY: number;
  readonly width: number;
  readonly height: number;
  readonly draw: (colors: MarkerColors) => SVGElement;
}

export interface MarkerColors {
  readonly stroke: string;
  readonly fill: string;
}

const SPECS: Readonly<Record<MarkerKind, MarkerSpec>> = {
  "sequenceflow-end": {
    viewBox: "0 0 20 20",
    refX: 11,
    refY: 10,
    width: 10,
    height: 10,
    draw: ({ stroke }) =>
      svgCreate("path", {
        d: "M 1 5 L 11 10 L 1 15 z",
        fill: stroke,
        stroke,
        "stroke-width": 1,
        "stroke-linejoin": "round",
      }),
  },
  "messageflow-start": {
    viewBox: "0 0 20 20",
    refX: 6,
    refY: 10,
    width: 10,
    height: 10,
    draw: ({ stroke, fill }) =>
      svgCreate("circle", {
        cx: 6,
        cy: 10,
        r: 3.5,
        fill,
        stroke,
        "stroke-width": 1,
      }),
  },
  "messageflow-end": {
    viewBox: "0 0 20 20",
    refX: 11,
    refY: 10,
    width: 10,
    height: 10,
    draw: ({ stroke, fill }) =>
      svgCreate("path", {
        d: "M 1 5 L 11 10 L 1 15",
        fill,
        stroke,
        "stroke-width": 1,
        "stroke-linejoin": "round",
      }),
  },
  "association-end": {
    viewBox: "0 0 20 20",
    refX: 11,
    refY: 10,
    width: 10,
    height: 10,
    draw: ({ stroke }) =>
      svgCreate("path", {
        d: "M 1 5 L 11 10 L 1 15",
        fill: "none",
        stroke,
        "stroke-width": 1.5,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
  },
  "conditional-flow-start": {
    viewBox: "0 0 20 20",
    refX: 0,
    refY: 10,
    width: 20,
    height: 20,
    draw: ({ stroke, fill }) =>
      svgCreate("path", {
        d: "M 0 10 L 8 6 L 16 10 L 8 14 z",
        fill,
        stroke,
        "stroke-width": 1,
        "stroke-linejoin": "round",
      }),
  },
  "default-flow-start": {
    viewBox: "0 0 20 20",
    refX: 0,
    refY: 10,
    width: 20,
    height: 20,
    draw: ({ stroke }) =>
      svgCreate("path", {
        d: "M 2 14 L 10 6",
        fill: "none",
        stroke,
        "stroke-width": 1.5,
        "stroke-linecap": "round",
      }),
  },
};

export const MARKER_KINDS: readonly MarkerKind[] = Object.keys(
  SPECS,
) as MarkerKind[];

let documentCounter = 0;

/**
 * Verwaltet die `<marker>`-Definitionen eines SVG-Dokuments.
 *
 * Ein Registry-Objekt gehört zu genau einem `<svg>`; die Marker werden beim
 * ersten Gebrauch angelegt (lazily), damit ein Diagramm ohne Nachrichtenflüsse
 * keine unbenutzten Definitionen exportiert.
 */
export class MarkerRegistry {
  private readonly created = new Map<string, string>();
  private readonly suffix: string;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly colors: MarkerColors,
    suffix?: string,
  ) {
    documentCounter += 1;
    this.suffix = suffix ?? `d${String(documentCounter)}`;
  }

  /** Liefert einen `url(#…)`-Verweis und legt den Marker bei Bedarf an. */
  ref(kind: MarkerKind, colorOverride?: string): string {
    const stroke = colorOverride ?? this.colors.stroke;
    const key = `${kind}-${stroke}`;
    const existing = this.created.get(key);
    if (existing) {
      return `url(#${existing})`;
    }

    const spec = SPECS[kind];
    const id = `arctos-${kind}-${this.suffix}-${String(this.created.size)}`;
    const marker = svgCreate("marker", {
      id,
      viewBox: spec.viewBox,
      refX: spec.refX,
      refY: spec.refY,
      markerWidth: spec.width,
      markerHeight: spec.height,
      orient: "auto",
      markerUnits: "userSpaceOnUse",
    });
    svgAppend(marker, spec.draw({ stroke, fill: this.colors.fill }));
    svgAppend(this.defs(), marker);
    this.created.set(key, id);
    return `url(#${id})`;
  }

  private defs(): SVGDefsElement {
    const existing = this.svg.querySelector("defs");
    if (existing) {
      return existing;
    }
    const defs = svgCreate("defs");
    this.svg.insertBefore(defs, this.svg.firstChild);
    return defs;
  }
}

/** Findet das besitzende `<svg>` eines Knotens (auch außerhalb des Dokuments). */
export function ownerSvg(node: Node): SVGSVGElement | null {
  let current: Node | null = node;
  while (current) {
    if (
      current.nodeType === 1 &&
      (current as Element).namespaceURI === SVG_NS &&
      (current as Element).localName === "svg"
    ) {
      return current as SVGSVGElement;
    }
    current = current.parentNode;
  }
  return null;
}

/** Setzt Marker-Attribute auf einen Pfad, wenn ein `<svg>` verfügbar ist. */
export function applyMarkers(
  node: SVGElement,
  registry: MarkerRegistry | null,
  markers: { start?: MarkerKind; end?: MarkerKind },
  colorOverride?: string,
): void {
  if (!registry) {
    return;
  }
  if (markers.start) {
    svgAttr(node, {
      "marker-start": registry.ref(markers.start, colorOverride),
    });
  }
  if (markers.end) {
    svgAttr(node, { "marker-end": registry.ref(markers.end, colorOverride) });
  }
}
