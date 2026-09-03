/**
 * Andockpunkte importierter Kanten — der *logische* Endpunkt hinter dem
 * gezeichneten.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-021] **Warum es diese Datei gibt.**
 *
 * Ein Wegpunkt einer Kante hat zwei Bedeutungen zugleich. Gezeichnet wird der
 * Punkt auf der Kontur der Form (`{x, y}`); gerechnet wird mit dem Punkt, den
 * die Kante *gemeint* hat, bevor sie auf die Kontur gezogen wurde — in
 * `diagram-js` steht der als `waypoint.original` daneben. Jede Neuberechnung
 * einer Kante (`repairConnection`, `getDockingPoint`, `getMovedSourceAnchor`)
 * arbeitet mit `original ?? point`.
 *
 * Aus einer importierten BPMN-DI kommt nur die gezeichnete Hälfte: `di:waypoint`
 * kennt kein `original`. Ohne Ersatz nimmt jede spätere Rechnung den
 * abgeschnittenen Punkt als logischen Anker — und der wandert dann bei jeder
 * Bearbeitung ein Stück weiter auf der Kontur entlang, weil der Punkt auf der
 * Kontur zur Vorlage für den nächsten Punkt auf der Kontur wird.
 *
 * **Gemessen.** `synth-foreign-camunda-extensions`, eine einzige
 * `reparent`-Operation. `FF_1` beginnt am Start-Ereignis (152…188 × 102…138,
 * Mitte 170/120), die DI legt den Punkt auf `(188,120)` — den rechten Rand.
 * Nach dem Verschieben des Ziels nach unten will die Kante das Ereignis nach
 * *unten* verlassen. `getDockingPoint` behält dabei die x-Koordinate des
 * Ankers bei:
 *
 *   - ohne `original`: Anker `(188,120)` → Ausgang `(188,138)` — die untere
 *     **rechte Ecke** der Bounding-Box, also gar nicht auf dem Kreis;
 *   - mit `original` `(170,120)`: Ausgang `(170,138)` — die Unterseite des
 *     Kreises, dort wo eine Kante ein Start-Ereignis verlässt.
 *
 * Die Referenz hat für genau das einen eigenen Baustein
 * (`ImportDockingFix`), ARCTOS hatte ihn nicht. Diese Datei ist die
 * BPMN-unabhängige Rechnung dazu, mit denselben Regeln:
 *
 *  1. `original` ist der Schnittpunkt des ersten Kantensegments mit dem
 *     **Mittelkreuz** der Form (waagerechte bzw. senkrechte Mittellinie);
 *  2. schneidet das Segment beide Mittellinien, gewinnt die *nähere* am
 *     Formmittelpunkt — sonst zöge eine schräg anlaufende Kante ihren Anker
 *     weit aus der Form heraus;
 *  3. schneidet es keine, bleibt der Punkt ohne `original` und die Rechnung
 *     fällt wie bisher auf den gezeichneten Punkt zurück.
 *
 * Wirkung im Vergleichslauf (100 Folgen à 10 Operationen, Seed 13337):
 * `waypoints/bpmn:SequenceFlow/position` 25 → 4,
 * `waypoints/bpmn:MessageFlow/position` 2 → 0.
 */

import type { BpmnConnection, BpmnShape, Point } from "./types";

/** Halbe Länge der Mittellinien, mit denen geschnitten wird. */
const CENTRE_CROSS_REACH = 50;

/**
 * Schnittpunkt zweier Geraden durch die gegebenen Strecken.
 *
 * Die Strecken werden **unendlich** verlängert — gesucht ist der Punkt, an dem
 * die Kante die Mittellinie träfe, auch wenn sie vorher endet. Parallelen
 * liefern `undefined`. Gerundet, weil daraus DI-Koordinaten werden und ein
 * Anker mit sechzehn Nachkommastellen bei jedem Export einen anderen Diff
 * erzeugt.
 */
export function lineIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): Point | undefined {
  const denominator =
    (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);
  if (denominator === 0) return undefined;
  const numerator =
    (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
  const c = numerator / denominator;
  const x = Math.round(a1.x + c * (a2.x - a1.x));
  const y = Math.round(a1.y + c * (a2.y - a1.y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midOf(shape: BpmnShape): Point {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

/** Setzt `original` auf einem Endpunkt, wenn sich einer berechnen lässt. */
function adjustDocking(
  endpoint: Point & { original?: Point },
  next: Point | undefined,
  mid: Point,
): void {
  if (!next) return;
  const vertical = lineIntersect(endpoint, next, mid, {
    x: mid.x,
    y: mid.y - CENTRE_CROSS_REACH,
  });
  const horizontal = lineIntersect(endpoint, next, mid, {
    x: mid.x - CENTRE_CROSS_REACH,
    y: mid.y,
  });

  let centre: Point | undefined;
  if (vertical && horizontal) {
    centre =
      distance(vertical, mid) > distance(horizontal, mid)
        ? horizontal
        : vertical;
  } else {
    centre = vertical ?? horizontal;
  }
  if (centre) endpoint.original = centre;
}

/**
 * Ergänzt die logischen Andockpunkte einer frisch importierten Kante.
 *
 * Idempotent und nicht überschreibend: ein Endpunkt, der bereits ein
 * `original` trägt, bleibt unangetastet — der Wert ist dann aus einer echten
 * Rechnung entstanden und besser als jede Rekonstruktion.
 */
export function fixImportDockings(connection: BpmnConnection): void {
  const waypoints = connection.waypoints as (Point & { original?: Point })[];
  if (!Array.isArray(waypoints) || waypoints.length < 2) return;
  const source = connection.source as BpmnShape | undefined;
  const target = connection.target as BpmnShape | undefined;

  const first = waypoints[0];
  if (first && !first.original && isSized(source)) {
    adjustDocking(first, waypoints[1], midOf(source));
  }
  const last = waypoints[waypoints.length - 1];
  if (last && !last.original && isSized(target)) {
    adjustDocking(last, waypoints[waypoints.length - 2], midOf(target));
  }
}

/** Nur Formen mit Geometrie haben einen Mittelpunkt; Wurzeln haben keine. */
function isSized(shape: BpmnShape | undefined): shape is BpmnShape {
  return (
    !!shape &&
    Number.isFinite(shape.x) &&
    Number.isFinite(shape.y) &&
    Number.isFinite(shape.width) &&
    Number.isFinite(shape.height)
  );
}
