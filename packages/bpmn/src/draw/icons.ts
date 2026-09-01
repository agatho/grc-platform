/// <reference lib="dom" />

import { path, polygonPath, svgAppend, svgCreate } from "./svg.js";
import type { EventDefinitionType } from "./semantic.js";

/**
 * Symbolvorrat als SVG-Pfade.
 *
 * Bewusst *keine* Icon-Schrift: `bpmn-font` liegt in `bpmn-js/dist` und entfällt
 * mit der Ablösung. Alle Symbole sind hier in einem 20×20-Einheitsquadrat
 * beschrieben und werden beim Zeichnen in die Zielbox skaliert. Die Formen folgen
 * BPMN 2.0, Kapitel 10 (Tabellen 10.87 Ereignisse, 10.3 Aktivitätsmarker,
 * 10.31 Gateways).
 */

/**
 * Farbrollen eines Symbolteils.
 *
 * Drei Rollen statt zwei, weil BPMN *gefangene* und *geworfene* Ereignisse
 * genau darüber unterscheidet (BPMN 2.0, 10.4.3): dieselbe Form, einmal
 * ungefüllt mit dunkler Kontur, einmal dunkel gefüllt mit hellen Innenlinien.
 * Mit nur „gefüllt/ungefüllt" ließe sich das nicht ausdrücken.
 *
 * - `body`   – die Grundfläche des Symbols
 * - `line`   – Kontur und tragende Linien
 * - `detail` – Innenlinien, die *auf* der Grundfläche liegen müssen
 */
export type SymbolColorRole = "body" | "line" | "detail" | "none";

export interface SymbolPart {
  readonly d: string;
  readonly fill?: SymbolColorRole;
  readonly stroke?: SymbolColorRole;
  readonly strokeWidth?: number;
}

export type SymbolDef = readonly SymbolPart[];

export const SYMBOL_BOX = 20;

/* ------------------------------------------------------------------ *
 * Ereignissymbole
 * ------------------------------------------------------------------ */

const ENVELOPE: SymbolDef = [
  { d: "M 1 4 L 19 4 L 19 16 L 1 16 z", fill: "body", stroke: "line" },
  { d: "M 1 4 L 10 11.5 L 19 4", fill: "none", stroke: "detail" },
];

function timerSymbol(): SymbolDef {
  const parts: SymbolPart[] = [
    { d: circleOutline(10, 10, 9), fill: "body", stroke: "line" },
    // Zeiger: 11 Uhr und 3 Uhr, damit die Uhr auch klein als Uhr lesbar ist.
    {
      d: path("M", 10, 10, "L", 10, 3.5),
      fill: "none",
      stroke: "detail",
      strokeWidth: 1.5,
    },
    {
      d: path("M", 10, 10, "L", 14.5, 12),
      fill: "none",
      stroke: "detail",
      strokeWidth: 1.5,
    },
  ];
  for (let hour = 0; hour < 12; hour += 1) {
    const angle = (hour / 12) * Math.PI * 2;
    const sin = Math.sin(angle);
    const cos = -Math.cos(angle);
    parts.push({
      d: path(
        "M",
        10 + sin * 7.2,
        10 + cos * 7.2,
        "L",
        10 + sin * 8.8,
        10 + cos * 8.8,
      ),
      fill: "none",
      stroke: "detail",
      strokeWidth: 1,
    });
  }
  return parts;
}

function circleOutline(cx: number, cy: number, r: number): string {
  return path(
    "M",
    cx,
    cy - r,
    "A",
    r,
    r,
    0,
    1,
    1,
    cx,
    cy + r,
    "A",
    r,
    r,
    0,
    1,
    1,
    cx,
    cy - r,
    "z",
  );
}

const EVENT_SYMBOLS: Readonly<Record<EventDefinitionType, SymbolDef>> = {
  message: ENVELOPE,
  timer: timerSymbol(),
  error: [
    {
      d: polygonPath([
        [1, 19],
        [7.5, 6],
        [12.5, 12.5],
        [19, 1],
        [12.5, 14],
        [7.5, 7.5],
      ]),
      fill: "body",
      stroke: "line",
    },
  ],
  escalation: [
    {
      d: polygonPath([
        [10, 1],
        [19, 19],
        [10, 12],
        [1, 19],
      ]),
      fill: "body",
      stroke: "line",
    },
  ],
  cancel: [
    {
      d: polygonPath([
        [3.4, 1],
        [10, 7.6],
        [16.6, 1],
        [19, 3.4],
        [12.4, 10],
        [19, 16.6],
        [16.6, 19],
        [10, 12.4],
        [3.4, 19],
        [1, 16.6],
        [7.6, 10],
        [1, 3.4],
      ]),
      fill: "body",
      stroke: "line",
    },
  ],
  compensate: [
    {
      d:
        polygonPath([
          [1, 10],
          [10, 4],
          [10, 16],
        ]) +
        " " +
        polygonPath([
          [10, 10],
          [19, 4],
          [19, 16],
        ]),
      fill: "body",
      stroke: "line",
    },
  ],
  conditional: [
    { d: "M 3 1 L 17 1 L 17 19 L 3 19 z", fill: "body", stroke: "line" },
    {
      d: path("M", 5.5, 5, "L", 14.5, 5),
      fill: "none",
      stroke: "detail",
      strokeWidth: 1,
    },
    {
      d: path("M", 5.5, 8.4, "L", 14.5, 8.4),
      fill: "none",
      stroke: "detail",
      strokeWidth: 1,
    },
    {
      d: path("M", 5.5, 11.8, "L", 14.5, 11.8),
      fill: "none",
      stroke: "detail",
      strokeWidth: 1,
    },
    {
      d: path("M", 5.5, 15.2, "L", 14.5, 15.2),
      fill: "none",
      stroke: "detail",
      strokeWidth: 1,
    },
  ],
  link: [
    {
      d: polygonPath([
        [1, 7],
        [12, 7],
        [12, 3],
        [19, 10],
        [12, 17],
        [12, 13],
        [1, 13],
      ]),
      fill: "body",
      stroke: "line",
    },
  ],
  signal: [
    {
      d: polygonPath([
        [10, 1.5],
        [19, 17.5],
        [1, 17.5],
      ]),
      fill: "body",
      stroke: "line",
    },
  ],
  // Terminierung ist immer schwarz gefüllt — sie kommt nur an Endereignissen vor.
  terminate: [{ d: circleOutline(10, 10, 8.5), fill: "line", stroke: "none" }],
  multiple: [
    {
      d: polygonPath([
        [10, 1],
        [19, 8],
        [15.5, 19],
        [4.5, 19],
        [1, 8],
      ]),
      fill: "body",
      stroke: "line",
    },
  ],
  parallelMultiple: [
    {
      d: polygonPath([
        [7.8, 1],
        [12.2, 1],
        [12.2, 7.8],
        [19, 7.8],
        [19, 12.2],
        [12.2, 12.2],
        [12.2, 19],
        [7.8, 19],
        [7.8, 12.2],
        [1, 12.2],
        [1, 7.8],
        [7.8, 7.8],
      ]),
      fill: "body",
      stroke: "line",
    },
  ],
  none: [],
};

export function getEventSymbol(type: EventDefinitionType): SymbolDef {
  return EVENT_SYMBOLS[type];
}

/* ------------------------------------------------------------------ *
 * Aufgabentyp-Symbole (oben links in der Aktivität)
 * ------------------------------------------------------------------ */

/** Zahnrad, aus Zähnezahl und Radien erzeugt statt als Literalpfad gepflegt. */
function gearPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  teeth: number,
): string {
  const points: Array<[number, number]> = [];
  const step = Math.PI / teeth;
  for (let i = 0; i < teeth; i += 1) {
    const base = i * 2 * step;
    points.push([cx + Math.cos(base) * outer, cy + Math.sin(base) * outer]);
    points.push([
      cx + Math.cos(base + step * 0.55) * outer,
      cy + Math.sin(base + step * 0.55) * outer,
    ]);
    points.push([
      cx + Math.cos(base + step * 0.75) * inner,
      cy + Math.sin(base + step * 0.75) * inner,
    ]);
    points.push([
      cx + Math.cos(base + step * 1.65) * inner,
      cy + Math.sin(base + step * 1.65) * inner,
    ]);
    points.push([
      cx + Math.cos(base + step * 1.85) * outer,
      cy + Math.sin(base + step * 1.85) * outer,
    ]);
  }
  return polygonPath(points);
}

const TASK_SYMBOLS: Readonly<Record<string, SymbolDef>> = {
  "bpmn:UserTask": [
    // Kopf
    {
      d: circleOutline(10, 5.5, 4),
      fill: "body",
      stroke: "line",
      strokeWidth: 1.2,
    },
    // Schultern
    {
      d: path(
        "M",
        2,
        19,
        "C",
        2,
        12.5,
        6,
        10.5,
        10,
        10.5,
        "C",
        14,
        10.5,
        18,
        12.5,
        18,
        19,
        "z",
      ),
      fill: "body",
      stroke: "line",
      strokeWidth: 1.2,
    },
    // Kragen
    {
      d: path("M", 10, 10.5, "L", 10, 19),
      fill: "none",
      stroke: "line",
      strokeWidth: 1,
    },
  ],
  "bpmn:ServiceTask": [
    {
      d: gearPath(10, 10, 9.2, 6.4, 6),
      fill: "body",
      stroke: "line",
      strokeWidth: 1.2,
    },
    {
      d: circleOutline(10, 10, 3),
      fill: "body",
      stroke: "line",
      strokeWidth: 1.2,
    },
  ],
  "bpmn:SendTask": [
    {
      d: "M 1 4 L 19 4 L 19 16 L 1 16 z",
      fill: "line",
      stroke: "line",
      strokeWidth: 1.2,
    },
    {
      d: "M 1 4 L 10 11.5 L 19 4",
      fill: "none",
      stroke: "detail",
      strokeWidth: 1.2,
    },
  ],
  "bpmn:ReceiveTask": [
    {
      d: "M 1 4 L 19 4 L 19 16 L 1 16 z",
      fill: "body",
      stroke: "line",
      strokeWidth: 1.2,
    },
    {
      d: "M 1 4 L 10 11.5 L 19 4",
      fill: "none",
      stroke: "line",
      strokeWidth: 1.2,
    },
  ],
  "bpmn:ManualTask": [
    // Handrücken mit vier angedeuteten Fingern (vereinfachter Umriss)
    {
      d: path(
        "M",
        1,
        12,
        "L",
        5.5,
        12,
        "L",
        5.5,
        8,
        "L",
        17,
        8,
        "L",
        17,
        11,
        "L",
        9,
        11,
      ),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.3,
    },
    {
      d: path("M", 9, 11, "L", 18, 11, "L", 18, 14, "L", 9, 14),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.3,
    },
    {
      d: path(
        "M",
        9,
        14,
        "L",
        16.5,
        14,
        "L",
        16.5,
        17,
        "L",
        5.5,
        17,
        "L",
        5.5,
        12,
      ),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.3,
    },
    {
      d: path("M", 1, 12, "L", 1, 17, "L", 5.5, 17),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.3,
    },
  ],
  "bpmn:BusinessRuleTask": [
    {
      d: "M 1 4 L 19 4 L 19 16 L 1 16 z",
      fill: "body",
      stroke: "line",
      strokeWidth: 1.2,
    },
    {
      d: "M 1 4 L 19 4 L 19 7.6 L 1 7.6 z",
      fill: "line",
      stroke: "line",
      strokeWidth: 1.2,
    },
    {
      d: path("M", 1, 11.8, "L", 19, 11.8),
      fill: "none",
      stroke: "line",
      strokeWidth: 1,
    },
    {
      d: path("M", 7, 7.6, "L", 7, 16),
      fill: "none",
      stroke: "line",
      strokeWidth: 1,
    },
  ],
  "bpmn:ScriptTask": [
    // Blatt mit gewellten Kanten
    {
      d: path(
        "M",
        6,
        1,
        "C",
        2,
        4,
        8,
        7,
        4,
        10,
        "C",
        0,
        13,
        6,
        16,
        2,
        19,
        "L",
        14,
        19,
        "C",
        18,
        16,
        12,
        13,
        16,
        10,
        "C",
        20,
        7,
        14,
        4,
        18,
        1,
        "z",
      ),
      fill: "body",
      stroke: "line",
      strokeWidth: 1.2,
    },
    {
      d: path("M", 5.5, 6, "L", 13, 6),
      fill: "none",
      stroke: "line",
      strokeWidth: 1,
    },
    {
      d: path("M", 4.5, 10, "L", 12, 10),
      fill: "none",
      stroke: "line",
      strokeWidth: 1,
    },
    {
      d: path("M", 4, 14.5, "L", 11.5, 14.5),
      fill: "none",
      stroke: "line",
      strokeWidth: 1,
    },
  ],
};

export function getTaskSymbol(type: string): SymbolDef | undefined {
  return TASK_SYMBOLS[type];
}

/* ------------------------------------------------------------------ *
 * Aktivitätsmarker (unten mittig)
 * ------------------------------------------------------------------ */

export const MARKER_BOX = 14;

export const MARKER_SYMBOLS = {
  collapsed: [
    {
      d: "M 0 0 L 14 0 L 14 14 L 0 14 z",
      fill: "body",
      stroke: "line",
      strokeWidth: 1.4,
    },
    {
      d: path("M", 7, 3, "L", 7, 11),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.4,
    },
    {
      d: path("M", 3, 7, "L", 11, 7),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.4,
    },
  ] satisfies SymbolDef,
  loop: [
    {
      // Offener Kreisbogen mit Pfeilspitze — Schleifenmarker
      d: path("M", 12.4, 10.4, "A", 5.5, 5.5, 0, 1, 1, 9.4, 2.1),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.5,
    },
    {
      d: polygonPath([
        [6.6, 0.4],
        [11.4, 2.4],
        [6.8, 4.6],
      ]),
      fill: "line",
      stroke: "line",
      strokeWidth: 0.8,
    },
  ] satisfies SymbolDef,
  parallelMultiInstance: [
    {
      d: "M 1 1 L 3.6 1 L 3.6 13 L 1 13 z",
      fill: "line",
      stroke: "line",
      strokeWidth: 0.8,
    },
    {
      d: "M 5.7 1 L 8.3 1 L 8.3 13 L 5.7 13 z",
      fill: "line",
      stroke: "line",
      strokeWidth: 0.8,
    },
    {
      d: "M 10.4 1 L 13 1 L 13 13 L 10.4 13 z",
      fill: "line",
      stroke: "line",
      strokeWidth: 0.8,
    },
  ] satisfies SymbolDef,
  sequentialMultiInstance: [
    {
      d: "M 1 1 L 13 1 L 13 3.6 L 1 3.6 z",
      fill: "line",
      stroke: "line",
      strokeWidth: 0.8,
    },
    {
      d: "M 1 5.7 L 13 5.7 L 13 8.3 L 1 8.3 z",
      fill: "line",
      stroke: "line",
      strokeWidth: 0.8,
    },
    {
      d: "M 1 10.4 L 13 10.4 L 13 13 L 1 13 z",
      fill: "line",
      stroke: "line",
      strokeWidth: 0.8,
    },
  ] satisfies SymbolDef,
  compensation: [
    {
      d:
        polygonPath([
          [0, 7],
          [6.5, 2.5],
          [6.5, 11.5],
        ]) +
        " " +
        polygonPath([
          [7, 7],
          [13.5, 2.5],
          [13.5, 11.5],
        ]),
      fill: "body",
      stroke: "line",
      strokeWidth: 1.2,
    },
  ] satisfies SymbolDef,
  adHoc: [
    {
      d: path(
        "M",
        1,
        9,
        "C",
        2.6,
        4.4,
        5.4,
        4.4,
        7,
        7,
        "C",
        8.6,
        9.6,
        11.4,
        9.6,
        13,
        5,
        "L",
        13,
        8,
        "C",
        11.4,
        12.6,
        8.6,
        12.6,
        7,
        10,
        "C",
        5.4,
        7.4,
        2.6,
        7.4,
        1,
        12,
        "z",
      ),
      fill: "line",
      stroke: "line",
      strokeWidth: 0.6,
    },
  ] satisfies SymbolDef,
} as const;

/* ------------------------------------------------------------------ *
 * Gateway-Symbole (in einem 20×20-Feld in der Rautenmitte)
 * ------------------------------------------------------------------ */

export const GATEWAY_SYMBOLS = {
  exclusive: [
    {
      d: polygonPath([
        [3.4, 0],
        [10, 6.6],
        [16.6, 0],
        [20, 3.4],
        [13.4, 10],
        [20, 16.6],
        [16.6, 20],
        [10, 13.4],
        [3.4, 20],
        [0, 16.6],
        [6.6, 10],
        [0, 3.4],
      ]),
      fill: "line",
      stroke: "line",
      strokeWidth: 1,
    },
  ] satisfies SymbolDef,
  parallel: [
    {
      d: polygonPath([
        [7.6, 0],
        [12.4, 0],
        [12.4, 7.6],
        [20, 7.6],
        [20, 12.4],
        [12.4, 12.4],
        [12.4, 20],
        [7.6, 20],
        [7.6, 12.4],
        [0, 12.4],
        [0, 7.6],
        [7.6, 7.6],
      ]),
      fill: "line",
      stroke: "line",
      strokeWidth: 1,
    },
  ] satisfies SymbolDef,
  inclusive: [
    {
      d: circleOutline(10, 10, 8.5),
      fill: "none",
      stroke: "line",
      strokeWidth: 3,
    },
  ] satisfies SymbolDef,
  eventBased: [
    {
      d: circleOutline(10, 10, 9.5),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.2,
    },
    {
      d: circleOutline(10, 10, 7.5),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.2,
    },
    {
      d: polygonPath([
        [10, 3.6],
        [15.8, 7.8],
        [13.6, 14.6],
        [6.4, 14.6],
        [4.2, 7.8],
      ]),
      fill: "none",
      stroke: "line",
      strokeWidth: 1.2,
    },
  ] satisfies SymbolDef,
  complex: [
    {
      d:
        polygonPath([
          [8.6, 0],
          [11.4, 0],
          [11.4, 20],
          [8.6, 20],
        ]) +
        " " +
        polygonPath([
          [0, 8.6],
          [20, 8.6],
          [20, 11.4],
          [0, 11.4],
        ]) +
        " " +
        polygonPath([
          [2.9, 1],
          [19, 17.1],
          [17.1, 19],
          [1, 2.9],
        ]) +
        " " +
        polygonPath([
          [17.1, 1],
          [19, 2.9],
          [2.9, 19],
          [1, 17.1],
        ]),
      fill: "line",
      stroke: "line",
      strokeWidth: 0.8,
    },
  ] satisfies SymbolDef,
} as const;

/* ------------------------------------------------------------------ *
 * Zeichnen
 * ------------------------------------------------------------------ */

export interface DrawSymbolOptions {
  /** Zielbereich im Diagrammkoordinatensystem. */
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** Kantenlänge des Quellquadrats (Vorgabe: 20). */
  readonly sourceSize?: number;
  /** Grundfläche des Symbols. */
  readonly body: string;
  /** Kontur und tragende Linien. */
  readonly line: string;
  /** Innenlinien auf der Grundfläche (Kontrastfarbe bei gefüllten Symbolen). */
  readonly detail: string;
  readonly defaultStrokeWidth?: number;
  readonly className?: string;
}

function colorFor(role: SymbolColorRole, options: DrawSymbolOptions): string {
  switch (role) {
    case "body":
      return options.body;
    case "line":
      return options.line;
    case "detail":
      return options.detail;
    default:
      return "none";
  }
}

/**
 * Zeichnet eine Symboldefinition skaliert in die Zielbox.
 *
 * Die Strichstärken werden bewusst *nicht* mitskaliert (`vector-effect` scheidet
 * aus, weil es in Exporten uneinheitlich unterstützt wird) — stattdessen wird
 * die angegebene Strichstärke mit dem Skalierungsfaktor multipliziert, damit
 * kleine Symbole nicht als schwarze Klumpen erscheinen.
 */
export function drawSymbol(
  parent: SVGElement,
  definition: SymbolDef,
  options: DrawSymbolOptions,
): SVGGElement {
  const source = options.sourceSize ?? SYMBOL_BOX;
  const scale = options.size / source;
  const group = svgCreate("g", {
    transform: `translate(${options.x} ${options.y}) scale(${scale})`,
    class: options.className ?? "bpmn-symbol",
  });

  for (const part of definition) {
    const node = svgCreate("path", {
      d: part.d,
      fill: colorFor(part.fill ?? "none", options),
      stroke: colorFor(part.stroke ?? "line", options),
      "stroke-width": part.strokeWidth ?? options.defaultStrokeWidth ?? 1.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    svgAppend(group, node);
  }

  svgAppend(parent, group);
  return group;
}
