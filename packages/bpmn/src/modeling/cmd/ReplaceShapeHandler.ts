/**
 * `shape.replace` — Typwechsel eines Elements.
 *
 * Der Baustein, ohne den das ContextPad nicht gebaut werden kann: „Aufgabe →
 * Benutzeraufgabe", „Ereignis → Zeitereignis", „Gateway → paralleles Gateway".
 * `diagram-js` bringt einen generischen `ReplaceShapeHandler` mit, der
 * erzeugt, umhängt und löscht. Was er **nicht** kann, ist alles, was BPMN
 * daran besonders macht — und das ist genau die Liste, an der die drei Bäume
 * auseinanderlaufen, wenn man sie vergisst:
 *
 *  1. **Eigenschaften übernehmen**, aber nur die, die der *neue* Typ laut
 *     Metamodell überhaupt kennt. Wer blind kopiert, schreibt eine Eigenschaft
 *     an ein Objekt, dessen Deskriptor sie nicht führt — `moddle` nimmt sie im
 *     Speicher an und lässt sie beim Export weg. Das ist dieselbe stille
 *     Fehlerart wie ein Knoten in `collaboration.flowElements`.
 *  2. **`extensionElements` mitnehmen.** Dort hängt `arctos:grcMetadata`. Ein
 *     Typwechsel, der die GRC-Daten verliert, ist für dieses Vorhaben der
 *     teuerste denkbare Datenverlust.
 *  3. **Die ID behalten.** ARCTOS referenziert BPMN-Elemente aus der Datenbank
 *     heraus über ihre ID (Risiken, Kontrollen, Kommentare, Simulationsdaten).
 *     `bpmn-js` vergibt beim Ersetzen eine neue — das ist dort folgenlos und
 *     hier nicht. Wer eine neue ID will, sagt es (`hints.newId`).
 *  4. **Boundary Events umhängen.** Der generische Handler nimmt `children`
 *     mit, aber nicht `attachers`. Ein Wirt, dessen Anhefter beim Typwechsel
 *     verschwinden, verliert deren Fehlerpfade gleich mit.
 *  5. **Ereignisdefinition setzen** — in *einem* Kommando, nicht in zweien
 *     (siehe `ElementFactory.applyEventDefinition`).
 *
 * Umgesetzt als zusammengesetztes Kommando: die gesamte Arbeit läuft in
 * `preExecute`/`postExecute` über vorhandene Modellierungsoperationen. Das
 * Inverse ist damit die Summe geprüfter Inverser, und ein einziges `undo`
 * nimmt den Typwechsel vollständig zurück.
 */

import type { BpmnFactory } from "../BpmnFactory";
import type { BpmnElementFactory } from "../ElementFactory";
import type {
  Bounds,
  BpmnConnection,
  BpmnElement,
  BpmnParent,
  BpmnShape,
  ModdleElement,
} from "../types";
import { boOf, is, isModdleElement, isShapeElement } from "../util";

interface ModelingLike {
  createShape(
    shape: Record<string, unknown>,
    position: { x: number; y: number } | Bounds,
    target: BpmnParent,
    hints?: Record<string, unknown>,
  ): BpmnShape;
  moveElements(
    shapes: BpmnElement[],
    delta: { x: number; y: number },
    target?: BpmnParent,
    hints?: Record<string, unknown>,
  ): void;
  removeShape(shape: BpmnShape): void;
  updateAttachment(shape: BpmnShape, host?: BpmnShape): void;
  updateProperties(
    element: BpmnElement,
    properties: Record<string, unknown>,
  ): void;
  reconnectStart(
    connection: BpmnConnection,
    newSource: BpmnElement,
    docking: { x: number; y: number },
    hints?: Record<string, unknown>,
  ): void;
  reconnectEnd(
    connection: BpmnConnection,
    newTarget: BpmnElement,
    docking: { x: number; y: number },
    hints?: Record<string, unknown>,
  ): void;
}

interface RulesLike {
  allowed(action: string, context?: unknown): unknown;
}

export interface ReplaceShapeContext {
  oldShape: BpmnShape;
  /** Zieltyp und optionale Geometrie/Ereignisdefinition. */
  newData: {
    type: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    eventDefinitionType?: string;
    [key: string]: unknown;
  };
  hints?: {
    /** Kinder mitnehmen. Vorgabe `true`. */
    moveChildren?: boolean;
    /** Neue ID vergeben statt die alte zu behalten. Vorgabe `false`. */
    newId?: boolean;
    [key: string]: unknown;
  };
  newShape?: BpmnShape;
}

/**
 * Eigenschaften, die **nie** übernommen werden, weil sie Struktur tragen und
 * nicht Inhalt. Sie werden von den Kommandos gesetzt, die den neuen Knoten
 * einhängen — eine Kopie würde sie doppelt eintragen.
 */
const STRUCTURAL: ReadonlySet<string> = new Set([
  "id",
  "$type",
  "$parent",
  "$instanceOf",
  "di",
  "flowElements",
  "artifacts",
  "laneSets",
  "lanes",
  "childLaneSet",
  "flowNodeRef",
  "incoming",
  "outgoing",
  "attachedToRef",
  "sourceRef",
  "targetRef",
  "processRef",
  "default",
  "dataInputAssociations",
  "dataOutputAssociations",
  "participants",
  "messageFlows",
]);

/**
 * Die Eigenschaftsnamen, die der Deskriptor des Zieltyps kennt.
 *
 * `moddle` hängt an jedes erzeugte Element ein `$descriptor` mit der
 * vollständigen Eigenschaftsliste des Typs. Das ist die einzige verlässliche
 * Auskunft darüber, was der neue Typ überhaupt tragen kann — und ohne sie
 * bleibt nur Raten.
 */
function knownProperties(bo: ModdleElement): Set<string> | undefined {
  const descriptor = (bo as { $descriptor?: unknown }).$descriptor;
  if (typeof descriptor !== "object" || descriptor === null) return undefined;
  const properties = (descriptor as { properties?: unknown }).properties;
  if (!Array.isArray(properties)) return undefined;
  const out = new Set<string>();
  for (const property of properties) {
    const name = (property as { name?: unknown }).name;
    if (typeof name === "string") out.add(name);
  }
  return out;
}

/**
 * Überträgt Inhalt vom alten auf das neue semantische Objekt.
 *
 * `$attrs` (unbekannte Attribute fremder Werkzeuge) wandert flach mit — Z-C
 * verlangt, dass nichts verlorengeht, und ein Typwechsel ist kein Grund, eine
 * `camunda:`-Angabe wegzuwerfen, die wir nicht deuten können.
 */
export function copySemanticProperties(
  oldBo: ModdleElement,
  newBo: ModdleElement,
  clone: CloneFn,
): void {
  const known = knownProperties(newBo);

  for (const key of Object.keys(oldBo)) {
    if (STRUCTURAL.has(key)) continue;
    if (key === "$attrs") continue;
    if (key.startsWith("$")) continue;
    if (known && !known.has(key)) continue;
    // Eine Ereignisdefinition wird nur übernommen, wenn der Aufrufer keine
    // eigene vorgegeben hat; das entscheidet der Aufrufer, nicht diese Kopie.
    if (key === "eventDefinitions" && newBo["eventDefinitions"] !== undefined) {
      continue;
    }
    const value = oldBo[key];
    if (value === undefined) continue;
    newBo[key] = copyValue(value, newBo, clone);
  }

  // `$attrs` ist auf `moddle`s `Base` ein reiner Getter — zuweisen geht nicht,
  // hineinschreiben schon. Der Inhalt muss mit: dort stehen die Attribute
  // fremder Werkzeuge, die diese Engine nicht deutet und nach Z-C trotzdem
  // nicht verlieren darf.
  const attrs = oldBo["$attrs"];
  const target = newBo["$attrs"];
  if (
    typeof attrs === "object" &&
    attrs !== null &&
    typeof target === "object" &&
    target !== null
  ) {
    Object.assign(target, attrs);
  }
}

export type CloneFn = (type: string) => ModdleElement;

/**
 * Kopiert einen Eigenschaftswert — Teilbäume als **eigene Kopie**, nicht als
 * geteilte Referenz.
 *
 * Das ist keine Vorsicht, sondern die Folge eines Befundes des eigenen
 * Invariantenprüfers: Wird `extensionElements` geteilt und sein `$parent` auf
 * das neue Objekt umgebogen, dann zeigt es nach einem **Undo** auf ein Objekt,
 * das nicht mehr im Baum steht (`PARENT_LINK_BROKEN`). Der Vorwärtsweg sah
 * richtig aus, der Rückweg nicht — genau die Asymmetrie, gegen die diese
 * Schicht sonst mit Rückwegen arbeitet und die hier, in einem
 * zusammengesetzten Kommando, nur durch Kopieren zu vermeiden ist.
 *
 * Der Preis ist die Objektidentität: `arctos:grcMetadata` ist nach dem
 * Typwechsel ein gleichwertiges, aber anderes Objekt. Für den Export ist das
 * folgenlos (verglichen wird Inhalt), und für die Datenbank ebenfalls — dort
 * zählt die **Element-ID**, und die bleibt.
 */
function copyValue(
  value: unknown,
  parent: ModdleElement,
  clone: CloneFn,
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => copyValue(entry, parent, clone));
  }
  if (!isModdleElement(value)) return value;

  const copy = clone(value.$type);
  for (const key of Object.keys(value)) {
    if (key === "$parent" || key === "$type" || key === "$attrs") continue;
    if (key.startsWith("$")) continue;
    const inner = value[key];
    if (inner === undefined) continue;
    copy[key] = copyValue(inner, copy, clone);
  }
  const attrs = value["$attrs"];
  const target = copy["$attrs"];
  if (
    typeof attrs === "object" &&
    attrs !== null &&
    typeof target === "object" &&
    target !== null
  ) {
    Object.assign(target, attrs);
  }
  copy["$parent"] = parent;
  return copy;
}

export class ReplaceShapeHandler {
  static $inject = ["modeling", "rules", "elementFactory", "bpmnFactory"];

  constructor(
    private readonly modeling: ModelingLike,
    private readonly rules: RulesLike,
    private readonly elementFactory: BpmnElementFactory,
    private readonly bpmnFactory: BpmnFactory,
  ) {}

  preExecute(context: ReplaceShapeContext): void {
    const oldShape = context.oldShape;
    const hints = context.hints ?? {};
    const oldBo = boOf(oldShape);
    if (!oldBo) return;

    const parent = oldShape.parent;
    if (!parent) return;

    const oldBounds: Bounds = {
      x: oldShape.x,
      y: oldShape.y,
      width: oldShape.width,
      height: oldShape.height,
    };

    // (1) neues semantisches Objekt samt Grafik — ein Kommando.
    const attrs: Record<string, unknown> = {
      type: context.newData.type,
      width: context.newData.width ?? oldBounds.width,
      height: context.newData.height ?? oldBounds.height,
    };
    if (context.newData.eventDefinitionType !== undefined) {
      attrs["eventDefinitionType"] = context.newData.eventDefinitionType;
    }
    const template = this.elementFactory.createShape(attrs);
    const newBo = boOf(template);
    if (newBo) {
      copySemanticProperties(oldBo, newBo, (type) =>
        this.bpmnFactory.moddle.create(type, {}),
      );
    }

    const position = {
      x: (context.newData.x ?? oldBounds.x) + (attrs["width"] as number) / 2,
      y: (context.newData.y ?? oldBounds.y) + (attrs["height"] as number) / 2,
    };

    const host = oldShape.host;
    const newShape = this.modeling.createShape(
      template as unknown as Record<string, unknown>,
      position,
      host ? host : parent,
      host ? { ...hints, attach: true } : hints,
    );
    context.newShape = newShape;

    // (2) Kinder übernehmen — nur wenn der neue Typ überhaupt welche trägt.
    if (hints.moveChildren !== false) {
      const children = [...(oldShape.children ?? [])].filter(
        (child) => !isAttacher(child, oldShape),
      );
      if (children.length > 0 && acceptsChildren(newShape)) {
        this.modeling.moveElements(children, { x: 0, y: 0 }, newShape, hints);
      }
    }

    // (3) Boundary Events umhängen. Der generische Handler tut das nicht, und
    //     ein Anhefter, der am alten Wirt hängen bleibt, wird mit ihm gelöscht.
    const attachers = [...(oldShape.attachers ?? [])];
    for (const attacher of attachers) {
      const allowed = this.rules.allowed("shape.attach", {
        shape: attacher,
        target: newShape,
      });
      if (allowed === "attach" || allowed === true) {
        this.modeling.updateAttachment(attacher, newShape);
      }
    }

    // (4) Kanten übernehmen, soweit die Regeln es zulassen. Was nicht darf,
    //     verschwindet mit dem alten Knoten — das ist gewollt und sichtbar.
    for (const connection of [...oldShape.incoming]) {
      if (!this.canReconnect(connection, connection.source, newShape)) continue;
      this.modeling.reconnectEnd(connection, newShape, midOf(newShape), hints);
    }
    for (const connection of [...oldShape.outgoing]) {
      if (!this.canReconnect(connection, newShape, connection.target)) continue;
      this.modeling.reconnectStart(
        connection,
        newShape,
        midOf(newShape),
        hints,
      );
    }
  }

  /**
   * Alten Knoten entfernen — und danach seine ID übernehmen.
   *
   * Die Reihenfolge ist zwingend: Solange der alte Knoten existiert, ist seine
   * ID vergeben, und `elementRegistry` verwaltet Elemente über genau diese ID.
   */
  postExecute(context: ReplaceShapeContext): void {
    const { oldShape, newShape } = context;
    const oldId = oldShape.id;
    this.modeling.removeShape(oldShape);

    if (newShape && context.hints?.newId !== true) {
      this.modeling.updateProperties(newShape, { id: oldId });
    }
  }

  execute(): BpmnElement[] {
    return [];
  }

  revert(): BpmnElement[] {
    return [];
  }

  private canReconnect(
    connection: BpmnConnection,
    source: BpmnElement | undefined,
    target: BpmnElement | undefined,
  ): boolean {
    if (!source || !target) return false;
    return (
      this.rules.allowed("connection.reconnect", {
        connection,
        source,
        target,
      }) === true
    );
  }
}

export default ReplaceShapeHandler;

function midOf(shape: BpmnShape): { x: number; y: number } {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

function isAttacher(child: BpmnElement, host: BpmnShape): boolean {
  return (host.attachers ?? []).includes(child as BpmnShape);
}

/** Nimmt der neue Typ Kinder auf? Ein Task tut es nicht, ein SubProcess schon. */
function acceptsChildren(shape: BpmnShape): boolean {
  if (!isShapeElement(shape)) return false;
  const bo = boOf(shape);
  return (
    is(bo, "bpmn:SubProcess") ||
    is(bo, "bpmn:Transaction") ||
    is(bo, "bpmn:AdHocSubProcess") ||
    is(bo, "bpmn:Participant")
  );
}
