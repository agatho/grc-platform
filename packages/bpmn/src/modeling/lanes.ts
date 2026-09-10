/**
 * Lane-Behandlung (Punkt 4 des Auftrags).
 *
 * Warum das ein eigener Baustein ist und nicht eine Zeile im Updater:
 * Lane-Zugehörigkeit steht in BPMN **nicht am Knoten**, sondern als
 * `bpmn:Lane/flowNodeRef` an der Lane — und `flowElements` bleibt dabei
 * unverändert am Prozess. Das ist der Fall, den Plan §2.3.1 und beide
 * Messprotokolle als Musterbeispiel für „zwei Regeln, die sich äußerlich
 * gleich anfühlen und intern gegenläufig sind" nennen:
 *
 *   - Knoten in eine **Lane** ziehen → nur `flowNodeRef` wandert.
 *   - Knoten in einen **SubProcess** ziehen → `flowElements` wandert.
 *
 * Dazu kommt die Schachtelung: bei `childLaneSet` muss der Knoten an der
 * **innersten** Lane hängen, die ihn geometrisch enthält, und an keiner
 * anderen. Der Invariantenprüfer erzwingt beides (`LANE_REF_DUPLICATE`,
 * `LANE_REF_FOREIGN_PROCESS`).
 */

import type { BpmnFactory } from "./BpmnFactory";
import type {
  Bounds,
  BpmnElement,
  BpmnParent,
  BpmnShape,
  ModdleElement,
} from "./types";
import {
  addRef,
  addToContainer,
  asArray,
  boOf,
  is,
  isModdleElement,
  isShapeElement,
  removeRef,
  semanticContainerOf,
} from "./util";

/** Mindesthöhe einer Lane; darunter ist sie nicht mehr beschriftbar. */
export const MIN_LANE_SIZE = 60;
/** Breite der Kopfleiste von Pool und Lane. */
export const LANE_HEADER = 30;

// ---------------------------------------------------------------------------
// Grafische Lane-Struktur
// ---------------------------------------------------------------------------

export function isLaneShape(element: BpmnElement | undefined): boolean {
  return is(boOf(element), "bpmn:Lane");
}

export function isParticipantShape(element: BpmnElement | undefined): boolean {
  return is(boOf(element), "bpmn:Participant");
}

/** Direkte Lane-Kinder eines Elements. */
export function childLanes(parent: BpmnParent | undefined): BpmnShape[] {
  const children = (parent as BpmnShape | undefined)?.children ?? [];
  return children.filter(
    (child): child is BpmnShape => isShapeElement(child) && isLaneShape(child),
  );
}

/** Alle Lanes unterhalb eines Elements, äußere zuerst. */
export function allLanes(parent: BpmnParent | undefined): BpmnShape[] {
  const out: BpmnShape[] = [];
  const visit = (node: BpmnParent | undefined): void => {
    for (const lane of childLanes(node)) {
      out.push(lane);
      visit(lane);
    }
  };
  visit(parent);
  return out;
}

/**
 * Der `bpmn:Participant`- oder Wurzel-Shape, unter dem die Lanes eines
 * Elements hängen.
 */
export function lanesRootOf(
  element: BpmnElement | undefined,
): BpmnParent | undefined {
  let current: BpmnParent | undefined =
    element && isShapeElement(element) && isLaneShape(element)
      ? element.parent
      : ((element as BpmnShape | undefined)?.parent ?? undefined);
  while (current) {
    if (isParticipantShape(current) || current.parent === undefined)
      return current;
    if (!isLaneShape(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function midOf(shape: BpmnShape): { x: number; y: number } {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

function containsPoint(
  bounds: Bounds,
  point: { x: number; y: number },
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Die **innerste** Lane, die `shape` geometrisch enthält — oder `undefined`,
 * wenn der Knoten in keiner Lane liegt.
 *
 * Geometrisch, nicht über `parent`: `diagram-js` hängt Knoten an den
 * Participant, nicht an die Lane (Lanes sind Geschwister der Knoten, keine
 * Container). Genau deshalb muss die Zugehörigkeit gerechnet werden — der
 * Befund, den `access.ts:getLaneOf` beim Lesen schon erzwungen hat.
 */
export function laneFor(
  shape: BpmnShape,
  root: BpmnParent | undefined = lanesRootOf(shape),
): BpmnShape | undefined {
  if (!root) return undefined;
  const point = midOf(shape);
  let found: BpmnShape | undefined;
  const visit = (parent: BpmnParent): void => {
    for (const lane of childLanes(parent)) {
      if (containsPoint(lane, point)) {
        found = lane;
        visit(lane);
      }
    }
  };
  visit(root);
  return found;
}

// ---------------------------------------------------------------------------
// Semantische Lane-Pflege
// ---------------------------------------------------------------------------

/** Alle `bpmn:Lane` eines Prozesses, geschachtelte eingeschlossen. */
export function semanticLanesOf(container: ModdleElement): ModdleElement[] {
  const out: ModdleElement[] = [];
  const visitSet = (laneSet: ModdleElement): void => {
    for (const lane of asArray(laneSet["lanes"])) {
      out.push(lane);
      const child = lane["childLaneSet"];
      if (isModdleElement(child)) visitSet(child);
    }
  };
  for (const laneSet of asArray(container["laneSets"])) visitSet(laneSet);
  return out;
}

/**
 * Hängt einen Knoten auf `flowNodeRef` um: erst aus **jeder** Lane des
 * Prozesses entfernen, dann in die Ziel-Lane eintragen.
 *
 * Das „erst überall entfernen" ist nicht Bequemlichkeit, sondern die
 * Invariante `LANE_REF_DUPLICATE`: ein Knoten, der beim Verschieben in der
 * alten Lane stehen bleibt, ist in zwei Lanes — und das ist genau der Fehler,
 * den man am Bild nicht sieht.
 */
export function reassignLaneRefs(
  container: ModdleElement | undefined,
  nodeBo: ModdleElement,
  targetLaneBo: ModdleElement | undefined,
): Array<() => void> {
  const reverts: Array<() => void> = [];
  if (!container) return reverts;
  for (const lane of semanticLanesOf(container)) {
    if (lane === targetLaneBo) continue;
    if (asArray(lane["flowNodeRef"]).includes(nodeBo)) {
      reverts.push(removeRef(lane, "flowNodeRef", nodeBo));
    }
  }
  if (targetLaneBo) {
    reverts.push(addRef(targetLaneBo, "flowNodeRef", nodeBo));
  }
  return reverts;
}

/** Entfernt einen Knoten aus allen Lanes — beim Löschen des Knotens. */
export function dropLaneRefs(
  container: ModdleElement | undefined,
  nodeBo: ModdleElement,
): Array<() => void> {
  return reassignLaneRefs(container, nodeBo, undefined);
}

/**
 * Der `bpmn:LaneSet`, in dem eine neue Lane unterhalb von `parent` landet.
 * Legt ihn an, falls er fehlt (Prozesse ohne Lanes haben keinen).
 */
export function ensureLaneSet(
  factory: BpmnFactory,
  container: ModdleElement,
  parentLaneBo: ModdleElement | undefined,
  reverts: Array<() => void>,
): ModdleElement {
  if (parentLaneBo) {
    const existing = parentLaneBo["childLaneSet"];
    if (isModdleElement(existing)) return existing;
    const created = factory.create(
      "bpmn:LaneSet",
      {},
      { parent: parentLaneBo },
    );
    const previous = parentLaneBo["childLaneSet"];
    parentLaneBo["childLaneSet"] = created;
    reverts.push(() => {
      parentLaneBo["childLaneSet"] = previous;
    });
    return created;
  }
  const sets = asArray(container["laneSets"]);
  const first = sets[0];
  if (first) return first;
  const created = factory.create("bpmn:LaneSet", {}, { parent: container });
  reverts.push(addToContainer(container, created, "laneSets"));
  return created;
}

/**
 * Alle Knoten des Prozesses, die geometrisch in `laneShape` liegen — die
 * Menge, die nach einem Lane-Umbau neu zugeordnet werden muss.
 */
export function nodesInLane(
  laneShape: BpmnShape,
  root: BpmnParent | undefined = lanesRootOf(laneShape),
): BpmnShape[] {
  if (!root) return [];
  const children = (root as BpmnShape).children ?? [];
  return children.filter((child): child is BpmnShape => {
    if (!isShapeElement(child) || isLaneShape(child)) return false;
    const bo = boOf(child);
    if (!is(bo, "bpmn:FlowNode")) return false;
    return containsPoint(laneShape, midOf(child));
  });
}

/**
 * Der semantische Container (Prozess) hinter einer Lane oder einem
 * Lane-tragenden Element.
 */
export function processOfLaneShape(
  laneShape: BpmnShape,
): ModdleElement | undefined {
  return semanticContainerOf(laneShape.parent);
}

// ---------------------------------------------------------------------------
// Geometrie für Hinzufügen / Teilen / Entfernen
// ---------------------------------------------------------------------------

export type LaneLocation = "top" | "bottom" | "left" | "right";

/** Bounds einer neuen Lane relativ zu einer vorhandenen. */
export function newLaneBounds(
  reference: BpmnShape,
  location: LaneLocation,
  horizontal: boolean,
): Bounds {
  if (horizontal) {
    const height = Math.max(MIN_LANE_SIZE, Math.round(reference.height / 2));
    return location === "top"
      ? {
          x: reference.x,
          y: reference.y - height,
          width: reference.width,
          height,
        }
      : {
          x: reference.x,
          y: reference.y + reference.height,
          width: reference.width,
          height,
        };
  }
  const width = Math.max(MIN_LANE_SIZE, Math.round(reference.width / 2));
  return location === "left"
    ? {
        x: reference.x - width,
        y: reference.y,
        width,
        height: reference.height,
      }
    : {
        x: reference.x + reference.width,
        y: reference.y,
        width,
        height: reference.height,
      };
}

/**
 * Teilt eine Lane in `count` gleich große Kind-Lanes. Liefert die Bounds; die
 * Umsetzung als Kommandofolge macht der `SplitLaneHandler`, damit Undo über
 * den `commandStack` läuft und nicht eigens gebaut werden muss.
 */
export function splitBounds(
  lane: BpmnShape,
  count: number,
  horizontal: boolean,
): Bounds[] {
  const n = Math.max(2, Math.min(count, 8));
  const out: Bounds[] = [];
  if (horizontal) {
    const height = lane.height / n;
    for (let index = 0; index < n; index += 1) {
      out.push({
        x: lane.x + LANE_HEADER,
        y: Math.round(lane.y + index * height),
        width: lane.width - LANE_HEADER,
        height: Math.round(
          index === n - 1
            ? lane.y + lane.height - (lane.y + index * height)
            : height,
        ),
      });
    }
    return out;
  }
  const width = lane.width / n;
  for (let index = 0; index < n; index += 1) {
    out.push({
      x: Math.round(lane.x + index * width),
      y: lane.y + LANE_HEADER,
      width: Math.round(
        index === n - 1
          ? lane.x + lane.width - (lane.x + index * width)
          : width,
      ),
      height: lane.height - LANE_HEADER,
    });
  }
  return out;
}
