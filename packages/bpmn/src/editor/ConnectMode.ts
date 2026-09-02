/// <reference lib="dom" />

/**
 * Verbinden ohne Maus — und das Umhängen einer vorhandenen Kante.
 *
 * `diagram-js` bringt `features/connect` mit; das ist ein **Ziehvorgang**. Ein
 * Ziehvorgang lässt sich ohne Zeigegerät nicht nachbilden, und ein Editor, in
 * dem man Elemente anlegen, aber nicht verbinden kann, ist kein Editor. Diese
 * Betriebsart ersetzt den Zug durch drei Schritte, die jede Tastatur kann:
 *
 *   1. Quelle wählen (die Auswahl), Modus starten;
 *   2. mit `←`/`→` durch die **zulässigen** Ziele blättern — zulässig heißt:
 *      `rules.allowed("connection.create", …)` sagt ja, und zwar für *jedes*
 *      angebotene Ziel einzeln, sodass gar nicht erst eine Kante angeboten
 *      wird, die die Regeln anschließend ablehnen;
 *   3. `Enter` verbindet, `Escape` bricht ab.
 *
 * Die Reihenfolge der Ziele ist die Entfernung zur Quelle, bei Gleichstand die
 * Lesereihenfolge. Sie ist damit **stabil** — dieselbe Quelle bietet dieselbe
 * Reihenfolge, auch nach einem Undo.
 *
 * Dieselbe Mechanik trägt das Umhängen (`connection.reconnect`): dort ist die
 * Quelle die Kante und die Frage lautet, welches Element neuer Anfang oder
 * neues Ende sein darf.
 */

import { getTypeLabel } from "../draw/semantic";
import type { EditorAnnouncer } from "./announce";
import { describe } from "./ElementCreation";
import type {
  BpmnConnection,
  BpmnElement,
  BpmnShape,
  CanvasLike,
  ElementRegistryLike,
  EventBusLike,
  ModelingLike,
  Point,
  RulesLike,
  SelectionLike,
} from "./types";

export const CANDIDATE_MARKER = "arctos-connect-candidate";

type Mode =
  | { kind: "connect"; source: BpmnElement }
  | { kind: "reconnect"; connection: BpmnConnection; end: "source" | "target" };

interface ActiveMode {
  readonly mode: Mode;
  readonly candidates: readonly BpmnElement[];
  index: number;
}

export class ConnectMode {
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

  /** Das gerade angebotene Ziel — für Tests und für die Ansage. */
  current(): BpmnElement | undefined {
    const active = this.active;
    return active ? active.candidates[active.index] : undefined;
  }

  candidates(): readonly BpmnElement[] {
    return this.active?.candidates ?? [];
  }

  // -------------------------------------------------------------------------

  /** Verbindungsmodus für eine Quelle starten. */
  start(source: BpmnElement): boolean {
    const candidates = this.sortByDistance(
      source,
      this.elementRegistry
        .getAll()
        .filter(
          (target) =>
            target !== source &&
            isConnectable(target) &&
            isAllowed(
              this.rules.allowed("connection.create", { source, target }),
            ),
        ),
    );
    return this.begin(
      { kind: "connect", source },
      candidates,
      () =>
        `Verbinden von ${describe(source)}. ${countLabel(candidates.length)}. Pfeiltasten wählen, Eingabetaste verbindet, Escape bricht ab.`,
    );
  }

  /** Eine vorhandene Kante an einem Ende umhängen. */
  startReconnect(
    connection: BpmnConnection,
    end: "source" | "target",
  ): boolean {
    const other = end === "source" ? connection.target : connection.source;
    const candidates = this.sortByDistance(
      connection,
      this.elementRegistry.getAll().filter((element) => {
        if (!isConnectable(element)) return false;
        if (element === other) return false;
        const source = end === "source" ? element : connection.source;
        const target = end === "source" ? connection.target : element;
        if (!source || !target) return false;
        if (
          element === (end === "source" ? connection.source : connection.target)
        ) {
          return false;
        }
        return isAllowed(
          this.rules.allowed("connection.reconnect", {
            connection,
            source,
            target,
          }),
        );
      }),
    );
    return this.begin(
      { kind: "reconnect", connection, end },
      candidates,
      () =>
        `${end === "source" ? "Anfang" : "Ende"} von ${describe(connection)} umhängen. ${countLabel(
          candidates.length,
        )}. Pfeiltasten wählen, Eingabetaste übernimmt, Escape bricht ab.`,
    );
  }

  private begin(
    mode: Mode,
    candidates: readonly BpmnElement[],
    message: () => string,
  ): boolean {
    this.reset();
    if (candidates.length === 0) {
      this.announcer.reject(
        mode.kind === "connect"
          ? `Von ${describe(mode.source)} aus lässt sich nach den BPMN-Regeln nichts verbinden.`
          : "Für dieses Kantenende gibt es kein zulässiges Ziel.",
      );
      return false;
    }
    this.active = { mode, candidates, index: 0 };
    this.mark(true);
    this.announcer.announce(`${message()} ${this.describeCurrent()}`);
    return true;
  }

  /** Zum nächsten (`1`) oder vorigen (`-1`) Ziel. */
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

  /** Führt die Verbindung beziehungsweise das Umhängen aus. */
  confirm(): BpmnElement | null {
    const active = this.active;
    if (!active) return null;
    const target = active.candidates[active.index];
    if (!target) return null;
    const mode = active.mode;
    this.reset();

    if (mode.kind === "connect") {
      const connection = this.modeling.connect(mode.source, target);
      this.selection.select(connection);
      this.announcer.announce(
        `${describe(mode.source)} mit ${describe(target)} verbunden: ${describe(connection)}.`,
      );
      return connection;
    }

    const docking = midOf(target);
    if (mode.end === "source") {
      this.modeling.reconnectStart(mode.connection, target, docking);
    } else {
      this.modeling.reconnectEnd(mode.connection, target, docking);
    }
    this.selection.select(mode.connection);
    this.announcer.announce(
      `${mode.end === "source" ? "Anfang" : "Ende"} von ${describe(mode.connection)} auf ${describe(target)} umgehängt.`,
    );
    return mode.connection;
  }

  /** Bricht ab, ohne etwas zu ändern. */
  cancel(): void {
    if (!this.active) return;
    this.reset();
    this.announcer.announce("Abgebrochen.");
  }

  private reset(): void {
    this.mark(false);
    this.active = null;
  }

  private mark(on: boolean): void {
    const target = this.current();
    if (!target) return;
    try {
      if (on) this.canvas.addMarker(target, CANDIDATE_MARKER);
      else this.canvas.removeMarker(target, CANDIDATE_MARKER);
    } catch {
      // Ein Element ohne Grafik (noch nicht gezeichnet) ist hier kein Fehler.
    }
  }

  private describeCurrent(): string {
    const active = this.active;
    const target = this.current();
    if (!active || !target) return "";
    return `Ziel ${String(active.index + 1)} von ${String(active.candidates.length)}: ${describe(target)}.`;
  }

  private sortByDistance(
    origin: BpmnElement,
    elements: readonly BpmnElement[],
  ): BpmnElement[] {
    const from = midOf(origin);
    return [...elements].sort((a, b) => {
      const pa = midOf(a);
      const pb = midOf(b);
      const da = (pa.x - from.x) ** 2 + (pa.y - from.y) ** 2;
      const db = (pb.x - from.x) ** 2 + (pb.y - from.y) ** 2;
      return da - db || pa.y - pb.y || pa.x - pb.x || a.id.localeCompare(b.id);
    });
  }
}

export default ConnectMode;

function countLabel(count: number): string {
  return count === 1
    ? "ein zulässiges Ziel"
    : `${String(count)} zulässige Ziele`;
}

/** Mittelpunkt einer Form oder einer Kante. */
export function midOf(element: BpmnElement): Point {
  const shape = element as BpmnShape;
  if (typeof shape.width === "number" && typeof shape.height === "number") {
    return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
  }
  const waypoints = (element as BpmnConnection).waypoints;
  if (Array.isArray(waypoints) && waypoints.length > 0) {
    const index = Math.floor(waypoints.length / 2);
    return waypoints[index] ?? waypoints[0] ?? { x: 0, y: 0 };
  }
  return { x: 0, y: 0 };
}

function isConnectable(element: BpmnElement): boolean {
  const shape = element as BpmnShape;
  if (element.parent === undefined) return false;
  if (shape.labelTarget !== undefined) return false;
  if (typeof shape.width !== "number") return false;
  return true;
}

function isAllowed(result: unknown): boolean {
  if (result === true) return true;
  return (
    typeof result === "object" &&
    result !== null &&
    typeof (result as { type?: unknown }).type === "string"
  );
}

/** Nur für die Ansage: Typname einer Kante. */
export function connectionTypeName(connection: BpmnConnection): string {
  const bo = connection.businessObject as { $type?: unknown };
  return getTypeLabel(
    typeof bo?.$type === "string" ? bo.$type : (connection.type ?? ""),
  );
}
