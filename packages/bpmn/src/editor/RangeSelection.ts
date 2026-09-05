/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-032] Mehrfachauswahl per Tastatur über einen
 * Bereich.
 *
 * **Der Befund, wörtlich aus `STUFE2-B1-EDITOR.md` §7.11:** „`Strg+Leertaste`
 * nimmt das fokussierte Element hinzu, `Strg+A` alles — ‚alles in dieser Lane'
 * gibt es nicht." Nachgemessen an `synth-collaboration-pools-lanes`: um die
 * sechs Elemente einer Lane auszuwählen, brauchte es sechs Fokusfahrten plus
 * sechsmal `Strg+Leertaste`; mit der Maus genügt ein Lassozug. Das ist der
 * Abstand, den diese Datei schließt.
 *
 * **Zwei Bereiche, weil „Bereich" zwei Dinge heißt.**
 *
 * 1. **Der Container** (`Strg+Umschalt+A`) — „alles in dieser Lane", der Fall,
 *    den der Befund nennt. Der Bereich ist die Lane, der Pool, der Subprozess:
 *    eine Aussage des Modells, nicht der Geometrie. Genau deshalb ist er der
 *    bessere Tastaturzwilling des Lassos — er trifft, was zusammengehört, und
 *    nicht, was zufällig nebeneinander liegt.
 * 2. **Die Strecke** (`Umschalt+Leertaste`) — vom Anker (dem zuerst
 *    ausgewählten Element) bis zum fokussierten, entlang der Zeichenordnung.
 *    Das ist die Tastaturform von „anklicken, dann mit Umschalt woanders hin
 *    klicken", die es mit der Maus längst gibt.
 *
 * **Warum die Zeichenordnung und nicht die Ablaufordnung.** Die
 * Graphnavigation des Betrachters (`viewer/order.ts`) läuft topologisch —
 * sinnvoll zum Lesen. Für eine Strecke wäre sie falsch: an einer Verzweigung
 * ist „alles dazwischen" topologisch nicht definiert, und der Benutzer sieht
 * ohnehin eine Fläche. Genommen wird deshalb dieselbe Ordnung, die die Formen
 * auf dem Bildschirm haben (oben nach unten, links nach rechts) — die einzige,
 * bei der „von hier bis dort" das meint, was man sieht.
 *
 * Beide Bereiche zählen nur, was sichtbar ist (`visibility.ts`, OP-033) und
 * lassen Beschriftungs-Shapes aus — eine Auswahl, die Beschriftungen mitzählt,
 * sagt Zahlen an, die zu nichts auf dem Bildschirm passen.
 */

import type { EditorAnnouncer } from "./announce";
import { describe } from "./ElementCreation";
import type {
  BpmnElement,
  BpmnParent,
  BpmnShape,
  ElementRegistryLike,
  SelectionLike,
} from "./types";
import { visibleElements } from "./visibility";

export class RangeSelection {
  static $inject = [
    "elementRegistry",
    "selection",
    "canvas",
    "editorAnnouncer",
  ];

  constructor(
    private readonly elementRegistry: ElementRegistryLike,
    private readonly selection: SelectionLike,
    private readonly canvas: { getRootElement(): BpmnParent },
    private readonly announcer: EditorAnnouncer,
  ) {}

  /**
   * „Alles in dieser Lane" — alles, was denselben Container hat wie `element`.
   *
   * Der Container ist `element.parent`; für ein Element unmittelbar in der
   * Wurzel ist das das Diagramm selbst, und dann ist die Handlung dasselbe wie
   * `Strg+A` — das ist richtig so und wird auch so angesagt, statt die Taste
   * ins Leere laufen zu lassen.
   */
  selectContainer(element: BpmnElement | undefined): BpmnElement[] {
    if (!element) {
      this.announcer.reject("Es ist kein Element im Fokus.");
      return [];
    }
    const container = (element.parent ?? this.canvas.getRootElement()) as
      BpmnParent | undefined;
    if (!container) {
      this.announcer.reject("Dieses Element hat keinen Container.");
      return [];
    }

    const members = this.selectable().filter(
      (candidate) => candidate.parent === container,
    );
    if (members.length === 0) {
      this.announcer.reject("In diesem Container ist nichts auswählbar.");
      return [];
    }
    this.selection.select(members);
    this.announcer.announce(
      `${String(members.length)} Elemente in ${containerLabel(container)} ausgewählt.`,
    );
    return members;
  }

  /**
   * Die Strecke vom Anker bis `element`, entlang der Zeichenordnung.
   *
   * Der Anker ist das **erste** Element der laufenden Auswahl. Ist nichts
   * ausgewählt, wird `element` zum Anker: der erste Tastendruck setzt ihn, der
   * zweite spannt auf — dieselbe Zweischrittform wie beim Verbinden und beim
   * Containerwechsel, damit die Bedienung sich nicht auseinanderentwickelt.
   */
  extendRange(element: BpmnElement | undefined): BpmnElement[] {
    if (!element) {
      this.announcer.reject("Es ist kein Element im Fokus.");
      return [];
    }
    const anchor = this.selection.get()[0];
    if (!anchor || anchor === element) {
      this.selection.select(element);
      this.announcer.announce(
        `${describe(element)} als Anfang gesetzt. Zum Elementende fahren und Umschalt und Leertaste drücken.`,
      );
      return [element];
    }

    const ordered = this.selectable().sort(compareByPosition);
    const from = ordered.indexOf(anchor);
    const to = ordered.indexOf(element);
    if (from === -1 || to === -1) {
      this.announcer.reject("Anfang oder Ende liegt nicht auf dieser Ebene.");
      return [];
    }
    const range = ordered.slice(Math.min(from, to), Math.max(from, to) + 1);
    this.selection.select(range);
    this.announcer.announce(
      `${String(range.length)} Elemente von ${describe(anchor)} bis ${describe(element)} ausgewählt.`,
    );
    return range;
  }

  /** Was überhaupt ausgewählt werden darf. Siehe Kopf der Datei. */
  private selectable(): BpmnElement[] {
    return visibleElements(this.elementRegistry).filter(
      (candidate) =>
        candidate.parent !== undefined &&
        (candidate as BpmnShape).labelTarget === undefined,
    );
  }
}

export default RangeSelection;

/**
 * Zeichenordnung: oben vor unten, links vor rechts.
 *
 * Kanten haben keine `x`/`y`; sie erben die Position ihres Quellknotens, damit
 * eine Strecke die Kanten dazwischen mitnimmt statt sie ans Ende zu schieben.
 */
export function compareByPosition(a: BpmnElement, b: BpmnElement): number {
  const pa = positionOf(a);
  const pb = positionOf(b);
  return pa.y - pb.y || pa.x - pb.x || (a.id ?? "").localeCompare(b.id ?? "");
}

function positionOf(element: BpmnElement): { x: number; y: number } {
  const shape = element as BpmnShape;
  if (typeof shape.x === "number" && typeof shape.y === "number") {
    return { x: shape.x, y: shape.y };
  }
  const source = (element as { source?: BpmnShape }).source;
  if (source && typeof source.x === "number") {
    return { x: source.x, y: source.y };
  }
  const waypoint = (element as { waypoints?: Array<{ x: number; y: number }> })
    .waypoints?.[0];
  return waypoint ?? { x: 0, y: 0 };
}

/** Der Container so benennen, wie er auf dem Bildschirm heißt. */
export function containerLabel(container: BpmnParent): string {
  const bo = (
    container as { businessObject?: { name?: unknown; $type?: unknown } }
  ).businessObject;
  const name =
    typeof bo?.name === "string" && bo.name !== "" ? bo.name : undefined;
  if (name) return `„${name}“`;
  const id = (container as { id?: string }).id;
  return id && !id.startsWith("__") ? id : "diesem Diagramm";
}
