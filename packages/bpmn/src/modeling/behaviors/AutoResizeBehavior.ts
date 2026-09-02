/**
 * Container wachsen mit ihrem Inhalt.
 *
 * **Was hier fehlte.** Ein Element an den Rand eines Subprozesses zu legen —
 * oder es dort zu erzeugen — vergrößerte den Subprozess nicht. Das Element lag
 * dann halb über der Kontur, im schlimmsten Fall vollständig außerhalb, während
 * der semantische Baum es korrekt als Kind führt: ein Bild, das dem Modell
 * widerspricht. `STUFE2-B1-EDITOR.md` §7 und `STUFE2-C-ABSCHLUSS.md` §5 führen
 * das als offenen Punkt; der Vergleichslauf gegen `bpmn-js` meldete dieselbe
 * Lücke von der anderen Seite als `bounds/bpmn:SubProcess` und
 * `bounds/bpmn:Participant` — nach derselben Operationsfolge waren die
 * Container verschieden groß (gemessen 300 px gegen 390 px Breite).
 *
 * **Warum das generische Modul und nicht ein eigenes.** `diagram-js` bringt
 * `features/auto-resize` mit: Auslöser (`shape.create`, `elements.move`,
 * `shape.resize`, `shape.toggleCollapse`), die Rechnung der neuen Bounds aus
 * Randabstand und Auslöseschwelle, die Rekursion nach oben und die Frage an
 * die Regel `element.autoResize`. Nachgebaut würde daraus eine zweite Wahrheit
 * über dieselbe Geometrie — und die Zahlen des Vergleichslaufs stimmten dann
 * bestenfalls zufällig überein. `diagram-js` ist eine eigene Abhängigkeit
 * (Plan §2.2); benutzt wird sie, nicht abgeschrieben.
 *
 * Diese Datei liefert deshalb nur die **BPMN-Antworten**:
 *
 *  1. *Wer* darf wachsen (`AutoResizeRules`) — und
 *  2. *wie* ein Pool wächst, dessen Lanes mitgezogen werden müssen
 *     (`BpmnAutoResize.resize`).
 *
 * **Die eine bewusste Einschränkung.** Eine Lane löst kein Wachstum aus und
 * wächst nicht für sich: Lanes teilen die Fläche ihres Pools restlos auf, eine
 * einzelne Lane zu vergrößern hieße, eine Nachbarlane zu verkleinern oder eine
 * Lücke zu lassen. Wächst der **Pool**, verteilt `resize()` die neue Höhe auf
 * die Lanes, damit die Aufteilung lückenlos bleibt.
 */

import AutoResize from "diagram-js/lib/features/auto-resize/AutoResize.js";
import RuleProvider from "diagram-js/lib/features/rules/RuleProvider.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import { childLanes, isLaneShape, isParticipantShape } from "../lanes";
import type { Bounds, BpmnElement, BpmnShape } from "../types";
import { boOf, isAny } from "../util";

/** Container, die überhaupt mitwachsen. */
const GROWABLE = [
  "bpmn:SubProcess",
  "bpmn:Transaction",
  "bpmn:AdHocSubProcess",
  "bpmn:Participant",
];

/**
 * Darf `target` wegen `elements` wachsen?
 *
 * Als freie Funktion, damit ein Test sie ohne Editor-Instanz prüfen kann — und
 * damit die Antwort an **einer** Stelle steht, wie bei allen anderen Regeln
 * dieser Schicht.
 */
export function canAutoResize(
  elements: readonly BpmnElement[],
  target: BpmnElement | undefined,
): boolean {
  const bo = boOf(target);
  if (!bo || !isAny(bo, GROWABLE)) return false;

  // Ein eingeklappter Subprozess zeigt seinen Inhalt gar nicht; ihn wachsen zu
  // lassen, weil jemand ein Element hineingelegt hat, wäre eine Reaktion auf
  // etwas, das niemand sieht.
  if ((target as BpmnShape).collapsed === true) return false;

  for (const element of elements) {
    // Lanes und Beschriftungen lösen kein Wachstum aus: die Lane *ist* die
    // Fläche des Pools, und eine Beschriftung hat keine eigene Ausdehnung im
    // Sinne des Inhalts.
    if (isLaneShape(element)) return false;
    if ((element as BpmnShape).labelTarget !== undefined) return false;
  }
  return true;
}

class AutoResizeRules extends RuleProvider {
  static override $inject = ["eventBus"];

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  override init(): void {
    this.addRule("element.autoResize", (context: unknown) => {
      const c = context as {
        elements?: BpmnElement[];
        target?: BpmnElement;
      };
      return canAutoResize(c.elements ?? [], c.target);
    });
  }
}

interface ModelingLike {
  resizeShape(
    shape: BpmnShape,
    newBounds: Bounds,
    minBounds?: unknown,
    hints?: Record<string, unknown>,
  ): void;
}

/**
 * `diagram-js`' `AutoResize` mit **einer** überschriebenen Methode.
 *
 * `resize()` ist genau der Punkt, an dem BPMN mehr weiß als `diagram-js`: ein
 * Pool ist nicht bloß ein Rechteck, sondern ein Rechteck, dessen Fläche seine
 * Lanes restlos aufteilen. Wächst er, müssen sie mitwachsen — sonst entsteht
 * unter der letzten Lane ein Streifen, der zu keiner Lane gehört, und ein
 * Knoten, der dort landet, hat keine `flowNodeRef`.
 */
class BpmnAutoResize extends (AutoResize as unknown as {
  new (...args: unknown[]): {
    resize(shape: BpmnShape, newBounds: Bounds, hints?: unknown): void;
  };
}) {
  static $inject = ["eventBus", "elementRegistry", "modeling", "rules"];

  private readonly bpmnModeling: ModelingLike;

  constructor(
    eventBus: EventBus,
    elementRegistry: unknown,
    modeling: ModelingLike,
    rules: unknown,
  ) {
    super(eventBus, elementRegistry, modeling, rules);
    this.bpmnModeling = modeling;
  }

  override resize(
    shape: BpmnShape,
    newBounds: Bounds,
    hints?: Record<string, unknown>,
  ): void {
    const lanes = isParticipantShape(shape) ? childLanes(shape) : [];
    const previous = {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
    };
    this.bpmnModeling.resizeShape(shape, newBounds, null, {
      ...(hints ?? {}),
      autoResize: (hints ?? {})["autoResize"] ?? false,
    });
    if (lanes.length === 0) return;
    redistributeLanes(this.bpmnModeling, previous, newBounds, lanes);
  }
}

/**
 * Verteilt die neue Fläche eines Pools auf seine Lanes — rekursiv.
 *
 * Waagerechte Lanes (der Normalfall) übernehmen die Breite des Pools und
 * teilen seine Höhe im bisherigen Verhältnis; die **letzte** Lane bekommt den
 * Rundungsrest, damit die Summe exakt aufgeht. Das ist die Eigenschaft, an der
 * es hängt: bliebe ein Pixel übrig, entstünde ein Streifen ohne Lane, und ein
 * Knoten dort verlöre seine `flowNodeRef`.
 */
export function redistributeLanes(
  modeling: ModelingLike,
  previous: Bounds,
  next: Bounds,
  lanes: readonly BpmnShape[],
): void {
  if (lanes.length === 0 || previous.height <= 0 || previous.width <= 0) return;

  const sorted = [...lanes].sort((a, b) => a.y - b.y);
  const scale = next.height / previous.height;
  let cursor = next.y;

  for (const [index, lane] of sorted.entries()) {
    const isLast = index === sorted.length - 1;
    const height = isLast
      ? next.y + next.height - cursor
      : Math.round(lane.height * scale);
    const bounds: Bounds = {
      x: lane.x + (next.x - previous.x),
      y: cursor,
      width: lane.width + (next.width - previous.width),
      height,
    };
    const inner = childLanes(lane);
    const laneBefore = {
      x: lane.x,
      y: lane.y,
      width: lane.width,
      height: lane.height,
    };
    modeling.resizeShape(lane, bounds, null, { autoResize: false });
    if (inner.length > 0) {
      redistributeLanes(modeling, laneBefore, bounds, inner);
    }
    cursor += height;
  }
}

export const autoResizeModule = {
  __init__: ["autoResize", "autoResizeRules"],
  autoResize: ["type", BpmnAutoResize],
  autoResizeRules: ["type", AutoResizeRules],
};

export { BpmnAutoResize, AutoResizeRules };
export default autoResizeModule;
