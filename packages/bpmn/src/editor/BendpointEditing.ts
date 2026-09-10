/// <reference lib="dom" />

/**
 * Stützpunkte einer Kante setzen, verschieben, entfernen.
 *
 * `diagram-js` liefert `features/bendpoints` — die Griffe, das Ziehen, das
 * Verschieben eines ganzen Segments und das Einrasten. Das wird benutzt, nicht
 * nachgebaut (Plan §2.2). Was hier entsteht, ist die **wertbasierte**
 * Entsprechung derselben Handlungen: dieselben Änderungen, ausgelöst ohne
 * Zeigegerät und ohne Ziehvorgang.
 *
 * Begriffe, weil sie leicht durcheinandergehen: `waypoints` enthält **auch**
 * die beiden Andockpunkte an Quelle und Ziel. Ein *Stützpunkt* ist ein
 * Wegpunkt dazwischen. Alle Indizes dieser Klasse zählen Stützpunkte, nicht
 * Wegpunkte — sonst müsste jeder Aufrufer den Versatz um eins selbst
 * mitrechnen, und genau dort entstehen die Kanten, deren Andockpunkt
 * versehentlich mitten im Nichts landet.
 *
 * Die Andockpunkte bleiben deshalb unantastbar: Sie werden vom Layouter und
 * vom `CroppingConnectionDocking` gesetzt und gehören der Modellierungsschicht.
 */

import type { EditorAnnouncer } from "./announce";
import { describe } from "./ElementCreation";
import type { BpmnConnection, ModelingLike, Point, RulesLike } from "./types";

export class BendpointEditing {
  static $inject = ["modeling", "rules", "editorAnnouncer"];

  constructor(
    private readonly modeling: ModelingLike,
    private readonly rules: RulesLike,
    private readonly announcer: EditorAnnouncer,
  ) {}

  /** Anzahl der Stützpunkte (ohne die beiden Andockpunkte). */
  count(connection: BpmnConnection): number {
    return Math.max(0, connection.waypoints.length - 2);
  }

  /** Die Stützpunkte als Kopie. */
  bendpoints(connection: BpmnConnection): Point[] {
    return connection.waypoints.slice(1, -1).map((point) => ({ ...point }));
  }

  /**
   * Setzt einen Stützpunkt in die Mitte eines Segments.
   *
   * `segment` zählt die Strecken zwischen den Wegpunkten (0 = die erste, vom
   * Andockpunkt der Quelle aus). Ohne Angabe wird die **längste** Strecke
   * geteilt — das ist die, bei der ein Stützpunkt am ehesten gemeint ist.
   *
   * Rückgabe ist der Index des neuen Stützpunkts, oder `-1`, wenn nichts ging.
   */
  add(connection: BpmnConnection, segment?: number): number {
    if (!this.allowed(connection)) return -1;
    const waypoints = connection.waypoints;
    if (waypoints.length < 2) {
      this.announcer.reject("Diese Kante hat keine Geometrie.");
      return -1;
    }
    const index = segment ?? longestSegment(waypoints);
    const from = waypoints[index];
    const to = waypoints[index + 1];
    if (!from || !to) {
      this.announcer.reject("Diese Strecke gibt es an der Kante nicht.");
      return -1;
    }
    const next = waypoints.map((point) => ({ x: point.x, y: point.y }));
    next.splice(index + 1, 0, {
      x: Math.round((from.x + to.x) / 2),
      y: Math.round((from.y + to.y) / 2),
    });
    this.modeling.updateWaypoints(connection, next);
    const bendpointIndex = index; // Wegpunkt index+1 ⇒ Stützpunkt index
    this.announcer.announce(
      `Stützpunkt ${String(bendpointIndex + 1)} von ${String(this.count(connection))} an ${describe(connection)} gesetzt.`,
    );
    return bendpointIndex;
  }

  /** Verschiebt den Stützpunkt `index` um `delta`. */
  move(connection: BpmnConnection, index: number, delta: Point): boolean {
    if (!this.allowed(connection)) return false;
    const waypoints = connection.waypoints;
    const target = waypoints[index + 1];
    if (!target || index < 0 || index >= this.count(connection)) {
      this.announcer.reject("Diesen Stützpunkt gibt es an der Kante nicht.");
      return false;
    }
    const next = waypoints.map((point, position) =>
      position === index + 1
        ? { x: point.x + delta.x, y: point.y + delta.y }
        : { x: point.x, y: point.y },
    );
    this.modeling.updateWaypoints(connection, next);
    const moved = next[index + 1];
    this.announcer.announce(
      `Stützpunkt ${String(index + 1)} verschoben auf ${String(Math.round(moved?.x ?? 0))}, ${String(Math.round(moved?.y ?? 0))}.`,
    );
    return true;
  }

  /** Entfernt den Stützpunkt `index`. */
  remove(connection: BpmnConnection, index: number): boolean {
    if (!this.allowed(connection)) return false;
    if (index < 0 || index >= this.count(connection)) {
      this.announcer.reject("Diesen Stützpunkt gibt es an der Kante nicht.");
      return false;
    }
    const next = connection.waypoints
      .map((point) => ({ x: point.x, y: point.y }))
      .filter((_, position) => position !== index + 1);
    this.modeling.updateWaypoints(connection, next);
    this.announcer.announce(
      `Stützpunkt ${String(index + 1)} entfernt. ${remaining(this.count(connection))}.`,
    );
    return true;
  }

  /**
   * Fragt die Regeln. `connection.updateWaypoints` ist in `src/modeling`
   * pauschal erlaubt — gefragt wird trotzdem, damit eine spätere Einschränkung
   * (etwa: an einer erzeugten Kante nichts von Hand verschieben) hier
   * automatisch greift.
   */
  private allowed(connection: BpmnConnection): boolean {
    const result = this.rules.allowed("connection.updateWaypoints", {
      connection,
    });
    if (result === false || result === null || result === undefined) {
      this.announcer.reject(
        `Die Geometrie von ${describe(connection)} lässt sich nicht ändern.`,
      );
      return false;
    }
    return true;
  }
}

export default BendpointEditing;

function longestSegment(waypoints: readonly Point[]): number {
  let best = 0;
  let bestLength = -1;
  for (let index = 0; index + 1 < waypoints.length; index += 1) {
    const from = waypoints[index];
    const to = waypoints[index + 1];
    if (!from || !to) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length > bestLength) {
      bestLength = length;
      best = index;
    }
  }
  return best;
}

function remaining(count: number): string {
  if (count === 0) return "Keine Stützpunkte mehr";
  if (count === 1) return "Noch ein Stützpunkt";
  return `Noch ${String(count)} Stützpunkte`;
}
