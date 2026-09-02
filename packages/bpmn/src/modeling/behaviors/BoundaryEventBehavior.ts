/**
 * Boundary-Attachment (Auftrag Punkt 5).
 *
 * Was `diagram-js` mitbringt (`features/attach-support`):
 *  - Anhefter werden mit dem Wirt verschoben,
 *  - Anhefter werden beim Löschen des Wirts mitgelöscht,
 *  - beim Verkleinern des Wirts werden sie mitverschoben.
 *
 * Was fehlt und hier entsteht:
 *  1. **Auf dem Rand bleiben.** `attach-support` verschiebt Anhefter um dasselbe
 *     Delta wie den Wirt. Wird der Wirt *verkleinert*, sitzt das Ereignis
 *     danach im Inneren oder außerhalb. Ein Boundary Event, das nicht auf der
 *     Kante sitzt, ist notationsfalsch — und, anders als die meisten Fehler
 *     dieser Schicht, sichtbar.
 *  2. **Typwechsel beim Anheften.** Ein Zwischen-Ereignis, das an eine
 *     Aktivität gezogen wird, wird semantisch zu einem `bpmn:BoundaryEvent`.
 *     Umgekehrt hat ein abgelöstes Boundary Event keinen gültigen Zustand —
 *     deshalb verbieten die Regeln das Ablösen, statt ein ungültiges Modell zu
 *     erzeugen.
 *
 * Zu (2): Der Typwechsel selbst (`shape.replace`) ist im Auftrag nicht
 * enthalten und bleibt offen; hier wird nur der Fall behandelt, dass bereits
 * ein `bpmn:BoundaryEvent` vorliegt.
 */

import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import type { BpmnShape } from "../types.js";
import { boOf, is } from "../util.js";

interface ModelingLike {
  moveShape(
    shape: BpmnShape,
    delta: { x: number; y: number },
    newParent?: unknown,
  ): void;
}

/**
 * Die Position, die ein Anhefter auf dem Rand seines Wirts einnehmen soll —
 * die Projektion seines Mittelpunkts auf die nächstgelegene Kante.
 */
export function snapToHostBorder(
  attacher: { x: number; y: number; width: number; height: number },
  host: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const cx = attacher.x + attacher.width / 2;
  const cy = attacher.y + attacher.height / 2;

  const left = host.x;
  const right = host.x + host.width;
  const top = host.y;
  const bottom = host.y + host.height;

  // Auf die Wirtsfläche klemmen, dann auf die nächste Kante ziehen.
  const clampedX = Math.min(Math.max(cx, left), right);
  const clampedY = Math.min(Math.max(cy, top), bottom);

  const distances = {
    left: clampedX - left,
    right: right - clampedX,
    top: clampedY - top,
    bottom: bottom - clampedY,
  };
  let side: keyof typeof distances = "bottom";
  let best = Number.POSITIVE_INFINITY;
  for (const candidate of ["left", "right", "top", "bottom"] as const) {
    if (distances[candidate] < best) {
      best = distances[candidate];
      side = candidate;
    }
  }

  const targetX = side === "left" ? left : side === "right" ? right : clampedX;
  const targetY = side === "top" ? top : side === "bottom" ? bottom : clampedY;

  return {
    x: targetX - attacher.width / 2,
    y: targetY - attacher.height / 2,
  };
}

export class BoundaryEventBehavior extends CommandInterceptor {
  static $inject = ["eventBus", "modeling"];

  constructor(
    eventBus: EventBus,
    private readonly modeling: ModelingLike,
  ) {
    super(eventBus);

    // Nach dem Verkleinern/Vergrößern des Wirts: Anhefter zurück auf den Rand.
    this.postExecuted(
      "shape.resize",
      (event: { context?: Record<string, unknown> }) => {
        const host = event.context?.["shape"] as BpmnShape | undefined;
        if (!host) return;
        this.realignAttachers(host);
      },
    );
  }

  private realignAttachers(host: BpmnShape): void {
    const attachers = Array.isArray(host.attachers) ? [...host.attachers] : [];
    for (const attacher of attachers) {
      if (!is(boOf(attacher), "bpmn:BoundaryEvent")) continue;
      const target = snapToHostBorder(attacher, host);
      const delta = { x: target.x - attacher.x, y: target.y - attacher.y };
      if (delta.x === 0 && delta.y === 0) continue;
      this.modeling.moveShape(attacher, delta, attacher.parent);
    }
  }
}

export default BoundaryEventBehavior;
