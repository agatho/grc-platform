/**
 * Lane hinzufügen, teilen, entfernen — mit Größenanpassung der Geschwister
 * und des Pools (Auftrag Punkt 4).
 *
 * **Entwurfsentscheidung: zusammengesetzte Kommandos statt eigener Inverser.**
 * Jeder dieser Handler tut seine gesamte Arbeit in `preExecute` und ruft dabei
 * nur vorhandene Modellierungsoperationen auf (`createShape`, `resizeShape`,
 * `moveShape`, `removeShape`). Der `commandStack` von `diagram-js` fasst alles,
 * was während eines Kommandos ausgelöst wird, zu **einem** Undo-Schritt
 * zusammen. Damit ist das Inverse eines Lane-Umbaus die Summe der Inversen
 * seiner Teile — und die sind bereits geprüft.
 *
 * Der Preis dafür sind Zwischenzustände, in denen die Geometrie kurz
 * inkonsistent ist (der Pool ist schon größer, die Lanes noch nicht
 * verschoben). Das ist vertretbar, weil kein Zwischenzustand nach außen
 * sichtbar wird: Der Invariantenprüfer läuft nach dem Kommando, und die
 * Invarianten dieser Schicht sind Referenz-, keine Geometrieinvarianten.
 */

import { isHorizontalDi } from "../di.js";
import {
  childLanes,
  isLaneShape,
  isParticipantShape,
  LANE_HEADER,
  MIN_LANE_SIZE,
  type LaneLocation,
} from "../lanes.js";
import type { Bounds, BpmnElement, BpmnParent, BpmnShape } from "../types.js";
import { boOf, is, isShapeElement, participantOf } from "../util.js";

interface ModelingLike {
  createShape(
    shape: Record<string, unknown>,
    position: Bounds | { x: number; y: number },
    target: BpmnParent,
    hints?: Record<string, unknown>,
  ): BpmnShape;
  resizeShape(
    shape: BpmnShape,
    newBounds: Bounds,
    minBounds?: unknown,
    hints?: unknown,
  ): void;
  moveShape(
    shape: BpmnShape,
    delta: { x: number; y: number },
    newParent?: BpmnParent,
  ): void;
  moveElements(
    shapes: BpmnElement[],
    delta: { x: number; y: number },
    target?: BpmnParent,
    hints?: Record<string, unknown>,
  ): void;
  removeShape(shape: BpmnShape): void;
}

function sortByAxis(lanes: BpmnShape[], horizontal: boolean): BpmnShape[] {
  return [...lanes].sort((a, b) => (horizontal ? a.y - b.y : a.x - b.x));
}

/** Pool, unter dem die Lanes eines Elements hängen. */
function poolOf(element: BpmnShape): BpmnShape | undefined {
  if (isParticipantShape(element)) return element;
  return participantOf(element);
}

/** Bewegliche Geschwister: Lanes und Knoten des Pools. */
function movableChildren(pool: BpmnParent): BpmnShape[] {
  const children = (pool as BpmnShape).children ?? [];
  return children.filter((child): child is BpmnShape => isShapeElement(child));
}

// ---------------------------------------------------------------------------
// lane.add
// ---------------------------------------------------------------------------

export interface AddLaneContext {
  shape: BpmnShape;
  location: LaneLocation;
}

export class AddLaneHandler {
  static $inject = ["modeling"];

  constructor(private readonly modeling: ModelingLike) {}

  preExecute(context: AddLaneContext): void {
    const { shape, location } = context;
    const pool = poolOf(shape);
    if (!pool) return;

    const horizontal = isHorizontalDi(pool.di);
    const lanes = sortByAxis(childLanes(pool), horizontal);

    if (lanes.length === 0) {
      // Ein Pool ohne Lanes bekommt zwei auf einmal: eine einzelne Lane, die
      // den ganzen Pool füllt, wäre reines Rauschen im XML.
      addFirstLanes(this.modeling, pool, horizontal, 2);
      return;
    }

    const reference = isLaneShape(shape)
      ? shape
      : location === "top" || location === "left"
        ? lanes[0]
        : lanes[lanes.length - 1];
    if (!reference) return;

    const size = horizontal
      ? Math.max(MIN_LANE_SIZE, Math.round(reference.height))
      : Math.max(MIN_LANE_SIZE, Math.round(reference.width));

    const insertAt =
      location === "top"
        ? reference.y
        : location === "bottom"
          ? reference.y + reference.height
          : location === "left"
            ? reference.x
            : reference.x + reference.width;

    // 1. Pool vergrößern
    this.modeling.resizeShape(pool, {
      x: pool.x,
      y: pool.y,
      width: horizontal ? pool.width : pool.width + size,
      height: horizontal ? pool.height + size : pool.height,
    });

    // 2. alles hinter der Einfügestelle verschieben
    //
    // `moveElements`, nicht `moveShape`: nur das zusammengesetzte Kommando
    // löst `label-support` und `attach-support` aus, die Beschriftungen und
    // Boundary Events mitziehen. Mit `moveShape` bliebe die Beschriftung eines
    // Ereignisses an der alten Stelle stehen — sichtbar, aber leicht zu
    // übersehen, und in der DI dauerhaft falsch.
    const delta = horizontal ? { x: 0, y: size } : { x: size, y: 0 };
    const moving = movableChildren(pool).filter(
      (child) => (horizontal ? child.y : child.x) >= insertAt,
    );
    if (moving.length > 0) {
      this.modeling.moveElements(moving, delta, pool);
    }

    // 3. neue Lane einsetzen
    const bounds: Bounds = horizontal
      ? { x: reference.x, y: insertAt, width: reference.width, height: size }
      : { x: insertAt, y: reference.y, width: size, height: reference.height };
    this.modeling.createShape(
      { type: "bpmn:Lane" },
      bounds,
      (reference.parent ?? pool) as BpmnParent,
    );
  }

  execute(): BpmnElement[] {
    return [];
  }

  revert(): BpmnElement[] {
    return [];
  }
}

/** Legt die ersten `count` Lanes in einen bislang lane-losen Pool. */
function addFirstLanes(
  modeling: ModelingLike,
  pool: BpmnShape,
  horizontal: boolean,
  count: number,
): void {
  const body: Bounds = horizontal
    ? {
        x: pool.x + LANE_HEADER,
        y: pool.y,
        width: pool.width - LANE_HEADER,
        height: pool.height,
      }
    : {
        x: pool.x,
        y: pool.y + LANE_HEADER,
        width: pool.width,
        height: pool.height - LANE_HEADER,
      };
  for (const bounds of sliceBounds(body, count, horizontal)) {
    modeling.createShape({ type: "bpmn:Lane" }, bounds, pool);
  }
}

/** `count` gleich große Streifen über `bounds`, Rundungsrest in den letzten. */
export function sliceBounds(
  bounds: Bounds,
  count: number,
  horizontal: boolean,
): Bounds[] {
  const n = Math.max(1, Math.min(count, 8));
  const out: Bounds[] = [];
  const total = horizontal ? bounds.height : bounds.width;
  const step = Math.floor(total / n);
  for (let index = 0; index < n; index += 1) {
    const offset = index * step;
    const size = index === n - 1 ? total - offset : step;
    out.push(
      horizontal
        ? {
            x: bounds.x,
            y: bounds.y + offset,
            width: bounds.width,
            height: size,
          }
        : {
            x: bounds.x + offset,
            y: bounds.y,
            width: size,
            height: bounds.height,
          },
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// lane.split
// ---------------------------------------------------------------------------

export interface SplitLaneContext {
  shape: BpmnShape;
  count: number;
}

export class SplitLaneHandler {
  static $inject = ["modeling"];

  constructor(private readonly modeling: ModelingLike) {}

  /**
   * Teilt eine Lane (oder einen Pool ohne Lanes) in `count` Streifen.
   *
   * Bei einer Lane bleibt die Lane selbst als **erster** Streifen bestehen und
   * wird verkleinert; die übrigen entstehen neu. Das erhält die ID der
   * bestehenden Lane und damit jeden Verweis darauf — ein Lane-Umbau darf
   * keine Fremdreferenz brechen.
   */
  preExecute(context: SplitLaneContext): void {
    const { shape } = context;
    const count = Math.max(2, Math.min(context.count, 8));
    const pool = poolOf(shape);
    if (!pool) return;
    const horizontal = isHorizontalDi(pool.di);

    if (isParticipantShape(shape)) {
      if (childLanes(shape).length > 0) return;
      addFirstLanes(this.modeling, shape, horizontal, count);
      return;
    }
    if (!isLaneShape(shape)) return;

    const slices = sliceBounds(shape, count, horizontal);
    const first = slices[0];
    if (!first) return;

    this.modeling.resizeShape(shape, first);
    for (const bounds of slices.slice(1)) {
      this.modeling.createShape(
        { type: "bpmn:Lane" },
        bounds,
        (shape.parent ?? pool) as BpmnParent,
      );
    }
  }

  execute(): BpmnElement[] {
    return [];
  }

  revert(): BpmnElement[] {
    return [];
  }
}

// ---------------------------------------------------------------------------
// lane.remove
// ---------------------------------------------------------------------------

export interface RemoveLaneContext {
  shape: BpmnShape;
}

export class RemoveLaneHandler {
  static $inject = ["modeling"];

  constructor(private readonly modeling: ModelingLike) {}

  /**
   * Entfernt eine Lane und schließt die Lücke.
   *
   * Die Knoten, die darin lagen, bleiben — sie gehören dem Prozess, nicht der
   * Lane. Ihr `flowNodeRef` wandert automatisch zur vergrößerten
   * Nachbar-Lane, weil der Updater die Zugehörigkeit nach jeder Größenänderung
   * neu rechnet. Genau dafür ist `syncLaneMembership` auch an `shape.resize`
   * gehängt.
   */
  preExecute(context: RemoveLaneContext): void {
    const lane = context.shape;
    const pool = poolOf(lane);
    if (!pool || !isLaneShape(lane)) return;
    const horizontal = isHorizontalDi(pool.di);
    const parent = (lane.parent ?? pool) as BpmnParent;
    const siblings = sortByAxis(
      childLanes(parent).filter((candidate) => candidate !== lane),
      horizontal,
    );

    this.modeling.removeShape(lane);

    if (siblings.length === 0) {
      // Letzte Lane: der Pool schrumpft um sie.
      this.modeling.resizeShape(pool, {
        x: pool.x,
        y: pool.y,
        width: horizontal
          ? pool.width
          : Math.max(MIN_LANE_SIZE, pool.width - lane.width),
        height: horizontal
          ? Math.max(MIN_LANE_SIZE, pool.height - lane.height)
          : pool.height,
      });
      return;
    }

    // Der Nachbar davor wächst in die Lücke; gibt es keinen, der dahinter.
    const before = siblings
      .filter((candidate) =>
        horizontal ? candidate.y < lane.y : candidate.x < lane.x,
      )
      .pop();
    const grow = before ?? siblings[0];
    if (!grow) return;

    if (before) {
      this.modeling.resizeShape(grow, {
        x: grow.x,
        y: grow.y,
        width: horizontal ? grow.width : grow.width + lane.width,
        height: horizontal ? grow.height + lane.height : grow.height,
      });
    } else {
      this.modeling.resizeShape(grow, {
        x: horizontal ? grow.x : lane.x,
        y: horizontal ? lane.y : grow.y,
        width: horizontal ? grow.width : grow.width + lane.width,
        height: horizontal ? grow.height + lane.height : grow.height,
      });
    }
  }

  execute(): BpmnElement[] {
    return [];
  }

  revert(): BpmnElement[] {
    return [];
  }
}

/** Ist dieses Element eine Lane oder ein Pool, auf dem Lane-Kommandos laufen? */
export function isLaneTarget(element: BpmnElement | undefined): boolean {
  return (
    is(boOf(element), "bpmn:Lane") || is(boOf(element), "bpmn:Participant")
  );
}
