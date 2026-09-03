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
import {
  childLanes,
  isLaneShape,
  isParticipantShape,
  lanesRootOf,
  nodesInLane,
} from "../lanes";
import type { Bounds, BpmnElement, BpmnShape } from "../types";
import { boOf, isAny } from "../util";
import { isHorizontalDi } from "../di";

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

export interface ModelingLike {
  resizeShape(
    shape: BpmnShape,
    newBounds: Bounds,
    minBounds?: unknown,
    hints?: Record<string, unknown>,
  ): void;
  moveElements(
    shapes: BpmnShape[],
    delta: { x: number; y: number },
    target?: unknown,
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
    // [ARCTOS-FULL-2026-08-31 · OP-041] `laneRedistribution: true` heißt hier
    // „diese Größenänderung besorgt die Umverteilung gleich selbst" — die
    // Zeile darunter tut es. Ohne den Hint griffe zusätzlich das
    // `LaneResizeBehavior`, das an jedem ungeflaggten `shape.resize` eines
    // Pools hängt: die Lanes würden **zweimal** verteilt, beim zweiten Mal
    // gegen bereits verteilte Bounds. Gemessen führte das auf
    // `synth-collaboration-pools-lanes` zu negativen Lane-Höhen und der
    // Ausnahme „width and height cannot be less than 10px" mitten im
    // Auto-Resize.
    this.bpmnModeling.resizeShape(shape, newBounds, null, {
      ...(hints ?? {}),
      autoResize: (hints ?? {})["autoResize"] ?? false,
      laneRedistribution: true,
    });
    if (lanes.length === 0) return;
    redistributeLanes(this.bpmnModeling, previous, newBounds, lanes);
  }
}

/**
 * Verteilt die neue Fläche eines Containers auf seine Lanes — rekursiv.
 *
 * Waagerechte Lanes (der Normalfall) übernehmen die Breite des Containers und
 * teilen seine Höhe im bisherigen Verhältnis; die **letzte** Lane bekommt den
 * Rundungsrest, damit die Summe exakt aufgeht. Das ist die Eigenschaft, an der
 * es hängt: bliebe ein Pixel übrig, entstünde ein Streifen ohne Lane, und ein
 * Knoten dort verlöre seine `flowNodeRef`.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-039] **Senkrechte Pools rechnen entlang der
 * anderen Achse.** Bis hierher teilte diese Funktion *immer* die Höhe und
 * übernahm *immer* die Breite. In einem senkrechten Pool sind die Lanes
 * Spalten: sie sind so hoch wie der Pool und teilen seine Breite. Die alte
 * Rechnung gab jeder Spalte die volle Pool-Höhe **und** eine Höhe aus dem
 * Höhenverhältnis — die letzte Spalte bekam als Rest eine negative Höhe.
 *
 * Aufgefallen ist das nicht am Bild, sondern als Ausnahme: Sobald der Korpus
 * einen senkrechten Pool enthielt (`synth-vertical-pool-lanes`, OP-039), warf
 * der Eigenschaftslauf bei Startwert 20260901, Folge 50, in
 * `createShape(bpmn:SubProcess, in Participant_Amt)` die diagram-js-Prüfung
 * „width and height cannot be less than 10px". Ohne das Korpusdokument gab es
 * keinen Lauf, der die Zeile je ausgeführt hätte.
 */
export function redistributeLanes(
  modeling: ModelingLike,
  previous: Bounds,
  next: Bounds,
  lanes: readonly BpmnShape[],
): void {
  if (lanes.length === 0 || previous.height <= 0 || previous.width <= 0) return;

  // Die Ausrichtung wird an den Lanes selbst abgelesen und nicht am Pool: die
  // Rekursion bekommt hier Kind-Lanes einer Lane, und deren DI trägt dasselbe
  // `isHorizontal`. Fällt die DI aus, gilt die BPMN-Vorgabe „waagerecht".
  const horizontal = isHorizontalDi(lanes[0]?.di);

  const sorted = [...lanes].sort((a, b) =>
    horizontal ? a.y - b.y : a.x - b.x,
  );
  const scale = horizontal
    ? next.height / previous.height
    : next.width / previous.width;
  let cursor = horizontal ? next.y : next.x;

  for (const [index, lane] of sorted.entries()) {
    const isLast = index === sorted.length - 1;
    const extent = isLast
      ? (horizontal ? next.y + next.height : next.x + next.width) - cursor
      : Math.round((horizontal ? lane.height : lane.width) * scale);
    const bounds: Bounds = horizontal
      ? {
          x: lane.x + (next.x - previous.x),
          y: cursor,
          width: lane.width + (next.width - previous.width),
          height: extent,
        }
      : {
          x: cursor,
          y: lane.y + (next.y - previous.y),
          width: extent,
          height: lane.height + (next.height - previous.height),
        };
    const inner = childLanes(lane);
    const laneBefore = {
      x: lane.x,
      y: lane.y,
      width: lane.width,
      height: lane.height,
    };
    // [ARCTOS-FULL-2026-08-31 · OP-041] Der Hint sagt dem `LaneResizeBehavior`,
    // dass diese Größenänderung schon eine Umverteilung *ist* — sonst
    // verteilte es dieselben Kinder gleich noch einmal, und beim zweiten Mal
    // mit dem falschen Ausgangsverhältnis. Die Rekursion in die Kind-Lanes
    // steht unten und ist die einzige, die hier stattfinden soll.
    modeling.resizeShape(lane, bounds, null, {
      autoResize: false,
      laneRedistribution: true,
    });
    if (inner.length > 0) {
      redistributeLanes(modeling, laneBefore, bounds, inner);
    } else {
      moveLaneContents(modeling, lane, laneBefore, bounds, horizontal);
    }
    cursor += extent;
  }
}

/**
 * Verschiebt den Inhalt einer Lane um dasselbe Stück, um das ihre führende
 * Kante gewandert ist.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-024] **Der Befund, der hinter „5 px" steckte.**
 * Der Bericht `STUFE2-D-OFFENE-PUNKTE.md` §2.6 führt die Klasse
 * `bounds/bpmn:EndEvent` als kosmetische Differenz: „Keine Seite verliert
 * Daten, beide Dokumente sind gültig" (End_Bank y=255 gegen y=275). Gemessen
 * ist das nicht kosmetisch. `synth-collaboration-pools-lanes`,
 * `Participant_Bank` von 260 auf 390 px vergrößert:
 *
 * ```
 * vorher : Lane_Sachbearbeitung y= 80 h=130  → Start_Bank, Task_Bank_Pruefen
 *          Lane_Genehmigung      y=210 h=130  → Task_Bank_Entscheiden, End_Bank
 * nachher: Lane_Sachbearbeitung y= 80 h=195  → Start_Bank, Task_Bank_Pruefen,
 *                                              **Task_Bank_Entscheiden**
 *          Lane_Genehmigung      y=275 h=195  → End_Bank
 * ```
 *
 * Die Lane-Kante wandert unter dem Knoten weg, `syncLaneMembership` rechnet
 * die Zugehörigkeit aus der Geometrie neu — und `Task_Bank_Entscheiden` gehört
 * danach der Sachbearbeitung. In diesem Produkt ist das keine Kosmetik: die
 * Lane sagt, **wer** den Schritt tut; `flowNodeRef` trägt die
 * Rollenzuordnung, an der RACI und Verteidigungslinie hängen. Eine
 * Größenänderung an einer ganz anderen Stelle des Diagramms ändert damit still
 * die Verantwortung. Dazu lag `End_Bank` (y=252) danach **oberhalb** der
 * Oberkante seiner eigenen Lane (y=275).
 *
 * Die Referenz macht es anders und richtig: ihr `ResizeLaneBehavior` schafft
 * Platz über den `SpaceTool` und nimmt den Inhalt mit. Hier steht die
 * einfachere Fassung derselben Aussage — jeder Knoten behält seinen Abstand
 * zur führenden Kante seiner Lane. Nur Blatt-Lanes bewegen ihren Inhalt; eine
 * Lane mit Kind-Lanes überlässt das den Kindern, sonst wanderte ein Knoten
 * zweimal.
 */
function moveLaneContents(
  modeling: ModelingLike,
  lane: BpmnShape,
  before: Bounds,
  after: Bounds,
  horizontal: boolean,
): void {
  const delta = horizontal
    ? { x: 0, y: after.y - before.y }
    : { x: after.x - before.x, y: 0 };
  if (delta.x === 0 && delta.y === 0) return;

  // Der Inhalt wird **vor** der Größenänderung bestimmt — `nodesInLane` liest
  // die Geometrie, und die Lane hat ihre neue schon. Deshalb wird gegen die
  // alten Bounds gefragt.
  const probe = { ...lane, ...before } as BpmnShape;
  const nodes = nodesInLane(probe, lanesRootOf(lane)).filter(
    (node) =>
      // Anhefter kommen mit ihrem Wirt; sie selbst zu bewegen risse sie vom
      // Rand.
      node.host === undefined &&
      // **Nur wer sonst herausfiele.** Ein Knoten, dessen Mitte auch in der
      // neuen Lane liegt, bleibt stehen. Das ist der Unterschied zwischen
      // „Zugehörigkeit bewahren" und „alles mitschieben", und er ist
      // gemessen: `shape.resize` auf `Sub_A` in `COLLABORATION` lässt den Pool
      // wachsen; würde die Lane ihren ganzen Inhalt mitziehen, wanderte der
      // gerade vom Benutzer auf y=230 gesetzte Subprozess auf y=275 — die
      // Größenänderung würde ihre eigene Ursache verschieben.
      !containsMid(after, node),
  );
  if (nodes.length === 0) return;

  // `autoResize: false` — der Container wächst gerade selbst; ihn aus dieser
  // Bewegung heraus noch einmal wachsen zu lassen wäre eine Rückkopplung.
  modeling.moveElements(nodes, delta, undefined, { autoResize: false });
}

/** Liegt der Mittelpunkt der Form in diesen Bounds? */
function containsMid(bounds: Bounds, shape: BpmnShape): boolean {
  const x = shape.x + shape.width / 2;
  const y = shape.y + shape.height / 2;
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}

export const autoResizeModule = {
  __init__: ["autoResize", "autoResizeRules"],
  autoResize: ["type", BpmnAutoResize],
  autoResizeRules: ["type", AutoResizeRules],
};

export { BpmnAutoResize, AutoResizeRules };
export default autoResizeModule;
