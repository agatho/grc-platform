/**
 * Darstellungstoken der BPMN-Formensprache.
 *
 * Alle Strichstärken und Größen stammen aus der BPMN-2.0-Notation (OMG
 * formal/2013-12-09, Kapitel 10 „BPMN Notation and Diagrams"), nicht aus einer
 * fremden Implementierung:
 *
 * - Aktivität: Rechteck mit abgerundeten Ecken, *dünner* Rand
 * - CallActivity: Aktivitätsrechteck mit *dickem* Rand
 * - Transaktion: doppelter dünner Rand
 * - Startereignis: Kreis, dünner Rand
 * - Zwischenereignis: Doppelkreis, dünne Ränder
 * - Endereignis: Kreis, *dicker* Rand
 * - Ereignis-Subprozess-Start / nicht unterbrechendes Ereignis: gestrichelt
 * - Gateway: Raute, dünner Rand
 */

export const STROKE_THIN = 2;
export const STROKE_THICK = 4;
/** Kontur der Symbole innerhalb von Ereignissen/Gateways. */
export const STROKE_SYMBOL = 1.5;

/** Kanonische Standardgrößen (BPMN-DI liefert meist genau diese). */
export const SIZE = {
  event: { width: 36, height: 36 },
  gateway: { width: 50, height: 50 },
  task: { width: 100, height: 80 },
  subProcessExpanded: { width: 350, height: 200 },
  dataObject: { width: 36, height: 50 },
  dataStore: { width: 50, height: 50 },
  participant: { width: 600, height: 250 },
  lane: { width: 570, height: 120 },
  textAnnotation: { width: 100, height: 30 },
  group: { width: 300, height: 300 },
} as const;

/** Höhe der Kopfleiste von Pools und Lanes. */
export const LANE_HEADER = 30;
/** Eckenradius der Aktivitätsrechtecke. */
export const ACTIVITY_RADIUS = 10;
/** Innenabstand von Beschriftungen. */
export const LABEL_PADDING = 5;

export interface Palette {
  readonly stroke: string;
  readonly fill: string;
  readonly text: string;
  readonly canvas: string;
  /** Füllung geworfener Ereignissymbole. */
  readonly symbolSolid: string;
  /** Füllung gefangener Ereignissymbole. */
  readonly symbolHollow: string;
  readonly groupStroke: string;
  readonly laneFill: string;
}

export const DEFAULT_PALETTE: Palette = {
  stroke: "#12181f",
  fill: "#ffffff",
  text: "#12181f",
  canvas: "#ffffff",
  symbolSolid: "#12181f",
  symbolHollow: "#ffffff",
  groupStroke: "#5b6673",
  laneFill: "#ffffff",
};

/**
 * Variante für `prefers-contrast: more` (§4.4 Regel 7): keine Flächen, nur
 * Konturen. Die Formensprache bleibt identisch, damit die Elemente in beiden
 * Varianten dieselben Merkmale tragen.
 */
export const HIGH_CONTRAST_PALETTE: Palette = {
  stroke: "#000000",
  fill: "#ffffff",
  text: "#000000",
  canvas: "#ffffff",
  symbolSolid: "#000000",
  symbolHollow: "#ffffff",
  groupStroke: "#000000",
  laneFill: "#ffffff",
};

export const DEFAULT_FONT_FAMILY =
  'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", sans-serif';
export const DEFAULT_FONT_SIZE = 12;
export const LINE_HEIGHT_FACTOR = 1.2;

/** Strichmuster für gestrichelte Ränder (nicht unterbrechende Ereignisse). */
export const DASH_EVENT = "6,4";
/** Strichmuster für Assoziationen und Textannotationen. */
export const DASH_ASSOCIATION = "0.5,5";
/** Strichmuster für Message Flows. */
export const DASH_MESSAGE_FLOW = "10,7";
/** Strichmuster für Gruppen. */
export const DASH_GROUP = "10,6,0.5,6";
