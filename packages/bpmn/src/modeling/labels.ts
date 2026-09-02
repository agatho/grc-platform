/**
 * Externe Beschriftungen (Punkt 7 des Auftrags).
 *
 * Ereignisse, Gateways und Datenobjekte tragen ihren Namen **außerhalb** der
 * Form, Kanten in der Mitte. Im Modell ist das kein eigenes Element: es gibt
 * nur `bo.name` und optional `BPMNShape/BPMNEdge → label → bounds`. In
 * `diagram-js` dagegen ist es ein eigenes Shape mit `labelTarget`, damit man
 * es anfassen, verschieben und mit dem Element löschen kann.
 *
 * Die Messung des Renderer-Strangs hat dazu einen harten Befund geliefert: der
 * Korpus zeigt, dass fremde Werkzeuge `BPMNLabel/bounds` unzuverlässig
 * pflegen. Daraus folgt die Regel dieser Datei — **robust lesen, sauber
 * schreiben**: fehlt die Box, wird eine berechnet; ist sie da, wird sie
 * respektiert; sobald der Benutzer die Beschriftung anfasst, wird sie
 * geschrieben.
 */

import type { BpmnFactory } from "./BpmnFactory.js";
import { boundsOf, labelBoundsOf } from "./di.js";
import type {
  Bounds,
  BpmnConnection,
  BpmnElement,
  BpmnShape,
  ModdleElement,
  Point,
} from "./types.js";
import {
  boOf,
  is,
  isAny,
  isConnectionElement,
  isModdleElement,
} from "./util.js";

export const DEFAULT_LABEL_WIDTH = 90;
export const DEFAULT_LABEL_HEIGHT = 20;
/** Abstand zwischen Form und Beschriftung. */
export const LABEL_GAP = 7;

/** Trägt dieser Typ seine Beschriftung außerhalb der Form? */
export function hasExternalLabel(bo: ModdleElement | undefined): boolean {
  return (
    isAny(bo, [
      "bpmn:Event",
      "bpmn:Gateway",
      "bpmn:DataObjectReference",
      "bpmn:DataStoreReference",
      "bpmn:SequenceFlow",
      "bpmn:MessageFlow",
      "bpmn:Group",
    ]) && !is(bo, "bpmn:TextAnnotation")
  );
}

export function labelText(bo: ModdleElement | undefined): string {
  if (!bo) return "";
  if (is(bo, "bpmn:TextAnnotation")) {
    return typeof bo["text"] === "string" ? bo["text"] : "";
  }
  if (is(bo, "bpmn:Group")) {
    const category = bo["categoryValueRef"];
    if (isModdleElement(category) && typeof category["value"] === "string") {
      return category["value"];
    }
    return "";
  }
  return typeof bo["name"] === "string" ? bo["name"] : "";
}

function midOfWaypoints(waypoints: readonly Point[]): Point {
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (waypoints.length === 2) {
    const [a, b] = waypoints;
    if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const index = Math.floor(waypoints.length / 2);
  return waypoints[index] ?? waypoints[0] ?? { x: 0, y: 0 };
}

/**
 * Wo die Beschriftung eines Elements hingehört, wenn nichts anderes bekannt
 * ist: unter der Form, mittig; an der Kante über ihrer Mitte.
 */
export function defaultLabelBounds(element: BpmnElement): Bounds {
  if (isConnectionElement(element)) {
    const mid = midOfWaypoints(element.waypoints);
    return {
      x: mid.x - DEFAULT_LABEL_WIDTH / 2,
      y: mid.y - DEFAULT_LABEL_HEIGHT - LABEL_GAP / 2,
      width: DEFAULT_LABEL_WIDTH,
      height: DEFAULT_LABEL_HEIGHT,
    };
  }
  const shape = element as BpmnShape;
  return {
    x: shape.x + shape.width / 2 - DEFAULT_LABEL_WIDTH / 2,
    y: shape.y + shape.height + LABEL_GAP,
    width: DEFAULT_LABEL_WIDTH,
    height: DEFAULT_LABEL_HEIGHT,
  };
}

/**
 * Die Beschriftungsbox aus der DI, sonst die berechnete.
 *
 * Reihenfolge ist bewusst so: eine vorhandene Box eines Fremdwerkzeugs wird
 * **nie** überschrieben, nur ergänzt. Sonst verschöbe schon das Öffnen einer
 * fremden Datei jede Beschriftung und erzeugte einen Diff über das ganze
 * Diagramm.
 */
export function externalLabelBounds(
  element: BpmnElement,
  di: ModdleElement | undefined,
): Bounds {
  const stored = di ? labelBoundsOf(di) : undefined;
  if (stored && stored.width > 0 && stored.height > 0) return stored;

  const fallback = defaultLabelBounds(element);
  // Box **ohne Maße** kommt im Korpus vor: `dc:Bounds` mit x und y, aber ohne
  // width/height. `boundsOf` liefert dafür nichts, weil es alle vier Werte
  // verlangt. Die Position ist trotzdem die Angabe des Autors und wird
  // übernommen; nur die Maße werden ergänzt.
  const partial = di ? partialLabelPosition(di) : undefined;
  if (partial) {
    return {
      x: partial.x ?? fallback.x,
      y: partial.y ?? fallback.y,
      width: fallback.width,
      height: fallback.height,
    };
  }
  return fallback;
}

/** x/y einer `BPMNLabel`-Box, auch wenn width/height fehlen. */
function partialLabelPosition(
  di: ModdleElement,
): { x?: number; y?: number } | undefined {
  const label = di["label"];
  if (!isModdleElement(label)) return undefined;
  const bounds = label["bounds"];
  if (!isModdleElement(bounds)) return undefined;
  const x = Number(bounds["x"]);
  const y = Number(bounds["y"]);
  return {
    ...(Number.isFinite(x) ? { x } : {}),
    ...(Number.isFinite(y) ? { y } : {}),
  };
}

/**
 * Schreibt die Beschriftungsbox in die DI zurück und liefert den Rückweg.
 * Wird aufgerufen, wenn der Benutzer die Beschriftung verschiebt oder das
 * Element mit ihr wandert.
 */
export function writeLabelBounds(
  factory: BpmnFactory,
  di: ModdleElement,
  bounds: Bounds,
): () => void {
  const existing = di["label"];
  if (isModdleElement(existing)) {
    const inner = existing["bounds"];
    if (isModdleElement(inner)) {
      return factory.setBounds(existing, bounds);
    }
    const previous = existing["bounds"];
    existing["bounds"] = factory.createBounds(bounds, existing);
    return () => {
      existing["bounds"] = previous;
    };
  }
  const created = factory.createDiLabel(bounds, di);
  di["label"] = created;
  return () => {
    delete di["label"];
  };
}

/** Entfernt die Beschriftungsbox aus der DI (Beschriftung gelöscht). */
export function clearLabelBounds(di: ModdleElement): () => void {
  const previous = di["label"];
  if (previous === undefined) return () => undefined;
  delete di["label"];
  return () => {
    di["label"] = previous;
  };
}

/**
 * Soll für dieses Element ein Beschriftungs-Shape existieren?
 * Nur bei nicht-leerem Text — eine leere Beschriftung ist kein Element,
 * sondern nichts. (Anders als in `bpmn-js`, wo leere Labels als unsichtbare
 * Shapes weiterleben und beim Export Geisterboxen hinterlassen.)
 */
export function needsLabelShape(element: BpmnElement): boolean {
  const bo = boOf(element);
  return hasExternalLabel(bo) && labelText(bo).trim() !== "";
}

/** Die Verschiebung, die eine Beschriftung beim Bewegen ihres Ziels mitmacht. */
export function labelDelta(
  oldBounds: Bounds | undefined,
  newBounds: Bounds | undefined,
): Point {
  if (!oldBounds || !newBounds) return { x: 0, y: 0 };
  return {
    x: newBounds.x + newBounds.width / 2 - (oldBounds.x + oldBounds.width / 2),
    y:
      newBounds.y + newBounds.height / 2 - (oldBounds.y + oldBounds.height / 2),
  };
}

/** Bounds eines DI-Eintrags — für die Delta-Rechnung beim Mitbewegen. */
export function diBounds(di: ModdleElement | undefined): Bounds | undefined {
  return di ? boundsOf(di) : undefined;
}

/** Beschriftungs-Shapes eines Elements. */
export function labelsOf(element: BpmnElement): BpmnShape[] {
  return Array.isArray(element.labels) ? element.labels : [];
}

/** Der Mittelpunkt, an dem eine neue Beschriftung für eine Kante sitzt. */
export function connectionLabelPosition(connection: BpmnConnection): Point {
  return midOfWaypoints(connection.waypoints);
}
