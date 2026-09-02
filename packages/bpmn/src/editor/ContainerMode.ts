/// <reference lib="dom" />

/**
 * Ein Element ohne Maus in einen anderen Container legen.
 *
 * **Die Lücke, die das schließt.** `STUFE2-B1-EDITOR.md` §7 und
 * `STUFE2-C-ABSCHLUSS.md` §5 nennen sie beide: „Containerwechsel nur mit der
 * Maus — die Tastatur legt frei oder angehängt an und verschiebt im Raster,
 * ‚in Container einfügen' fehlt". Für ein Pool-Diagramm ist das die spürbarste
 * Lücke der Tastaturbedienung überhaupt: eine Aktivität in die richtige Lane
 * zu bringen ist dort keine Zierde, sondern die Aussage des Diagramms — die
 * Lane sagt, *wer* den Schritt tut, und `flowNodeRef` hängt daran.
 *
 * **Warum eine Betriebsart und nicht eine Taste.** Ein Container ist kein
 * Nachbar in einer Reihe; welcher gemeint ist, kann eine Pfeiltaste nicht
 * ausdrücken. Deshalb dieselben drei Schritte wie beim Verbinden
 * (`ConnectMode`), mit denselben Tasten — wer eines kann, kann das andere:
 *
 *   1. Element wählen, Modus starten (`m`);
 *   2. mit `←`/`→` durch die **zulässigen** Container blättern — zulässig
 *      heißt `rules.allowed("elements.move", { shapes, target })`, also genau
 *      die Frage, die auch der Zug mit der Maus stellt;
 *   3. `Enter` legt hinein, `Escape` bricht ab.
 *
 * **Wohin genau.** Das Element landet in der Mitte des Zielcontainers, aber
 * nur, wenn es dort auch hineinpasst: `placeInside` hält einen Rand von einer
 * halben Elementgröße ein. Ein Element, das exakt auf die Kante des Containers
 * gesetzt wird, gehört semantisch hinein und sieht aus, als läge es daneben —
 * und seit dem Auto-Resize würde der Container zusätzlich wachsen, was nach
 * einem Tastendruck niemand erwartet.
 */

import type { EditorAnnouncer } from "./announce";
import { describe } from "./ElementCreation";
import { midOf } from "./ConnectMode";
import type {
  BpmnElement,
  BpmnParent,
  BpmnShape,
  CanvasLike,
  ElementRegistryLike,
  EventBusLike,
  ModelingLike,
  RulesLike,
  SelectionLike,
} from "./types";

export const CONTAINER_MARKER = "arctos-container-candidate";

interface ActiveMode {
  readonly shapes: readonly BpmnShape[];
  readonly candidates: readonly BpmnElement[];
  index: number;
}

export class ContainerMode {
  static $inject = [
    "eventBus",
    "canvas",
    "elementRegistry",
    "rules",
    "modeling",
    "selection",
    "editorAnnouncer",
  ];

  private active: ActiveMode | null = null;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly elementRegistry: ElementRegistryLike,
    private readonly rules: RulesLike,
    private readonly modeling: ModelingLike,
    private readonly selection: SelectionLike,
    private readonly announcer: EditorAnnouncer,
  ) {
    eventBus.on(["diagram.clear", "diagram.destroy"], () => {
      this.reset();
    });
  }

  isActive(): boolean {
    return this.active !== null;
  }

  /** Der gerade angebotene Container — für Tests und für die Ansage. */
  current(): BpmnElement | undefined {
    const active = this.active;
    return active ? active.candidates[active.index] : undefined;
  }

  candidates(): readonly BpmnElement[] {
    return this.active?.candidates ?? [];
  }

  /**
   * Startet den Containerwechsel für eine Auswahl.
   *
   * Angeboten wird die Wurzel und jeder Rahmen, der die Regeln passiert —
   * Pools, Lanes und aufgeklappte Subprozesse. Der **bisherige** Container
   * steht nicht in der Liste: ihn anzubieten hieße, einen Tastendruck für
   * „nichts tun" zu verlangen.
   */
  start(elements: readonly BpmnElement[]): boolean {
    this.reset();
    const shapes = elements.filter(
      (element): element is BpmnShape =>
        typeof (element as BpmnShape).width === "number" &&
        (element as BpmnShape).labelTarget === undefined &&
        element.parent !== undefined,
    );
    if (shapes.length === 0) {
      this.announcer.reject("Es ist kein Element ausgewählt.");
      return false;
    }
    const current = shapes[0]?.parent;
    const moved = new Set<BpmnElement>(shapes);

    const candidates = this.sortForReading(
      [this.root(), ...this.elementRegistry.getAll()].filter(
        (target): target is BpmnElement =>
          target !== undefined &&
          target !== current &&
          !moved.has(target) &&
          !this.containsAny(target, shapes) &&
          this.rules.allowed("elements.move", { shapes, target }) !== false,
      ),
    );

    if (candidates.length === 0) {
      this.announcer.reject(
        `${describe(shapes[0] as BpmnElement)} lässt sich nach den BPMN-Regeln in keinen anderen Container legen.`,
      );
      return false;
    }

    this.active = { shapes, candidates, index: 0 };
    this.mark(true);
    this.announcer.announce(
      `Container wechseln für ${describe(shapes[0] as BpmnElement)}. ` +
        `${countLabel(candidates.length)}. Pfeiltasten wählen, Eingabetaste legt hinein, Escape bricht ab. ` +
        this.describeCurrent(),
    );
    return true;
  }

  /** Zum nächsten (`1`) oder vorigen (`-1`) Container. */
  step(direction: 1 | -1): void {
    const active = this.active;
    if (!active) return;
    this.mark(false);
    active.index =
      (active.index + direction + active.candidates.length) %
      active.candidates.length;
    this.mark(true);
    this.announcer.announce(this.describeCurrent());
  }

  /** Legt die Auswahl in den gewählten Container. */
  confirm(): BpmnElement | null {
    const active = this.active;
    if (!active) return null;
    const target = active.candidates[active.index];
    const shape = active.shapes[0];
    if (!target || !shape) return null;
    const shapes = [...active.shapes];
    this.reset();

    const destination = placeInside(target, shape);
    this.modeling.moveElements(
      shapes,
      { x: destination.x - shape.x, y: destination.y - shape.y },
      // Die Kandidatenliste hat nur Container durchgelassen (die Regel
      // `elements.move` fragt ausdrücklich nach einem Ziel-Container), aber
      // der Registry-Typ kennt diese Einschränkung nicht.
      target as BpmnParent,
    );
    this.selection.select(shapes);
    this.announcer.announce(
      `${describe(shape)} liegt jetzt in ${describe(target)}.`,
    );
    return target;
  }

  cancel(): void {
    if (!this.active) return;
    this.reset();
    this.announcer.announce("Abgebrochen.");
  }

  // -------------------------------------------------------------------------

  private reset(): void {
    this.mark(false);
    this.active = null;
  }

  private mark(on: boolean): void {
    const target = this.current();
    if (!target) return;
    try {
      if (on) this.canvas.addMarker(target, CONTAINER_MARKER);
      else this.canvas.removeMarker(target, CONTAINER_MARKER);
    } catch {
      // Ein Element ohne Grafik ist hier kein Fehler.
    }
  }

  private describeCurrent(): string {
    const active = this.active;
    const target = this.current();
    if (!active || !target) return "";
    return `Container ${String(active.index + 1)} von ${String(active.candidates.length)}: ${describe(target)}.`;
  }

  private root(): BpmnElement | undefined {
    try {
      return this.canvas.getRootElement() as BpmnElement | undefined;
    } catch {
      return undefined;
    }
  }

  /** Ein Element darf nicht in sein eigenes Kind wandern. */
  private containsAny(
    target: BpmnElement,
    shapes: readonly BpmnShape[],
  ): boolean {
    for (const shape of shapes) {
      let node: BpmnElement | undefined = target;
      while (node) {
        if (node === shape) return true;
        node = node.parent as BpmnElement | undefined;
      }
    }
    return false;
  }

  /** Lesereihenfolge: oben vor unten, links vor rechts, dann Kennung. */
  private sortForReading(elements: readonly BpmnElement[]): BpmnElement[] {
    return [...elements].sort((a, b) => {
      const pa = midOf(a);
      const pb = midOf(b);
      return pa.y - pb.y || pa.x - pb.x || a.id.localeCompare(b.id);
    });
  }
}

export default ContainerMode;

function countLabel(count: number): string {
  return count === 1
    ? "ein zulässiger Container"
    : `${String(count)} zulässige Container`;
}

/**
 * Wohin das Element im Zielcontainer kommt.
 *
 * Die Mitte, aber mit einem Rand von einer halben Elementgröße — sonst ragt
 * die Form über die Kontur hinaus (und löste seit dem Auto-Resize zusätzlich
 * ein Wachstum aus, das nach einem Tastendruck niemand erwartet). Ein Ziel
 * ohne Geometrie (die Wurzel) lässt das Element, wo es ist.
 */
export function placeInside(
  target: BpmnElement,
  shape: BpmnShape,
): { x: number; y: number } {
  const box = target as BpmnShape;
  if (typeof box.width !== "number" || typeof box.height !== "number") {
    return { x: shape.x, y: shape.y };
  }
  const marginX = Math.min(shape.width, box.width / 2);
  const marginY = Math.min(shape.height, box.height / 2);
  const x = box.x + box.width / 2 - shape.width / 2;
  const y = box.y + box.height / 2 - shape.height / 2;
  return {
    x: clamp(
      x,
      box.x + marginX / 2,
      box.x + box.width - marginX / 2 - shape.width,
    ),
    y: clamp(
      y,
      box.y + marginY / 2,
      box.y + box.height - marginY / 2 - shape.height,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}
