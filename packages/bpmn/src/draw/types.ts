/// <reference lib="dom" />

/**
 * Strukturelle Typen für die Zeichenschicht.
 *
 * Bewusst *strukturell* und nicht aus `bpmn-moddle` importiert: die Modellschicht
 * (`src/model`) liefert moddle-Objekte, aber die Zeichenschicht braucht davon nur
 * `$type` und ein paar Attribute. So bleibt `draw/` ohne Abhängigkeit zur
 * Modellschicht testbar und serverseitig verwendbar.
 */

/** Ein Objekt aus dem moddle-Baum (`bpmn:Task`, `bpmndi:BPMNShape`, …). */
export interface ModdleElement {
  readonly $type: string;
  readonly id?: string;
  readonly name?: string;
  readonly [key: string]: unknown;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Ein zeichenbarer Knoten. Kompatibel zu `diagram-js`' `ShapeLike`, aber mit den
 * BPMN-Feldern, auf die der Renderer sich verlässt.
 */
export interface BpmnShape extends Bounds {
  readonly id: string;
  /** `bpmn:Task`, `bpmn:StartEvent`, … oder der Pseudotyp `label`. */
  readonly type: string;
  readonly businessObject: ModdleElement;
  /** Das zugehörige `bpmndi:BPMNShape`, falls vorhanden. */
  readonly di?: ModdleElement;
  /** Nur bei `type === "label"`: das beschriftete Element. */
  readonly labelTarget?: BpmnShape | BpmnConnection;
  /** Pool/Lane werden als Rahmen gezeichnet (Füllung klickdurchlässig). */
  readonly isFrame?: boolean;
  readonly hidden?: boolean;
}

export interface BpmnConnection {
  readonly id: string;
  readonly type: string;
  readonly waypoints: readonly Point[];
  readonly businessObject: ModdleElement;
  readonly di?: ModdleElement;
  readonly source?: BpmnShape;
  readonly target?: BpmnShape;
  readonly hidden?: boolean;
}

export type BpmnElement = BpmnShape | BpmnConnection;

export function isConnection(element: BpmnElement): element is BpmnConnection {
  return Array.isArray((element as BpmnConnection).waypoints);
}

/** Optionen, die der Renderer beim Bootstrap entgegennimmt. */
export interface BpmnRendererConfig {
  /** Schriftfamilie für alle Beschriftungen. */
  readonly fontFamily?: string;
  /** Grundschriftgröße in px. */
  readonly fontSize?: number;
  /** Zeichnet zusätzlich `role`/`aria-label` auf die Visuals (Standard: an). */
  readonly accessible?: boolean;
  /** Kontrastvariante — `more` verzichtet auf Füllungen. */
  readonly contrast?: "normal" | "more";
}
