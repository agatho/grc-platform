/// <reference lib="dom" />

/**
 * `ElementCreation` — der eine Weg, auf dem ein Element entsteht.
 *
 * Palette, Kontextmenü und Tastatur benutzen ihn gemeinsam. Das ist keine
 * Sparsamkeit: Sobald jede Bedienung ihren eigenen Weg zum Anlegen hat,
 * unterscheiden sich Elternwahl, Regelprüfung und Ansage zwischen Maus und
 * Tastatur — und dann ist „ohne Maus baubar" eine Behauptung statt einer
 * Eigenschaft. Hier gibt es genau eine Antwort auf „wo landet das Element, ist
 * das erlaubt, und was wird angesagt".
 *
 * Die Regeln kommen aus `src/modeling/BpmnRules.ts` und werden über den
 * `rules`-Dienst gefragt — genau so, wie `diagram-js` sie beim Ziehen fragt.
 * Diese Schicht erfindet keine.
 */

import { getTypeLabel } from "../draw/semantic";
import type { EditorAnnouncer } from "./announce";
import type { ProbeFactory } from "./probe";
import type {
  AutoPlaceLike,
  BpmnElement,
  BpmnParent,
  BpmnShape,
  CanvasLike,
  CreateLike,
  ElementFactoryLike,
  ElementRegistryLike,
  ModelingLike,
  PaletteItem,
  Point,
  RulesLike,
  SelectionLike,
} from "./types";
import { visibleElements } from "./visibility";

/** Abstand, den ein frei platziertes Element zu vorhandenen hält. */
const FREE_SPOT_STEP = 140;
const FREE_SPOT_TRIES = 40;

export interface CreationResult {
  readonly shape: BpmnShape | null;
  /** Warum es nicht ging — bereits als Satz, für die Ansage. */
  readonly rejected?: string | undefined;
}

export class ElementCreation {
  static $inject = [
    "elementFactory",
    "modeling",
    "canvas",
    "elementRegistry",
    "rules",
    "selection",
    "editorAnnouncer",
    "autoPlace",
    "create",
    "probeFactory",
  ];

  constructor(
    private readonly elementFactory: ElementFactoryLike,
    private readonly modeling: ModelingLike,
    private readonly canvas: CanvasLike,
    private readonly elementRegistry: ElementRegistryLike,
    private readonly rules: RulesLike,
    private readonly selection: SelectionLike,
    private readonly announcer: EditorAnnouncer,
    private readonly autoPlace: AutoPlaceLike,
    private readonly create: CreateLike,
    private readonly probes: ProbeFactory,
  ) {}

  // -------------------------------------------------------------------------
  // Erzeugen
  // -------------------------------------------------------------------------

  /** Grafik-Attribute aus einem Paletteneintrag. */
  attrsFor(item: PaletteItem): Record<string, unknown> {
    const attrs: Record<string, unknown> = {
      type: item.type,
      ...(item.attrs ?? {}),
    };
    if (item.eventDefinitionType !== undefined) {
      attrs["eventDefinitionType"] = item.eventDefinitionType;
    }
    return attrs;
  }

  /** Ein noch nicht eingehängtes Shape zum Ziehen oder Ablegen. */
  prepare(item: PaletteItem): BpmnShape {
    return this.elementFactory.createShape(this.attrsFor(item));
  }

  /**
   * Legt ein Element an — mit Maus (Position vom Zeiger) oder ohne
   * (Position berechnet).
   */
  createAt(
    item: PaletteItem,
    position?: Point,
    parent?: BpmnParent,
  ): CreationResult {
    const shape = this.prepare(item);
    const where = position ?? this.freePosition(shape);
    const target = parent ?? this.parentAt(where, shape);

    if (!target) {
      return this.reject(
        `${item.title} lässt sich hier nicht ablegen: es gibt keinen zulässigen Container.`,
      );
    }
    if (
      this.rules.allowed("shape.create", { shape, parent: target }) !== true
    ) {
      return this.reject(
        `${item.title} ist an dieser Stelle nach den BPMN-Regeln nicht zulässig.`,
      );
    }

    const created = this.modeling.createShape(shape, where, target);
    this.selection.select(created);
    this.announcer.announce(
      `${item.title} angelegt${containerSuffix(target)}. Beschriftung mit F2.`,
    );
    return { shape: created };
  }

  /**
   * Hängt ein Element an ein vorhandenes an — Knoten **und** Kante in einem
   * Bedienschritt, also auch in einem Undo-Schritt.
   *
   * Vorher wird gefragt, ob die Kante überhaupt zulässig ist. Ohne diese Frage
   * würde `modeling.connect` mitten in `shape.append` werfen und einen halb
   * ausgeführten Kommandostapel hinterlassen.
   */
  append(source: BpmnShape, item: PaletteItem): CreationResult {
    const shape = this.prepare(item);
    const parent = source.parent;
    if (!parent) {
      return this.reject("Das Ausgangselement hängt an keinem Container.");
    }
    if (this.rules.allowed("shape.create", { shape, parent }) !== true) {
      return this.reject(
        `${item.title} ist in diesem Container nicht zulässig.`,
      );
    }
    // Gefragt wird mit einer Attrappe **im künftigen Container**, nicht mit dem
    // frisch erzeugten Shape: Ein Sequenzfluss ist nur innerhalb desselben
    // Containers zulässig, und ein noch nicht eingehängtes Shape hat gar
    // keinen. Ohne den Container lehnt die Regel jedes Anhängen ab — und der
    // Fehler sähe aus, als sei sie zu streng. (Das Shape selbst lässt sich
    // dafür nicht kopieren: `diagram-js` legt `businessObject`, `parent` und
    // die Kantenlisten als nicht aufzählbare Zugriffseigenschaften an, ein
    // Spread verliert sie also stillschweigend.)
    const connectionRule = this.rules.allowed("connection.create", {
      source,
      target: this.probes.shapeIn(item.type, parent),
    });
    if (!isAllowedConnection(connectionRule)) {
      return this.reject(
        `Von ${describe(source)} aus ist keine Verbindung zu ${item.title} zulässig.`,
      );
    }

    const created = this.autoPlace.append(source, shape) as BpmnShape;
    this.selection.select(created);
    this.announcer.announce(
      `${item.title} an ${describe(source)} angehängt und verbunden. Beschriftung mit F2.`,
    );
    return { shape: created };
  }

  /**
   * Heftet ein Ereignis an eine Aktivität — und macht dabei ein Randereignis
   * daraus.
   *
   * [ARCTOS-FULL-2026-08-31 · OP-019] **Hier stand eine Verweigerung.** Bis zu
   * dieser Welle lehnte diese Methode jeden Typ ab, der nicht schon
   * `bpmn:BoundaryEvent` war, mit dem Satz „Nur ein Randereignis lässt sich an
   * eine Aktivität anheften" und der Begründung, die Modellierungsschicht baue
   * den Typwechsel nicht (STUFE2-A1 §7, Punkt 1).
   *
   * **Gegen den Code geprüft trägt diese Begründung nicht mehr.**
   * `BpmnRules.canAttach` lässt `bpmn:IntermediateThrowEvent` und
   * `bpmn:IntermediateCatchEvent` ausdrücklich zu; der Kommentar dort lautet
   * wörtlich „(und zwischenzeitliche Ereignisse, die dabei zu welchen
   * werden)". Und `modeling.replaceShape` gibt es samt Übernahme von
   * `extensionElements`, ID und Anheftern (`cmd/ReplaceShapeHandler.ts`). Es
   * fehlte allein die **Bedienung**: die Regel erlaubte es, die Operation
   * konnte es, und die Schicht dazwischen sagte nein.
   *
   * **Was jetzt geschieht.** Ein angeheftetes Zwischenereignis wird zum
   * Randereignis, mit derselben Ereignisdefinition. Der Nutzer bekommt, was er
   * meint, statt einer Ablehnung — und die Ansage nennt den Wechsel
   * ausdrücklich, weil ein stiller Typwechsel eine Überraschung wäre.
   *
   * Ein Typ, der **kein** Ereignis ist (eine Aufgabe, ein Gateway), wird
   * weiterhin abgelehnt: dafür gibt es keine Lesart, in der der Nutzer ein
   * Randereignis gemeint hätte.
   */
  attachBoundary(host: BpmnShape, item: PaletteItem): CreationResult {
    const attachable = asBoundaryItem(item);
    if (!attachable) {
      return this.reject(
        `${item.title} lässt sich nicht anheften — an den Rand einer Aktivität gehört ein Ereignis.`,
      );
    }
    const converted = attachable.type !== item.type;
    const shape = this.prepare(attachable);
    if (
      this.rules.allowed("shape.attach", { shape, target: host }) !== "attach"
    ) {
      return this.reject(
        `An ${describe(host)} lässt sich kein Randereignis anheften.`,
      );
    }
    const parent = host.parent;
    if (!parent) {
      return this.reject("Der Wirt hängt an keinem Container.");
    }
    const position = { x: host.x + host.width, y: host.y + host.height };
    const created = this.modeling.createShape(shape, position, host, {
      attach: true,
    });
    this.selection.select(created);
    this.announcer.announce(
      converted
        ? `${item.title} an ${describe(host)} angeheftet und dabei in ein Randereignis umgewandelt. Beschriftung mit F2.`
        : `${attachable.title} an ${describe(host)} angeheftet. Beschriftung mit F2.`,
    );
    return { shape: created };
  }

  /**
   * [ARCTOS-FULL-2026-08-31 · OP-019] Ein **vorhandenes** Element an eine
   * Aktivität anheften.
   *
   * Der zweite Weg desselben Punkts: nicht „neu anlegen und anheften", sondern
   * „das hier gehört an den Rand von dem da". Mit der Maus ist das ein Zug, mit
   * der Tastatur der Containerwechsel (`m`). Beide landen hier.
   *
   * Die Reihenfolge ist Absicht: **erst anheften, dann den Typ wechseln.**
   * `ReplaceShapeHandler` übernimmt `host` des alten Shapes und legt das neue
   * mit `attach: true` an; wer umgekehrt vorginge, hätte zwischendurch ein
   * `bpmn:BoundaryEvent` ohne Wirt — genau der Zustand, den die Invariante
   * `BOUNDARY_WITHOUT_HOST` zu Recht bemängelt.
   */
  attachExisting(element: BpmnShape, host: BpmnShape): CreationResult {
    if (
      this.rules.allowed("shape.attach", { shape: element, target: host }) !==
      "attach"
    ) {
      return this.reject(
        `${describe(element)} lässt sich nicht an ${describe(host)} anheften.`,
      );
    }
    const wasType = boTypeOf(element);
    this.modeling.updateAttachment(element, host);

    let current = element;
    if (wasType !== "bpmn:BoundaryEvent") {
      const definition = eventDefinitionOf(element);
      current = this.modeling.replaceShape(element, {
        type: "bpmn:BoundaryEvent",
        ...(definition ? { eventDefinitionType: definition } : {}),
      });
    }
    this.selection.select(current);
    this.announcer.announce(
      wasType === "bpmn:BoundaryEvent"
        ? `${describe(current)} an ${describe(host)} angeheftet.`
        : `${getTypeLabel(wasType)} an ${describe(host)} angeheftet und dabei in ein Randereignis umgewandelt. Die Kennung ${current.id} bleibt erhalten.`,
    );
    return { shape: current };
  }

  /** Ziehen aus der Palette (Maus). */
  startDrag(event: Event, item: PaletteItem): void {
    const shape = this.prepare(item);
    this.create.start(event, shape);
  }

  // -------------------------------------------------------------------------
  // Wo hin?
  // -------------------------------------------------------------------------

  /**
   * Der innerste Container an dieser Stelle, der das Element aufnehmen darf.
   *
   * Von innen nach außen, damit eine Lane vor ihrem Pool und ein Subprozess
   * vor dem Prozess gewinnt. Endet bei der Wurzel — nimmt auch die es nicht,
   * gibt es keinen Platz, und das ist eine Meldung wert statt eines stillen
   * Fehlschlags.
   */
  parentAt(position: Point, shape: BpmnShape): BpmnParent | null {
    const candidates = this.containersAt(position);
    for (const candidate of candidates) {
      if (
        this.rules.allowed("shape.create", { shape, parent: candidate }) ===
        true
      ) {
        return candidate;
      }
    }
    const root = this.canvas.getRootElement();
    if (this.rules.allowed("shape.create", { shape, parent: root }) === true) {
      return root;
    }
    return null;
  }

  /** Alle Container unter dem Punkt, innerste zuerst. */
  private containersAt(position: Point): BpmnParent[] {
    const hits: Array<{ element: BpmnShape; area: number }> = [];
    // [ARCTOS-FULL-2026-08-31 · OP-033] Die Kinder eines eingeklappten
    // Subprozesses behalten ihre alte Geometrie. Sie als Container unter dem
    // Zeigepunkt zu melden, legte ein neues Element in einen Behälter, den
    // niemand sieht.
    for (const element of visibleElements(this.elementRegistry)) {
      const shape = element as BpmnShape;
      if (typeof shape.width !== "number" || typeof shape.height !== "number") {
        continue;
      }
      if (shape.labelTarget !== undefined) continue;
      if (shape.parent === undefined) continue;
      if (
        position.x >= shape.x &&
        position.x <= shape.x + shape.width &&
        position.y >= shape.y &&
        position.y <= shape.y + shape.height
      ) {
        hits.push({ element: shape, area: shape.width * shape.height });
      }
    }
    return hits.sort((a, b) => a.area - b.area).map((hit) => hit.element);
  }

  /**
   * Eine freie Stelle im sichtbaren Bereich.
   *
   * Ohne Maus gibt es keinen Zeiger, aber es muss trotzdem eine
   * *vorhersagbare* Stelle geben — ein Element, das unter einem anderen
   * verschwindet, ist für einen Tastaturnutzer nicht wiederzufinden. Deshalb:
   * Mitte des sichtbaren Bereichs, dann nach rechts und unten in festen
   * Schritten, bis nichts mehr überlappt.
   */
  freePosition(shape: BpmnShape): Point {
    const viewbox = this.canvas.viewbox();
    const start: Point = {
      x: Math.round(viewbox.x + viewbox.width / 2),
      y: Math.round(viewbox.y + viewbox.height / 2),
    };
    let candidate = start;
    for (let attempt = 0; attempt < FREE_SPOT_TRIES; attempt += 1) {
      if (!this.overlapsAny(candidate, shape)) return candidate;
      const row = Math.floor(attempt / 4) + 1;
      const column = attempt % 4;
      candidate = {
        x: start.x + column * FREE_SPOT_STEP,
        y: start.y + row * (FREE_SPOT_STEP / 2),
      };
    }
    return candidate;
  }

  private overlapsAny(position: Point, shape: BpmnShape): boolean {
    const box = {
      x: position.x - shape.width / 2,
      y: position.y - shape.height / 2,
      width: shape.width,
      height: shape.height,
    };
    // [ARCTOS-FULL-2026-08-31 · OP-033] Ein unsichtbares Element belegt
    // keinen Platz: sonst weicht die Suche nach einer freien Stelle einem
    // Kasten aus, der gar nicht da ist.
    return visibleElements(this.elementRegistry).some((element) => {
      const other = element as BpmnShape;
      if (typeof other.width !== "number") return false;
      if (other.parent === undefined) return false;
      if (other.isFrame === true) return false;
      if (other.labelTarget !== undefined) return false;
      return (
        box.x < other.x + other.width &&
        box.x + box.width > other.x &&
        box.y < other.y + other.height &&
        box.y + box.height > other.y
      );
    });
  }

  private reject(message: string): CreationResult {
    this.announcer.reject(message);
    return { shape: null, rejected: message };
  }
}

export default ElementCreation;

/** `„Rechnung prüfen“` bzw. der Typname, wenn es keinen Namen gibt. */
export function describe(element: BpmnElement | undefined): string {
  if (!element) return "dem Element";
  const bo = element.businessObject as { name?: unknown; $type?: unknown };
  const name = typeof bo?.name === "string" ? bo.name : "";
  const type = getTypeLabel(
    typeof bo?.$type === "string" ? bo.$type : (element.type ?? ""),
  );
  return name ? `${type} „${name}“` : `${type} ${element.id}`;
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-019] Der Paletteneintrag, so wie er am Rand
 * einer Aktivität gemeint ist.
 *
 * `undefined` heißt „das gehört da nicht hin". Ein Ereignis wird zum
 * `bpmn:BoundaryEvent` und behält seine Ereignisdefinition — sie ist der Grund,
 * warum der Nutzer *dieses* Ereignis gewählt hat, und ein Randereignis ohne
 * Auslöser wäre ein anderes Element unter demselben Namen.
 *
 * `bpmn:StartEvent` und `bpmn:EndEvent` bleiben draußen: Ein Start am Rand
 * einer Aktivität ist der Auslöser eines Ereignis-Subprozesses und entsteht
 * dort, nicht durch Anheften; ein Ende hat am Rand keine Bedeutung.
 */
export function asBoundaryItem(item: PaletteItem): PaletteItem | undefined {
  if (item.type === "bpmn:BoundaryEvent") return item;
  if (
    item.type !== "bpmn:IntermediateCatchEvent" &&
    item.type !== "bpmn:IntermediateThrowEvent"
  ) {
    return undefined;
  }
  return {
    ...item,
    type: "bpmn:BoundaryEvent",
    title: `${item.title} als Randereignis`,
  };
}

/** Der `$type` des Geschäftsobjekts, mit dem Shape-Typ als Rückfall. */
export function boTypeOf(element: BpmnElement): string {
  const bo = element.businessObject as { $type?: unknown } | undefined;
  return typeof bo?.$type === "string" ? bo.$type : (element.type ?? "");
}

/** Die Ereignisdefinition eines Ereignisses, falls es eine trägt. */
export function eventDefinitionOf(element: BpmnElement): string | undefined {
  const bo = element.businessObject as
    { eventDefinitions?: unknown } | undefined;
  const definitions = bo?.eventDefinitions;
  if (!Array.isArray(definitions) || definitions.length === 0) return undefined;
  const first = definitions[0] as { $type?: unknown } | undefined;
  return typeof first?.$type === "string" ? first.$type : undefined;
}

function containerSuffix(parent: BpmnParent): string {
  const bo = parent.businessObject as { name?: unknown; $type?: unknown };
  if (typeof bo?.$type !== "string") return "";
  if (bo.$type === "bpmn:Process" || bo.$type === "bpmn:Collaboration") {
    return "";
  }
  const name =
    typeof bo.name === "string" && bo.name !== "" ? bo.name : parent.id;
  return ` in ${getTypeLabel(bo.$type)} „${name}“`;
}

function isAllowedConnection(result: unknown): boolean {
  if (result === true) return true;
  return (
    typeof result === "object" &&
    result !== null &&
    typeof (result as { type?: unknown }).type === "string"
  );
}
