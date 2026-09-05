/// <reference lib="dom" />

/**
 * Größe ändern — Anfasser, Mindestmaße, Tastaturweg.
 *
 * `diagram-js` liefert `features/resize` mit Anfassern, Vorschau und
 * Einrasten; die Erlaubnis („was ist überhaupt in seiner Größe veränderbar")
 * **und die Untergrenze** beantwortet `BpmnRules.canResize` in `src/modeling`.
 * Beides wird benutzt, nichts davon wird hier zum zweiten Mal entschieden.
 *
 * `Resize` liest die Untergrenze aus `context.minDimensions`, das ein Zuhörer
 * auf `resize.start` setzen darf. Dieser Dienst holt sie von der Regel und
 * trägt sie dort ein — die Verdrahtung zwischen einer Antwort der
 * Modellierungsschicht und einer Konvention von `diagram-js`, mehr nicht.
 */

import { minDimensionsFor, type Dimensions } from "../modeling/BpmnRules";
import type { EditorAnnouncer } from "./announce";
import { describe } from "./ElementCreation";
import type {
  Bounds,
  BpmnShape,
  EventBusLike,
  ModelingLike,
  RulesLike,
} from "./types";

const HIGH_PRIORITY = 1500;

/** Richtungen, wie `diagram-js` sie schreibt. */
export type ResizeDirection = "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";

/**
 * Weitergereicht, nicht neu formuliert: die Untergrenze ist eine Regel und
 * steht in `src/modeling/BpmnRules.ts`. Der Name bleibt hier, weil die
 * Bedienschicht ihn kennt.
 */
export { minDimensionsFor };
export type { Dimensions };

export class ResizeBehavior {
  static $inject = ["eventBus", "modeling", "rules", "editorAnnouncer"];

  constructor(
    eventBus: EventBusLike,
    private readonly modeling: ModelingLike,
    private readonly rules: RulesLike,
    private readonly announcer: EditorAnnouncer,
  ) {
    eventBus.on(
      "resize.start",
      HIGH_PRIORITY,
      (event: {
        context?: { shape?: BpmnShape; minDimensions?: Dimensions };
      }) => {
        const context = event.context;
        if (!context?.shape || context.minDimensions) return;
        const min = this.minDimensions(context.shape);
        if (min) context.minDimensions = min;
      },
    );
  }

  /** Darf dieses Element in der Größe geändert werden? */
  canResize(shape: BpmnShape, newBounds?: Bounds): boolean {
    return this.minDimensions(shape, newBounds) !== undefined;
  }

  /**
   * Die Untergrenze, die die Regel für diese Form nennt — `undefined`, wenn
   * sie die Größenänderung überhaupt verbietet.
   */
  minDimensions(shape: BpmnShape, newBounds?: Bounds): Dimensions | undefined {
    const verdict = this.rules.allowed("shape.resize", { shape, newBounds });
    if (verdict === false || verdict === null || verdict === undefined) {
      return undefined;
    }
    const named = (verdict as { minDimensions?: Dimensions }).minDimensions;
    // `true` bleibt zulässig — eine fremde Regel darf weiterhin nur „ja" sagen.
    return named ?? minDimensionsFor(shape);
  }

  /**
   * Größe per Wert ändern — der Tastaturweg zu den Anfassern.
   *
   * `direction` sagt, welche Kante bewegt wird; `delta` um wie viel. Die
   * Mindestmaße werden **hier** durchgesetzt und nicht dem Aufrufer überlassen,
   * damit Maus- und Tastaturweg dieselbe Untergrenze haben.
   */
  resizeBy(
    shape: BpmnShape,
    direction: ResizeDirection,
    delta: { x: number; y: number },
  ): boolean {
    const min = this.minDimensions(shape);
    if (!min) {
      this.announcer.reject(
        `${describe(shape)} lässt sich in der Größe nicht ändern.`,
      );
      return false;
    }
    const bounds = resizeBounds(shape, direction, delta, min);
    if (
      bounds.width === shape.width &&
      bounds.height === shape.height &&
      bounds.x === shape.x &&
      bounds.y === shape.y
    ) {
      this.announcer.reject(
        `Mindestmaß erreicht: ${String(min.width)} mal ${String(min.height)}.`,
      );
      return false;
    }
    if (!this.canResize(shape, bounds)) {
      this.announcer.reject("Diese Größe ist nach den Regeln nicht zulässig.");
      return false;
    }
    this.modeling.resizeShape(shape, bounds);
    this.announcer.announce(
      `${describe(shape)} ist jetzt ${String(Math.round(bounds.width))} mal ${String(Math.round(bounds.height))} groß.`,
    );
    return true;
  }
}

export default ResizeBehavior;

/**
 * Neue Maße aus Richtung und Delta, begrenzt durch die Mindestmaße.
 *
 * Ausgelagert und exportiert, weil es die einzige Rechnung hier ist, die man
 * ohne DOM prüfen können muss.
 */
export function resizeBounds(
  shape: Bounds,
  direction: ResizeDirection,
  delta: { x: number; y: number },
  min: Dimensions,
): Bounds {
  let { x, y, width, height } = shape;

  if (direction.includes("e")) {
    width = Math.max(min.width, width + delta.x);
  }
  if (direction.includes("w")) {
    const nextWidth = Math.max(min.width, width - delta.x);
    x += width - nextWidth;
    width = nextWidth;
  }
  if (direction.includes("s")) {
    height = Math.max(min.height, height + delta.y);
  }
  if (direction.includes("n")) {
    const nextHeight = Math.max(min.height, height - delta.y);
    y += height - nextHeight;
    height = nextHeight;
  }
  return { x, y, width, height };
}
