/**
 * `BpmnLayouter` — Kantenführung (Auftrag Punkt 6).
 *
 * Der Auftrag ist hier ausdrücklich, zu **nutzen** statt nachzubauen:
 * `diagram-js` bringt Manhattan-Routing (`layout/ManhattanLayout`) und das
 * Abschneiden an der Formgrenze (`layout/CroppingConnectionDocking`) fertig
 * mit. Beide Messprotokolle stufen Flow-Routing als den kleinsten der vier
 * Posten ein — „und den einzigen, bei dem man das Ergebnis sieht".
 *
 * BPMN-spezifisch ist nur, **welche Andockseiten** eine Kantenart bevorzugt:
 *
 *  - Sequenzflüsse laufen waagerecht (`h:h`) — Prozesse werden von links nach
 *    rechts gelesen;
 *  - Kanten **aus einem Boundary Event** verlassen es senkrecht nach unten und
 *    biegen dann ab, weil sie sonst durch ihren eigenen Wirt liefen;
 *  - Nachrichtenflüsse zwischen Pools laufen senkrecht (`v:v`) — sie kreuzen
 *    die Poolgrenze und sollen sie im rechten Winkel schneiden;
 *  - Assoziationen zu Textannotationen bleiben gerade.
 */

import BaseLayouter from "diagram-js/lib/layout/BaseLayouter.js";
import {
  repairConnection,
  withoutRedundantPoints,
} from "diagram-js/lib/layout/ManhattanLayout.js";
import { getMid } from "diagram-js/lib/layout/LayoutUtil.js";
import type { BpmnConnection, BpmnElement, BpmnShape, Point } from "./types.js";
import { boOf, is } from "./util.js";

export interface LayoutHints {
  connectionStart?: Point;
  connectionEnd?: Point;
  source?: BpmnElement;
  target?: BpmnElement;
  waypoints?: Point[];
  preferredLayouts?: string[];
  [key: string]: unknown;
}

/** Auf welcher Seite des Wirts sitzt ein Boundary Event? */
export function attachOrientation(
  boundary: BpmnShape,
  host: BpmnShape,
): "top" | "bottom" | "left" | "right" {
  const bx = boundary.x + boundary.width / 2;
  const by = boundary.y + boundary.height / 2;
  const distances = {
    left: Math.abs(bx - host.x),
    right: Math.abs(bx - (host.x + host.width)),
    top: Math.abs(by - host.y),
    bottom: Math.abs(by - (host.y + host.height)),
  };
  let best: "top" | "bottom" | "left" | "right" = "bottom";
  let bestValue = Number.POSITIVE_INFINITY;
  for (const side of ["top", "bottom", "left", "right"] as const) {
    if (distances[side] < bestValue) {
      bestValue = distances[side];
      best = side;
    }
  }
  return best;
}

/**
 * Bevorzugte Layouts für eine Kante — die einzige wirklich BPMN-spezifische
 * Entscheidung dieses Bausteins.
 */
export function preferredLayouts(connection: BpmnConnection): string[] {
  const bo = boOf(connection);
  const source = connection.source as BpmnShape | undefined;
  const sourceBo = boOf(source);

  if (
    is(bo, "bpmn:Association") ||
    is(bo, "bpmn:DataInputAssociation") ||
    is(bo, "bpmn:DataOutputAssociation")
  ) {
    return ["straight"];
  }

  if (is(bo, "bpmn:MessageFlow")) {
    return ["straight", "v:v"];
  }

  if (is(sourceBo, "bpmn:BoundaryEvent") && source) {
    const host = source.host;
    if (host) {
      const side = attachOrientation(source, host);
      // Nach unten/oben heraus und dann waagerecht weiter — sonst schneidet
      // die Kante die Aktivität, an der sie hängt.
      if (side === "top") return ["v:h"];
      if (side === "bottom") return ["v:h"];
      return ["h:h"];
    }
    return ["v:h"];
  }

  return ["straight", "h:h"];
}

/** Ein Hint-Wert, der wirklich ein Punkt ist — `false` und `undefined` nicht. */
function asPoint(value: unknown): Point | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const point = value as { x?: unknown; y?: unknown };
  if (typeof point.x !== "number" || typeof point.y !== "number")
    return undefined;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
  return { x: point.x, y: point.y };
}

export class BpmnLayouter extends BaseLayouter {
  override layoutConnection(
    connection: BpmnConnection,
    hints: LayoutHints = {},
  ): Point[] {
    const source = (hints.source ?? connection.source) as BpmnShape | undefined;
    const target = (hints.target ?? connection.target) as BpmnShape | undefined;

    if (!source || !target) {
      return connection.waypoints.length >= 2
        ? connection.waypoints
        : [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ];
    }

    // **`??` genügt hier nicht.** `MoveHelper` aus `diagram-js` übergibt
    // `connectionStart: sourceMoved && getMovedSourceAnchor(...)` — bei einem
    // nicht mitbewegten Endpunkt steht dort also `false`, nicht `undefined`.
    // Mit `??` liefe dieses `false` als Startpunkt durch und die Kante bekäme
    // `NaN`-Wegpunkte. Das trifft genau den Fall „ein Pool wird umgebaut,
    // während ein Nachrichtenfluss in den anderen Pool zeigt".
    const start = asPoint(hints.connectionStart) ?? (getMid(source) as Point);
    const end = asPoint(hints.connectionEnd) ?? (getMid(target) as Point);
    const waypoints = Array.isArray(hints.waypoints)
      ? hints.waypoints
      : connection.waypoints;

    const repaired = repairConnection(
      source as never,
      target as never,
      start as never,
      end as never,
      waypoints as never,
      {
        ...hints,
        preferredLayouts:
          hints.preferredLayouts ?? preferredLayouts(connection),
      } as never,
    ) as Point[];

    const cleaned = withoutRedundantPoints(repaired as never) as Point[];
    // Letzte Sicherung: eine Kante mit `NaN` ist im Bild unsichtbar, in der
    // DI aber dauerhaft — und `dc:Point/@x="NaN"` liest kein Fremdwerkzeug.
    // Lieber die Mitten verbinden als etwas Unbrauchbares schreiben.
    if (cleaned.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      return [getMid(source) as Point, getMid(target) as Point];
    }
    return cleaned;
  }
}

export default BpmnLayouter;
