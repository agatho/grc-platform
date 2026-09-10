/**
 * Types der Modellierungsschicht.
 *
 * Die Schicht hält **drei Bäume** synchron (Plan §2.3.1):
 *
 *   1. das *semantische* Modell — `bpmn:Process/flowElements`, `sourceRef`,
 *      `incoming`/`outgoing`, `flowNodeRef`, `attachedToRef`;
 *   2. die *DI* — `bpmndi:BPMNPlane` mit `BPMNShape`/`BPMNEdge` und deren
 *      `bpmnElement`-Rückverweisen;
 *   3. das *grafische* Modell von `diagram-js` — `elementRegistry`, Bounds,
 *      Waypoints, `parent`/`children`, `host`/`attachers`.
 *
 * Die Typen hier sind bewusst **strukturell** gehalten und nicht aus
 * `diagram-js` importiert: die Laufzeitobjekte kommen von dort, aber jede
 * Funktion dieser Schicht soll auch über einem handgebauten Testobjekt
 * prüfbar sein. Wo `diagram-js` echte Klassen liefert, sind die Typen hier
 * eine Obermenge — Zuweisung in beide Richtungen ist gewollt.
 */

import type { ModdleElement } from "bpmn-moddle";

export type { ModdleElement };

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Gemeinsame Felder aller grafischen Elemente. */
export interface BpmnElementBase {
  id: string;
  /** `bpmn:Task`, `bpmn:SequenceFlow`, `label`, … */
  type?: string;
  /** Das semantische Gegenstück. Pflicht — Baum 1 ↔ Baum 3. */
  businessObject: ModdleElement;
  /** Das zugehörige `bpmndi:BPMNShape` / `bpmndi:BPMNEdge`. Baum 2 ↔ Baum 3. */
  di?: ModdleElement;
  parent?: BpmnParent | undefined;
  incoming: BpmnConnection[];
  outgoing: BpmnConnection[];
  labels: BpmnShape[];
  label?: BpmnShape | undefined;
  [key: string]: unknown;
}

export interface BpmnShape extends BpmnElementBase, Bounds {
  children: BpmnElement[];
  attachers: BpmnShape[];
  host?: BpmnShape | undefined;
  /** Nur an Beschriftungs-Shapes gesetzt. */
  labelTarget?: BpmnElement | undefined;
  isFrame?: boolean | undefined;
  collapsed?: boolean | undefined;
  hidden?: boolean | undefined;
}

export interface BpmnConnection extends BpmnElementBase {
  waypoints: Point[];
  source?: BpmnElement | undefined;
  target?: BpmnElement | undefined;
}

export interface BpmnRoot extends BpmnElementBase {
  children: BpmnElement[];
  isImplicit?: boolean | undefined;
}

export type BpmnParent = BpmnShape | BpmnRoot;
export type BpmnElement = BpmnShape | BpmnConnection | BpmnRoot;

export function isConnectionElement(
  element: BpmnElement | undefined,
): element is BpmnConnection {
  return (
    element !== undefined &&
    Array.isArray((element as BpmnConnection).waypoints)
  );
}

export function isShapeElement(
  element: BpmnElement | undefined,
): element is BpmnShape {
  return (
    element !== undefined &&
    !isConnectionElement(element) &&
    typeof (element as BpmnShape).width === "number"
  );
}

export function isLabelElement(element: BpmnElement | undefined): boolean {
  return (
    element !== undefined &&
    (element as BpmnShape).labelTarget !== undefined &&
    (element as BpmnShape).labelTarget !== null
  );
}

/** Was die Schicht von `elementRegistry` braucht — nicht mehr. */
export interface ElementRegistryLike {
  get(id: string): unknown;
  getAll(): unknown[];
}

/** Was die Schicht von `canvas` braucht. */
export interface CanvasLike {
  getRootElement(): unknown;
  getRootElements?: () => unknown[];
}

/** Hints, die `diagram-js` durch die Kommandos reicht. */
export interface ModelingHints {
  [key: string]: unknown;
}
